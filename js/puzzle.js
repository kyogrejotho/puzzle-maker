// The jigsaw itself: cuts a picture into real jigsaw-shaped pieces, lets her drag
// them with a finger, and snaps a piece into place when it's dropped near its spot.

import { mulberry32, shuffle } from './util.js';
import { playSnap, unlockAudio } from './sound.js';

const TAB = 0.1; // size of the knobs, relative to a piece
const JITTER = 0.04; // wobble so the pieces look hand-cut, not stamped
const SNAP = 0.35; // how close (in piece sizes) counts as "in the right spot"

// One edge between two pieces, as ten bezier points along a unit line.
// Each point is [distance along the edge, distance out from it].
function makeEdge(rand) {
  const j = () => (rand() * 2 - 1) * JITTER;
  const a = j(), b = j(), c = j(), d = j(), e = j();
  const t = TAB * (0.9 + rand() * 0.25);
  const flip = rand() < 0.5 ? 1 : -1;
  return [
    [0, 0],
    [0.2, a],
    [0.5 + b + d, -t + c],
    [0.5 - t + b, t + c],
    [0.5 - 2 * t + b - d, 3 * t + c],
    [0.5 + 2 * t + b - d, 3 * t + c],
    [0.5 + t + b, t + c],
    [0.5 + b + d, -t + c],
    [0.8, e],
    [1, 0],
  ].map(([l, w]) => [l, w * flip]);
}

// Adds an edge from A to B to the path. Neighbouring pieces share the same edge,
// one of them walking it backwards, so their knobs and holes match exactly.
function edgeTo(path, pts, ax, ay, bx, by, size, reverse) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const p = pts.map(([l, w]) => [ax + dx * l + nx * w * size, ay + dy * l + ny * w * size]);
  if (reverse) p.reverse();
  for (let i = 1; i < 10; i += 3) {
    path.bezierCurveTo(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], p[i + 2][0], p[i + 2][1]);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Puzzle {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = opts.image;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.hint = opts.hint ?? true;
    this.onPlace = opts.onPlace || (() => {});
    this.onChange = opts.onChange || (() => {});
    this.onComplete = opts.onComplete || (() => {});
    this.aspect = this.image.width / this.image.height;
    this.hitCtx = document.createElement('canvas').getContext('2d');
    this.complete = false;
    this.finishStart = 0;
    this.drag = null;
    this.raf = 0;

    const rand = mulberry32(opts.seed);
    this.hEdges = [];
    this.vEdges = [];
    for (let r = 1; r < this.rows; r++) {
      this.hEdges[r] = [];
      for (let c = 0; c < this.cols; c++) this.hEdges[r][c] = makeEdge(rand);
    }
    for (let r = 0; r < this.rows; r++) {
      this.vEdges[r] = [];
      for (let c = 1; c < this.cols; c++) this.vEdges[r][c] = makeEdge(rand);
    }

    // Piece positions (u, v) are measured from the board's corner in board widths,
    // so they survive the screen changing size.
    this.pieces = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.pieces.push({ index: this.pieces.length, col: c, row: r, u: 0, v: 0, placed: false });
      }
    }
    this.total = this.pieces.length;

    const saved = opts.saved;
    if (saved && saved.pieces?.length === this.total) {
      saved.pieces.forEach(([u, v, placed], i) => Object.assign(this.pieces[i], { u, v, placed: !!placed }));
      const loose = this.pieces.filter((p) => !p.placed);
      const order = (saved.order || []).map((i) => this.pieces[i]).filter((p) => p && !p.placed);
      this.loose = order.length === loose.length ? order : loose;
      this.savedPortrait = saved.portrait;
    } else {
      this.loose = this.pieces.slice();
      this.pendingScatter = true;
    }
    this.placedCount = this.total - this.loose.length;

    this.handleDown = this.handleDown.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleUp = this.handleUp.bind(this);
    canvas.addEventListener('pointerdown', this.handleDown);
    canvas.addEventListener('pointermove', this.handleMove);
    canvas.addEventListener('pointerup', this.handleUp);
    canvas.addEventListener('pointercancel', this.handleUp);
    this.observer = new ResizeObserver(() => this.layout());
    this.observer.observe(canvas);
    this.layout();
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.handleDown);
    c.removeEventListener('pointermove', this.handleMove);
    c.removeEventListener('pointerup', this.handleUp);
    c.removeEventListener('pointercancel', this.handleUp);
    this.observer.disconnect();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  getState() {
    const r4 = (x) => Math.round(x * 10000) / 10000;
    return {
      pieces: this.pieces.map((p) => [r4(p.u), r4(p.v), p.placed ? 1 : 0]),
      order: this.loose.map((p) => p.index),
      portrait: this.portrait,
    };
  }

  setHint(on) {
    this.hint = on;
    this.draw();
  }

  // ----- Layout -----

  layout() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!W || !H) return;
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);

    // Board on top (portrait) or on the left (landscape); loose pieces fill the rest.
    const portrait = H >= W;
    const m = Math.max(10, Math.round(Math.min(W, H) * 0.025));
    const A = this.aspect;
    let bw, bx, by, tray;
    if (portrait) {
      bw = Math.min(W - 2 * m, (H * 0.6 - m) * A);
      const bh = bw / A;
      bx = (W - bw) / 2;
      by = m;
      tray = { x: m, y: by + bh + m, w: W - 2 * m, h: H - by - bh - 2 * m };
    } else {
      bw = Math.min(W * 0.62 - m, (H - 2 * m) * A);
      const bh = bw / A;
      bx = m;
      by = (H - bh) / 2;
      tray = { x: bx + bw + m, y: m, w: W - bx - bw - 2 * m, h: H - 2 * m };
    }
    this.board = { x: bx, y: by, w: bw, h: bw / A };
    this.tray = tray;
    this.pw = bw / this.cols;
    this.ph = this.board.h / this.rows;
    this.S = Math.min(this.pw, this.ph);
    this.pad = Math.ceil(this.S * 0.32 + 6);

    for (const p of this.pieces) {
      p.path = this.piecePath(p);
      p.sprite = p.placed ? null : this.makeSprite(p);
    }
    this.buildPlacedLayer();

    const prev = this.portrait ?? this.savedPortrait;
    this.portrait = portrait;
    if (this.pendingScatter || (prev !== undefined && prev !== portrait)) {
      this.pendingScatter = false;
      this.scatter();
    } else {
      this.keepOnScreen();
    }
    this.draw();
  }

  piecePath(p) {
    const { pw, ph, S } = this;
    const { row: r, col: c } = p;
    const path = new Path2D();
    path.moveTo(0, 0);
    if (r === 0) path.lineTo(pw, 0);
    else edgeTo(path, this.hEdges[r][c], 0, 0, pw, 0, S, false);
    if (c === this.cols - 1) path.lineTo(pw, ph);
    else edgeTo(path, this.vEdges[r][c + 1], pw, 0, pw, ph, S, false);
    if (r === this.rows - 1) path.lineTo(0, ph);
    else edgeTo(path, this.hEdges[r + 1][c], 0, ph, pw, ph, S, true);
    if (c !== 0) edgeTo(path, this.vEdges[r][c], 0, 0, 0, ph, S, true);
    path.closePath();
    return path;
  }

  // Each loose piece is pre-drawn once (picture, bevel and shadow) so dragging stays smooth.
  makeSprite(p) {
    const { pw, ph, pad, dpr, board } = this;
    const c = document.createElement('canvas');
    c.width = Math.ceil((pw + 2 * pad) * dpr);
    c.height = Math.ceil((ph + 2 * pad) * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(pad, pad);

    g.save();
    g.shadowColor = 'rgba(50, 30, 10, 0.45)';
    g.shadowBlur = 5;
    g.shadowOffsetX = 1;
    g.shadowOffsetY = 2;
    g.fillStyle = '#000';
    g.fill(p.path);
    g.restore();

    g.save();
    g.clip(p.path);
    g.drawImage(this.image, -p.col * pw, -p.row * ph, board.w, board.h);
    g.lineWidth = 2.5;
    g.translate(1, 1);
    g.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    g.stroke(p.path);
    g.translate(-2, -2);
    g.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    g.stroke(p.path);
    g.restore();

    g.lineWidth = 1;
    g.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    g.stroke(p.path);
    return c;
  }

  buildPlacedLayer() {
    const c = (this.placedLayer ||= document.createElement('canvas'));
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const p of this.pieces) if (p.placed) this.paintPlaced(g, p);
  }

  paintPlaced(g, p) {
    const { board: b, pw, ph } = this;
    g.save();
    g.translate(b.x + p.col * pw, b.y + p.row * ph);
    g.save();
    g.clip(p.path);
    g.drawImage(this.image, -p.col * pw, -p.row * ph, b.w, b.h);
    g.restore();
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    g.stroke(p.path);
    g.restore();
  }

  // Lay the loose pieces out in a loose grid in the free space, in random order.
  scatter() {
    if (!this.board) {
      this.pendingScatter = true;
      return;
    }
    const n = this.loose.length;
    if (!n) return;
    let area = this.tray;
    if (area.w < this.pw || area.h < this.ph) area = { x: 0, y: 0, w: this.W, h: this.H };
    const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * area.w) / area.h))));
    const rows = Math.ceil(n / cols);
    const cw = area.w / cols;
    const ch = area.h / rows;
    const order = shuffle(this.loose.slice());
    order.forEach((p, i) => {
      const cx = area.x + ((i % cols) + 0.5) * cw;
      const cy = area.y + (Math.floor(i / cols) + 0.5) * ch;
      const jx = Math.max(0, cw - this.pw) * 0.35 * (Math.random() * 2 - 1);
      const jy = Math.max(0, ch - this.ph) * 0.35 * (Math.random() * 2 - 1);
      this.moveTo(p, cx - this.pw / 2 + jx, cy - this.ph / 2 + jy);
    });
    this.loose = order;
    this.keepOnScreen();
    this.draw();
    this.onChange();
  }

  moveTo(p, x, y) {
    const b = this.board;
    p.u = (x - b.x) / b.w;
    p.v = (y - b.y) / b.w;
  }

  screenPos(p) {
    const b = this.board;
    return { x: b.x + p.u * b.w, y: b.y + p.v * b.w };
  }

  keepOnScreen(only) {
    for (const p of only ? [only] : this.loose) {
      const { x, y } = this.screenPos(p);
      const cx = Math.min(Math.max(x, 0), this.W - this.pw);
      const cy = Math.min(Math.max(y, 0), this.H - this.ph);
      if (cx !== x || cy !== y) this.moveTo(p, cx, cy);
    }
  }

  // ----- Drawing -----

  draw() {
    if (!this.raf) this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  render() {
    const { ctx, dpr, board: b, pad, pw, ph } = this;
    if (!b) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // A soft mat that shows where the picture goes.
    ctx.save();
    ctx.shadowColor = 'rgba(80, 50, 20, 0.2)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#e6d8c4';
    roundRect(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 10);
    ctx.fill();
    ctx.restore();
    if (this.hint) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(this.image, b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.placedLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // When finished, fade in the whole picture so the seams disappear.
    if (this.finishStart) {
      const t = Math.min(1, (performance.now() - this.finishStart) / 1200);
      ctx.globalAlpha = t;
      ctx.drawImage(this.image, b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
      if (t < 1) this.draw();
    }

    for (const p of this.loose) {
      const { x, y } = this.screenPos(p);
      ctx.drawImage(p.sprite, x - pad, y - pad, pw + 2 * pad, ph + 2 * pad);
    }
  }

  // ----- Touch / mouse -----

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  pieceAt(x, y) {
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const p = this.loose[i];
      const s = this.screenPos(p);
      if (this.hitCtx.isPointInPath(p.path, x - s.x, y - s.y)) return p;
    }
    // Fingers aren't precise, so also accept a near miss on a piece's body.
    const tol = Math.max(8, this.S * 0.15);
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const p = this.loose[i];
      const s = this.screenPos(p);
      const lx = x - s.x, ly = y - s.y;
      if (lx > -tol && lx < this.pw + tol && ly > -tol && ly < this.ph + tol) return p;
    }
    return null;
  }

  handleDown(e) {
    if (this.drag || this.complete || !this.board) return;
    unlockAudio();
    const { x, y } = this.point(e);
    const p = this.pieceAt(x, y);
    if (!p) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    const s = this.screenPos(p);
    this.drag = { p, id: e.pointerId, ox: x - s.x, oy: y - s.y };
    this.loose.splice(this.loose.indexOf(p), 1);
    this.loose.push(p); // bring to the top
    this.draw();
  }

  handleMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const { x, y } = this.point(e);
    this.moveTo(d.p, x - d.ox, y - d.oy);
    this.draw();
  }

  handleUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    const p = d.p;
    const s = this.screenPos(p);
    const tx = this.board.x + p.col * this.pw;
    const ty = this.board.y + p.row * this.ph;
    if (Math.hypot(s.x - tx, s.y - ty) < this.S * SNAP) this.place(p);
    else this.keepOnScreen(p);
    this.draw();
    this.onChange();
  }

  place(p) {
    p.placed = true;
    this.moveTo(p, this.board.x + p.col * this.pw, this.board.y + p.row * this.ph);
    p.sprite = null;
    this.loose.splice(this.loose.indexOf(p), 1);
    this.placedCount++;
    this.paintPlaced(this.placedLayer.getContext('2d'), p);
    playSnap();
    navigator.vibrate?.(20);
    this.onPlace(this.placedCount, this.total);
    if (this.placedCount === this.total) {
      this.complete = true;
      this.finishStart = performance.now();
      this.onComplete();
    }
  }
}
