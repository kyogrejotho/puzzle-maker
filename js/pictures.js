// Built-in puzzle pictures, painted in code so the app works offline with no image files.

import { mulberry32, hashString } from './util.js';

export const PICTURE_SIZE = 1200;

export const PICTURES = [
  { id: 'garden', name: 'Flower Garden', paint: paintGarden },
  { id: 'sampler', name: 'Cross-Stitch', paint: paintSampler },
  { id: 'quilt', name: 'Patchwork Quilt', paint: paintQuilt },
  { id: 'mandala', name: 'Mandala', paint: paintMandala },
  { id: 'sunset', name: 'Sunset Lake', paint: paintSunset },
];

export function renderPicture(id) {
  const pic = PICTURES.find((p) => p.id === id);
  if (!pic) return null;
  const c = document.createElement('canvas');
  c.width = c.height = PICTURE_SIZE;
  pic.paint(c.getContext('2d'), PICTURE_SIZE, mulberry32(hashString(id)));
  return c;
}

// ----- Drawing helpers -----

const TAU = Math.PI * 2;
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, rot, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (v) => Math.round(v + (target - v) * p);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 200;
}

function heartPath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.9);
  ctx.bezierCurveTo(cx - r * 1.4, cy - r * 0.1, cx - r * 0.6, cy - r * 1.1, cx, cy - r * 0.35);
  ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.1, cx + r * 1.4, cy - r * 0.1, cx, cy + r * 0.9);
  ctx.closePath();
}

// ----- Flower garden -----

function paintGarden(ctx, S, rand) {
  const R = (a, b) => a + rand() * (b - a);
  const horizon = S * 0.5;

  let g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#6fa8e8');
  g.addColorStop(1, '#d6edff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, horizon + 20);

  const sx = S * 0.8, sy = S * 0.13;
  g = ctx.createRadialGradient(sx, sy, S * 0.05, sx, sy, S * 0.24);
  g.addColorStop(0, 'rgba(255, 244, 190, 0.9)');
  g.addColorStop(1, 'rgba(255, 244, 190, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, horizon);
  circle(ctx, sx, sy, S * 0.055, '#ffe27a');

  for (let i = 0; i < 4; i++) cloud(ctx, R(0.05, 0.65) * S, R(0.07, 0.28) * S, R(0.05, 0.08) * S, rand);

  hills(ctx, S, S * 0.38, S * 0.035, '#a9d59b', rand);
  hills(ctx, S, S * 0.43, S * 0.03, '#86c477', rand);
  for (let i = 0; i < 10; i++) {
    const x = R(0, S), y = S * 0.44 + R(-0.01, 0.02) * S, r = R(0.018, 0.032) * S;
    ctx.fillStyle = '#6a4a32';
    ctx.fillRect(x - r * 0.12, y, r * 0.24, r * 1.2);
    circle(ctx, x, y, r, pick(rand, ['#4f9a4a', '#5aa654', '#3f8a40']));
  }

  fence(ctx, S, S * 0.47, S * 0.555);

  const gy = S * 0.54;
  g = ctx.createLinearGradient(0, gy, 0, S);
  g.addColorStop(0, '#76c25e');
  g.addColorStop(1, '#3a8636');
  ctx.fillStyle = g;
  ctx.fillRect(0, gy, S, S - gy);
  ctx.lineCap = 'round';
  for (let i = 0; i < 2200; i++) {
    const x = R(0, S), y = R(gy, S), depth = (y - gy) / (S - gy);
    ctx.strokeStyle = rand() < 0.5 ? 'rgba(40, 110, 40, 0.35)' : 'rgba(170, 230, 140, 0.3)';
    ctx.lineWidth = 1 + depth * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + R(-3, 3), y - 4 - depth * 26);
    ctx.stroke();
  }

  const colors = ['#e63e6d', '#ff7aa2', '#f9c80e', '#ff9f1c', '#9b5de5', '#c77dff', '#ffffff', '#ff595e', '#4cc9f0', '#f15bb5'];
  const types = ['daisy', 'daisy', 'tulip', 'rose', 'cluster', 'cosmos'];
  const flowers = [];
  for (let i = 0; i < 230; i++) {
    const t = Math.pow(rand(), 0.75);
    flowers.push({
      x: R(-0.02, 1.02) * S,
      y: gy + S * 0.02 + t * S * 0.5,
      s: S * (0.012 + t * 0.035) * R(0.85, 1.15),
      type: pick(rand, types),
      color: pick(rand, colors),
    });
  }
  flowers.sort((a, b) => a.y - b.y);
  for (const f of flowers) flower(ctx, f, rand);

  for (let i = 0; i < 3; i++) {
    butterfly(ctx, R(0.1, 0.9) * S, R(0.3, 0.7) * S, S * R(0.025, 0.04), R(-0.4, 0.4),
      pick(rand, ['#ff9f1c', '#4cc9f0', '#f15bb5', '#f9c80e']));
  }
}

function cloud(ctx, x, y, r, rand) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const lift = i > 1 && i < 4 ? r * 0.3 : 0;
    ctx.arc(x + (i - 2.5) * r * 0.6, y + (rand() - 0.5) * r * 0.4 - lift, r * (0.5 + rand() * 0.4), 0, TAU);
    ctx.fill();
  }
}

function hills(ctx, S, base, amp, color, rand) {
  const f1 = 2 + rand() * 2, f2 = 5 + rand() * 3, p1 = rand() * 6, p2 = rand() * 6;
  ctx.beginPath();
  ctx.moveTo(0, S);
  for (let x = 0; x <= S; x += 8) {
    const t = x / S;
    ctx.lineTo(x, base - amp * Math.sin(t * f1 + p1) - amp * 0.4 * Math.sin(t * f2 + p2));
  }
  ctx.lineTo(S, S);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function fence(ctx, S, top, bottom) {
  const h = bottom - top;
  ctx.fillStyle = '#f4efe6';
  ctx.strokeStyle = 'rgba(120, 100, 80, 0.45)';
  ctx.lineWidth = 2;
  for (const ry of [top + h * 0.3, top + h * 0.7]) {
    ctx.fillRect(0, ry, S, h * 0.09);
    ctx.strokeRect(-2, ry, S + 4, h * 0.09);
  }
  const w = S * 0.028, gap = S * 0.05;
  for (let x = gap * 0.3; x < S; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, top + w * 0.6);
    ctx.lineTo(x + w / 2, top);
    ctx.lineTo(x + w, top + w * 0.6);
    ctx.lineTo(x + w, bottom);
    ctx.lineTo(x, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function flower(ctx, { x, y, s, type, color }, rand) {
  ctx.strokeStyle = '#2e7d32';
  ctx.lineWidth = Math.max(1.5, s * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.3, y + s * 1.5, x + (rand() - 0.5) * s * 0.6, y + s * 3.2);
  ctx.stroke();
  ellipse(ctx, x + s * 0.35, y + s * 1.4, s * 0.45, s * 0.16, -0.6, '#3c9b46');

  const dark = shade(color, -0.25);
  if (type === 'daisy' || type === 'cosmos') {
    const daisy = type === 'daisy';
    const n = daisy ? 12 : 8;
    const len = s * (daisy ? 0.55 : 0.6);
    const wid = s * (daisy ? 0.16 : 0.28);
    const rot = rand() * Math.PI;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.5, s * 0.03);
    for (let i = 0; i < n; i++) {
      const a = rot + (i * TAU) / n;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * len * 0.55, y + Math.sin(a) * len * 0.55, len * 0.55, wid, a, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
    }
    circle(ctx, x, y, s * 0.2, daisy ? '#f6b915' : '#7a4b1e');
  } else if (type === 'tulip') {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.42, y - s * 0.55);
    ctx.lineTo(x - s * 0.2, y - s * 0.22);
    ctx.lineTo(x, y - s * 0.65);
    ctx.lineTo(x + s * 0.2, y - s * 0.22);
    ctx.lineTo(x + s * 0.42, y - s * 0.55);
    ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.3, x, y + s * 0.3);
    ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.3, x - s * 0.42, y - s * 0.55);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.5, s * 0.04);
    ctx.stroke();
  } else if (type === 'rose') {
    circle(ctx, x, y, s * 0.5, dark);
    circle(ctx, x, y, s * 0.42, color);
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.6, s * 0.05);
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.1 * k, k, k + 4.2);
      ctx.stroke();
    }
  } else {
    for (let k = 0; k < 8; k++) {
      circle(ctx, x + (rand() - 0.5) * s * 0.35, y - k * s * 0.17 + s * 0.3, s * 0.15, k % 2 ? color : shade(color, 0.25));
    }
  }
}

function butterfly(ctx, x, y, s, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (const d of [-1, 1]) {
    ellipse(ctx, d * s * 0.5, -s * 0.25, s * 0.55, s * 0.4, d * 0.5, color);
    ellipse(ctx, d * s * 0.4, s * 0.35, s * 0.35, s * 0.28, -d * 0.4, shade(color, -0.2));
    circle(ctx, d * s * 0.55, -s * 0.3, s * 0.12, '#fff');
  }
  ctx.strokeStyle = '#3b2a20';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.14;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.5);
  ctx.lineTo(0, s * 0.6);
  ctx.stroke();
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.5);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.9, -s * 0.35, -s);
  ctx.moveTo(0, -s * 0.5);
  ctx.quadraticCurveTo(s * 0.2, -s * 0.9, s * 0.35, -s);
  ctx.stroke();
  ctx.restore();
}

// ----- Cross-stitch sampler -----

const FONT = {
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
};

const HEART = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
const SMALL_HEART = ['.X.X.', 'XXXXX', '.XXX.', '..X..'];
const FLOWER = ['...PPP...', '..PPPPP..', '.PPPYPPP.', '..PPPPP..', '...PPP...', '....G....', '.GG.G.GG.', '..GGGGG..', '....G....'];

function paintSampler(ctx, S, rand) {
  const N = 100, c = S / N;

  // Aida cloth: a cream weave with little holes.
  ctx.fillStyle = '#f6f0e1';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(150, 130, 100, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    ctx.moveTo(i * c, 0);
    ctx.lineTo(i * c, S);
    ctx.moveTo(0, i * c);
    ctx.lineTo(S, i * c);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(120, 100, 70, 0.22)';
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) ctx.fillRect(i * c - 1, j * c - 1, 2, 2);

  ctx.lineCap = 'round';
  const m = c * 0.2;
  const stitch = (gx, gy, color) => {
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return;
    const x = gx * c, y = gy * c;
    const cross = (o) => {
      ctx.beginPath();
      ctx.moveTo(x + m + o, y + m + o);
      ctx.lineTo(x + c - m + o, y + c - m + o);
      ctx.moveTo(x + c - m + o, y + m + o);
      ctx.lineTo(x + m + o, y + c - m + o);
      ctx.stroke();
    };
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = c * 0.32;
    cross(0.9);
    ctx.strokeStyle = color;
    ctx.lineWidth = c * 0.28;
    cross(0);
  };
  const motif = (rows, gx, gy, palette) => {
    rows.forEach((row, j) => [...row].forEach((ch, i) => palette[ch] && stitch(gx + i, gy + j, palette[ch])));
  };
  const ring = (k, color, every = 1) => {
    for (let i = k, n = 0; i <= N - 1 - k; i++, n++) {
      if (n % every) continue;
      stitch(i, k, color);
      stitch(i, N - 1 - k, color);
      stitch(k, i, color);
      stitch(N - 1 - k, i, color);
    }
  };

  const red = '#b8324a', pink = '#e77fa0', green = '#2f6b4f', leaf = '#4e9a5c';
  const blue = '#3d7cc9', purple = '#7b4fa0', gold = '#e0a526', brown = '#7a4a2a';

  ring(3, green);
  ring(4, green);
  ring(6, red, 2);

  // HOME SWEET HOME
  const text = 'HOME SWEET HOME';
  const width = [...text].reduce((w, ch) => w + (ch === ' ' ? 3 : 6), 0) - 1;
  let tx = Math.round((N - width) / 2);
  for (const ch of text) {
    if (ch === ' ') { tx += 3; continue; }
    motif(FONT[ch], tx, 10, { X: red });
    tx += 6;
  }

  for (let x = 10, k = 0; x <= 89; x += 6, k++) {
    const col = k % 2 ? blue : pink;
    stitch(x, 19, col); stitch(x - 1, 20, col); stitch(x + 1, 20, col); stitch(x, 21, col);
  }

  // The house.
  const hx = 37, hy = 26;
  for (let y = -1; y < 5; y++) for (let x = 18; x <= 19; x++) stitch(hx + x, hy + y, '#8a3b2e');
  for (let r = 0; r < 10; r++) {
    for (let x = 12 - (r + 2); x <= 12 + (r + 2); x++) stitch(hx + x, hy + r, r === 9 ? '#7a2a22' : '#c0453a');
  }
  for (let r = 10; r < 22; r++) for (let x = 2; x <= 22; x++) stitch(hx + x, hy + r, '#e9c48a');
  for (let r = 15; r < 22; r++) for (let x = 10; x <= 14; x++) stitch(hx + x, hy + r, brown);
  stitch(hx + 13, hy + 18, gold);
  for (const wx of [3, 17]) {
    for (let r = 12; r <= 16; r++) {
      for (let x = wx; x < wx + 5; x++) stitch(hx + x, hy + r, x === wx + 2 || r === 14 ? '#ffffff' : '#6fb3d9');
    }
    for (let x = wx; x < wx + 5; x++) stitch(hx + x, hy + 17, x % 2 ? pink : red);
  }

  const tree = (gx, gy) => {
    for (let j = 0; j < 11; j++) {
      for (let i = 0; i < 11; i++) {
        const dx = i - 5, dy = j - 5;
        if (dx * dx + dy * dy > 27) continue;
        stitch(gx + i, gy + j, (i * 7 + j * 3) % 11 === 0 ? '#d13b3b' : (i + j) % 3 ? '#3f8f46' : green);
      }
    }
    for (let j = 10; j < 15; j++) for (let i = 4; i < 7; i++) stitch(gx + i, gy + j, brown);
  };
  tree(23, 33);
  tree(66, 33);
  motif(FLOWER, 10, 39, { P: purple, Y: gold, G: leaf });
  motif(FLOWER, 81, 39, { P: pink, Y: gold, G: leaf });
  for (let x = 8; x <= 91; x++) stitch(x, 48, leaf);

  const heartColors = [red, pink, purple, blue];
  for (let i = 0; i < 8; i++) motif(HEART, 7 + i * 11, 53, { X: heartColors[i % 4] });

  const petals = [pink, gold, blue, red, purple, '#f08a4b', pink, gold];
  for (let i = 0; i < 8; i++) motif(FLOWER, 7 + i * 11, 64, { P: petals[i], Y: i % 2 ? red : gold, G: leaf });

  for (let x = 8; x <= 91; x++) {
    const y = 79 + Math.round(2 * Math.sin(x / 3));
    stitch(x, y, green);
    if (x % 6 === 0) { stitch(x, y - 1, leaf); stitch(x + 1, y - 1, leaf); }
  }
  for (let i = 0; i < 12; i++) motif(SMALL_HEART, 9 + i * 7, 86, { X: heartColors[(i + 1) % 4] });
}

// ----- Patchwork quilt -----

function paintQuilt(ctx, S, rand) {
  const N = 6, b = S / N;
  const brights = ['#d1495b', '#edae49', '#00798c', '#30638e', '#f2a7b5', '#8fb996', '#b56576', '#6d597a', '#e56b6f', '#eaac8b', '#2a9d8f', '#f4d35e'];
  const lights = ['#fbf3e4', '#f6e7cb', '#fdf0f3', '#eef5ea'];

  // Little repeating fabric prints: plain, polka dot, stripe, gingham, tiny flowers.
  const fabric = (base, kind) => {
    if (kind === 0) return base;
    const t = document.createElement('canvas');
    t.width = t.height = 24;
    const g = t.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 24, 24);
    const ink = isLight(base) ? 'rgba(180, 80, 100, 0.35)' : 'rgba(255, 255, 255, 0.4)';
    g.fillStyle = ink;
    g.strokeStyle = ink;
    if (kind === 1) {
      for (const [x, y] of [[6, 6], [18, 18]]) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
    } else if (kind === 2) {
      g.lineWidth = 3;
      g.beginPath();
      for (let k = -24; k < 48; k += 8) { g.moveTo(k, 0); g.lineTo(k + 24, 24); }
      g.stroke();
    } else if (kind === 3) {
      g.globalAlpha = 0.6;
      g.fillRect(0, 0, 12, 24);
      g.fillRect(0, 0, 24, 12);
    } else {
      for (let a = 0; a < 5; a++) {
        g.beginPath();
        g.arc(12 + Math.cos((a * TAU) / 5) * 3, 12 + Math.sin((a * TAU) / 5) * 3, 2.2, 0, TAU);
        g.fill();
      }
    }
    return ctx.createPattern(t, 'repeat');
  };
  const anyFabric = () => fabric(pick(rand, brights), Math.floor(rand() * 5));
  const lightFabric = () => fabric(pick(rand, lights), Math.floor(rand() * 5));

  const poly = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 40, 30, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  const rect = (x, y, w, h, fill) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill);
  const hst = (x, y, s, rot, A, B) => {
    const c = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
    const at = (k) => c[(rot + k) % 4];
    poly([at(0), at(1), at(3)], A);
    poly([at(1), at(2), at(3)], B);
  };

  const blocks = {
    pinwheel(x, y) {
      const A = anyFabric(), L = lightFabric(), s = b / 2;
      hst(x, y, s, 0, A, L); hst(x + s, y, s, 1, A, L); hst(x + s, y + s, s, 2, A, L); hst(x, y + s, s, 3, A, L);
    },
    triangles(x, y) {
      const A = anyFabric(), B = anyFabric(), s = b / 2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) hst(x + i * s, y + j * s, s, (i + j) % 2, A, B);
    },
    ninePatch(x, y) {
      const A = anyFabric(), L = lightFabric(), s = b / 3;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rect(x + i * s, y + j * s, s, s, (i + j) % 2 ? L : A);
    },
    star(x, y) {
      const L = lightFabric(), A = anyFabric(), C = anyFabric(), s = b / 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const cx = x + i * s, cy = y + j * s;
          if (i === 1 && j === 1) { rect(cx, cy, s, s, C); continue; }
          if (i !== 1 && j !== 1) { rect(cx, cy, s, s, L); continue; }
          const tl = [cx, cy], tr = [cx + s, cy], br = [cx + s, cy + s], bl = [cx, cy + s], m = [cx + s / 2, cy + s / 2];
          const sideways = j === 1;
          poly([tl, tr, m], sideways ? A : L);
          poly([br, bl, m], sideways ? A : L);
          poly([tr, br, m], sideways ? L : A);
          poly([bl, tl, m], sideways ? L : A);
        }
      }
    },
    logCabin(x, y) {
      const s = b / 9;
      const light = [lightFabric(), lightFabric()], dark = [anyFabric(), anyFabric()];
      rect(x + 4 * s, y + 4 * s, s, s, '#d1495b');
      for (let k = 1; k <= 4; k++) {
        const o = (4 - k) * s, w = (2 * k + 1) * s, L = light[k % 2], D = dark[k % 2];
        rect(x + o, y + o, w, s, L);
        rect(x + o, y + o + s, s, w - s, L);
        rect(x + o + s, y + o + w - s, w - s, s, D);
        rect(x + o + w - s, y + o + s, s, w - 2 * s, D);
      }
    },
    heart(x, y) {
      rect(x, y, b, b, lightFabric());
      heartPath(ctx, x + b / 2, y + b / 2 + b * 0.04, b * 0.34);
      ctx.fillStyle = anyFabric();
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    },
  };
  const kinds = Object.keys(blocks);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i * b, y = j * b;
      blocks[pick(rand, kinds)](x, y);
      ctx.setLineDash([9, 7]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 7, y + 7, b - 14, b - 14);
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(60, 40, 30, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, b, b);
    }
  }
}

// ----- Mandala -----

function paintMandala(ctx, S, rand) {
  const pal = ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#8ab17d', '#f28482', '#b5838d', '#ffd6a5', '#9b5de5', '#4cc9f0', '#ef476f', '#06d6a0'];
  const ink = '#1d2340';

  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, '#2b3f6b');
  g.addColorStop(1, '#141b33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 350; i++) {
    circle(ctx, rand() * S, rand() * S, 1 + rand() * 2.5, `rgba(255, 220, 140, ${0.2 + rand() * 0.6})`);
  }

  for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) rosette(ctx, x, y, S * 0.24, rand, pal, ink, 3);
  rosette(ctx, S / 2, S / 2, S * 0.48, rand, pal, ink, 6);
}

function petal(ctx, len, wid) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, -len * 0.25, wid * 0.7, -len * 0.8, 0, -len);
  ctx.bezierCurveTo(-wid * 0.7, -len * 0.8, -wid, -len * 0.25, 0, 0);
  ctx.closePath();
}

function rosette(ctx, cx, cy, R, rand, pal, ink, layers) {
  const counts = [24, 20, 16, 12, 10, 8];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  const lw = Math.max(2, R * 0.008);
  for (let L = 0; L < layers; L++) {
    const f = 1 - L / layers;
    const r0 = R * f * 0.55, len = R * f * 0.45;
    const n = counts[L + (6 - layers)];
    const wid = ((TAU * r0) / n) * 0.75 + len * 0.15;
    const c1 = pick(rand, pal), c2 = pick(rand, pal), c3 = pick(rand, pal);
    const off = (L % 2) * (Math.PI / n);
    for (let k = 0; k < n; k++) {
      ctx.save();
      ctx.rotate(off + (k * TAU) / n);
      ctx.translate(0, -r0);
      ctx.lineWidth = lw;
      petal(ctx, len, wid);
      ctx.fillStyle = c1;
      ctx.fill();
      ctx.stroke();
      petal(ctx, len * 0.6, wid * 0.45);
      ctx.fillStyle = c2;
      ctx.fill();
      ctx.stroke();
      circle(ctx, 0, -len * 0.8, Math.max(2, len * 0.05), c3);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r0 * 1.02, 0, TAU);
    ctx.fillStyle = pick(rand, pal);
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.stroke();
    const dot = pick(rand, ['#ffffff', ink, '#ffd6a5']);
    for (let k = 0; k < n * 2; k++) {
      const a = (k * TAU) / (n * 2);
      circle(ctx, Math.cos(a) * r0 * 0.9, Math.sin(a) * r0 * 0.9, Math.max(1.5, R * 0.01), dot);
    }
  }
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.06, 0, TAU);
  ctx.fillStyle = pick(rand, pal);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
}

// ----- Sunset lake -----

function paintSunset(ctx, S, rand) {
  const R = (a, b) => a + rand() * (b - a);
  const hz = S * 0.56;

  let g = ctx.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#2d2357');
  g.addColorStop(0.35, '#7b3f7f');
  g.addColorStop(0.65, '#e0607a');
  g.addColorStop(0.85, '#f79a5b');
  g.addColorStop(1, '#ffd47e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, hz);
  for (let i = 0; i < 120; i++) circle(ctx, R(0, S), R(0, 0.25) * S, R(0.6, 1.8), `rgba(255, 255, 255, ${R(0.3, 0.9)})`);

  const sx = S * 0.5, sy = hz - S * 0.02;
  g = ctx.createRadialGradient(sx, sy, S * 0.05, sx, sy, S * 0.35);
  g.addColorStop(0, 'rgba(255, 230, 160, 0.8)');
  g.addColorStop(1, 'rgba(255, 230, 160, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, hz);
  circle(ctx, sx, sy, S * 0.09, '#fff1b8');

  for (let i = 0; i < 10; i++) {
    ellipse(ctx, R(0, S), R(0.12, 0.45) * S, R(0.08, 0.2) * S, R(0.006, 0.014) * S, 0,
      rand() < 0.5 ? 'rgba(255, 190, 170, 0.55)' : 'rgba(150, 80, 140, 0.5)');
  }

  const ridge = (amp) => {
    const f1 = R(4, 7), f2 = R(11, 17), p1 = R(0, 6), p2 = R(0, 6);
    const hs = [];
    let walk = 0;
    for (let x = 0; x <= S; x += 10) {
      walk = Math.max(-0.15, Math.min(0.15, walk + (rand() - 0.5) * 0.06));
      const t = x / S;
      hs.push(amp * (0.55 + 0.3 * Math.sin(t * f1 + p1) + 0.12 * Math.sin(t * f2 + p2) + walk));
    }
    return hs;
  };
  const fillRidge = (hs, dir, color) => {
    ctx.beginPath();
    ctx.moveTo(0, hz);
    hs.forEach((h, i) => ctx.lineTo(i * 10, hz - dir * h));
    ctx.lineTo(S, hz);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const ridges = [
    { hs: ridge(S * 0.17), color: '#8c5a99' },
    { hs: ridge(S * 0.11), color: '#5e3a78' },
    { hs: ridge(S * 0.06), color: '#3a2558' },
  ];
  for (const r of ridges) fillRidge(r.hs, 1, r.color);

  const trees = [];
  for (let i = 0; i < 46; i++) {
    const left = i % 2 === 0;
    trees.push({ x: left ? R(0, 0.36) * S : R(0.64, 1) * S, h: R(0.03, 0.075) * S });
  }
  for (const t of trees) pine(ctx, t.x, hz, t.h, '#24163b', 1);

  g = ctx.createLinearGradient(0, hz, 0, S * 0.88);
  g.addColorStop(0, '#ffcf86');
  g.addColorStop(0.4, '#d3577a');
  g.addColorStop(1, '#3a2558');
  ctx.fillStyle = g;
  ctx.fillRect(0, hz, S, S - hz);

  ctx.save();
  ctx.globalAlpha = 0.35;
  for (const r of ridges) fillRidge(r.hs.map((h) => h * 0.8), -1, r.color);
  for (const t of trees) pine(ctx, t.x, hz, t.h * 0.8, '#24163b', -1);
  ctx.restore();

  for (let i = 0; i < 80; i++) {
    const y = hz + R(0.005, 0.28) * S;
    const w = S * 0.14 * (1 - (y - hz) / (0.32 * S)) * R(0.4, 1.2);
    ctx.fillStyle = `rgba(255, 235, 170, ${R(0.4, 0.9)})`;
    ctx.fillRect(sx - w / 2 + R(-15, 15), y, w, R(2, 5));
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(R(0, S), R(hz, S * 0.88), R(10, 60), 2);
  }

  ctx.strokeStyle = '#2a1a3a';
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const bx = R(0.15, 0.85) * S, by = R(0.12, 0.38) * S, w = R(10, 22);
    ctx.lineWidth = w * 0.18;
    ctx.beginPath();
    ctx.moveTo(bx - w, by - w * 0.3);
    ctx.quadraticCurveTo(bx - w * 0.4, by - w * 0.5, bx, by);
    ctx.quadraticCurveTo(bx + w * 0.4, by - w * 0.5, bx + w, by - w * 0.3);
    ctx.stroke();
  }

  // Lily pads with pink flowers near the shore.
  for (let i = 0; i < 14; i++) {
    const x = R(0.05, 0.95) * S, y = R(0.78, 0.88) * S, r = R(0.02, 0.04) * S, a = R(0, TAU);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.ellipse(x, y, r, r * 0.4, 0, a, a + TAU - 0.6);
    ctx.closePath();
    ctx.fillStyle = rand() < 0.5 ? '#2f5d3a' : '#3d7048';
    ctx.fill();
    if (rand() < 0.5) {
      for (let k = 0; k < 6; k++) {
        const pa = (k * TAU) / 6;
        ellipse(ctx, x + Math.cos(pa) * r * 0.25, y - r * 0.2 + Math.sin(pa) * r * 0.1, r * 0.25, r * 0.12, pa, '#f7a1c4');
      }
      circle(ctx, x, y - r * 0.2, r * 0.1, '#ffe27a');
    }
  }

  // Dark shore with reeds and cattails.
  ctx.beginPath();
  ctx.moveTo(0, S);
  for (let x = 0; x <= S; x += 20) ctx.lineTo(x, S * 0.9 + Math.sin(x / 90) * S * 0.015 + Math.sin(x / 37) * 6);
  ctx.lineTo(S, S);
  ctx.closePath();
  ctx.fillStyle = '#1d1230';
  ctx.fill();
  for (let i = 0; i < 90; i++) {
    const x = rand() < 0.5 ? R(0, 0.3) * S : R(0.7, 1) * S;
    const base = S * 0.93, h = R(0.06, 0.16) * S, bend = R(-30, 30);
    ctx.strokeStyle = rand() < 0.5 ? '#1d1230' : '#2b1d40';
    ctx.lineWidth = R(2, 4);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + bend * 0.3, base - h * 0.6, x + bend, base - h);
    ctx.stroke();
    if (rand() < 0.3) ellipse(ctx, x + bend, base - h, 5, 16, bend / 200, '#3b2416');
  }
}

function pine(ctx, x, base, h, color, dir) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const y0 = base - dir * h * (0.15 + k * 0.28);
    const w = h * (0.32 - k * 0.07);
    ctx.moveTo(x - w, y0);
    ctx.lineTo(x, y0 - dir * h * 0.42);
    ctx.lineTo(x + w, y0);
    ctx.closePath();
  }
  ctx.fill();
  ctx.fillRect(x - h * 0.03, dir > 0 ? base - h * 0.15 : base, h * 0.06, h * 0.15);
}
