// Screens and flow: home page, picking a picture and size, playing, saving and celebrating.

import { PICTURES, renderPicture } from './pictures.js';
import { Puzzle } from './puzzle.js';
import { photos } from './storage.js';
import { setSoundEnabled, playCheer } from './sound.js';
import { randomSeed } from './util.js';

const $ = (sel) => document.querySelector(sel);

const SIZES = [
  { n: 12, label: 'Easy' },
  { n: 24, label: 'Medium' },
  { n: 48, label: 'Harder' },
  { n: 96, label: 'Hardest' },
];
const SAVE_KEY = 'puzzles.current';
const SETTINGS_KEY = 'puzzles.settings';
const MAX_PHOTO_SIDE = 1600;
const MAX_PHOTO_ASPECT = 1.6; // very tall or wide photos get trimmed so pieces stay a good size
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

// Columns and rows that give roughly n pieces that are close to square.
function gridFor(n, aspect) {
  const cols = Math.max(2, Math.round(Math.sqrt(n * aspect)));
  return { cols, rows: Math.max(2, Math.round(n / cols)) };
}

// localStorage can throw (private browsing, full storage), so never let it break the app.
const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

const settings = { sound: true, hint: true, lastSize: 24, ...store.get(SETTINGS_KEY, {}) };
const saveSettings = () => store.set(SETTINGS_KEY, settings);

const builtinCache = new Map();
let puzzle = null;
let current = null; // { source, n, seed, thumb, cols, rows }
let pending = null; // picture chosen, waiting for a size
let saveTimer = 0;

// ----- Pictures -----

function builtin(id) {
  let entry = builtinCache.get(id);
  if (!entry) {
    const canvas = renderPicture(id);
    entry = { canvas, thumb: thumbFrom(canvas, 320) };
    builtinCache.set(id, entry);
  }
  return entry;
}

function thumbFrom(img, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const s = Math.min(img.width, img.height);
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.85);
}

// Decode a photo straight into a canvas of the size we want. Going through a smaller
// canvas avoids iPhone limits on very large images.
async function decodeInto(blob, crop) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const { sx, sy, sw, sh, scale } = crop(w, h);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * scale));
    c.height = Math.max(1, Math.round(sh * scale));
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function importPhoto(file) {
  const canvas = await decodeInto(file, (w, h) => {
    let sx = 0, sy = 0, sw = w, sh = h;
    if (w / h > MAX_PHOTO_ASPECT) { sw = h * MAX_PHOTO_ASPECT; sx = (w - sw) / 2; }
    else if (h / w > MAX_PHOTO_ASPECT) { sh = w * MAX_PHOTO_ASPECT; sy = (h - sh) / 2; }
    return { sx, sy, sw, sh, scale: Math.min(1, MAX_PHOTO_SIDE / Math.max(sw, sh)) };
  });
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save photo'))), 'image/jpeg', 0.9));
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    blob,
    thumb: thumbFrom(canvas, 240),
    aspect: canvas.width / canvas.height,
    added: Date.now(),
  };
}

async function loadSource(source) {
  if (source.type === 'builtin') {
    const { canvas } = builtin(source.id);
    if (!canvas) throw new Error('Unknown picture');
    return canvas;
  }
  const rec = await photos.get(source.id);
  if (!rec) throw new Error('Photo not found');
  return decodeInto(rec.blob, (w, h) => ({ sx: 0, sy: 0, sw: w, sh: h, scale: 1 }));
}

// ----- Home screen -----

function makeCard(name, src) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  const img = document.createElement('img');
  img.alt = '';
  if (src) img.src = src;
  const label = document.createElement('span');
  label.className = 'name';
  label.textContent = name;
  card.append(img, label);
  return card;
}

function renderBuiltins() {
  const grid = $('#builtin');
  grid.textContent = '';
  PICTURES.forEach((pic, i) => {
    const card = makeCard(pic.name);
    card.addEventListener('click', () => chooseSize({ type: 'builtin', id: pic.id }, builtin(pic.id).thumb, 1));
    grid.append(card);
    // Paint the pictures one at a time so the page shows up straight away.
    setTimeout(() => { card.querySelector('img').src = builtin(pic.id).thumb; }, 40 * (i + 1));
  });
}

async function renderPhotos() {
  const grid = $('#my-photos');
  grid.querySelectorAll('.photo').forEach((n) => n.remove());
  let list = [];
  try { list = await photos.all(); } catch {}
  list.sort((a, b) => b.added - a.added);
  for (const rec of list) {
    const wrap = document.createElement('div');
    wrap.className = 'photo';
    const card = makeCard('', rec.thumb);
    card.setAttribute('aria-label', 'Make a puzzle from this photo');
    card.addEventListener('click', () => chooseSize({ type: 'photo', id: rec.id }, rec.thumb, rec.aspect || 1));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.setAttribute('aria-label', 'Remove this photo');
    remove.textContent = '×';
    remove.addEventListener('click', () => removePhoto(rec));
    wrap.append(card, remove);
    grid.append(wrap);
  }
}

function refreshContinue() {
  const saved = store.get(SAVE_KEY);
  const btn = $('#continue-btn');
  if (!saved) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  $('#continue-thumb').src = saved.thumb || '';
  $('#continue-info').textContent = `${saved.placed} of ${saved.total} pieces done`;
}

function updateSoundButton() {
  const btn = $('#sound-btn');
  btn.setAttribute('aria-pressed', String(settings.sound));
  btn.querySelector('span').textContent = settings.sound ? 'Sound on' : 'Sound off';
}

async function removePhoto(rec) {
  const ok = await confirmBox('Remove this photo?', "It's only removed from this app, not from your phone.", 'Remove');
  if (!ok) return;
  try { await photos.remove(rec.id); } catch {}
  const saved = store.get(SAVE_KEY);
  if (saved?.source.type === 'photo' && saved.source.id === rec.id) store.remove(SAVE_KEY);
  await renderPhotos();
  refreshContinue();
}

// ----- Choosing a puzzle -----

function chooseSize(source, thumb, aspect) {
  pending = { source, thumb };
  $('#size-preview').src = thumb;
  document.querySelectorAll('.size-btn').forEach((b) => {
    const n = Number(b.dataset.n);
    const { cols, rows } = gridFor(n, aspect);
    b.querySelector('strong').textContent = cols * rows;
    b.classList.toggle('last', n === settings.lastSize);
  });
  $('#size-dialog').showModal();
}

async function startNew(n) {
  const { source, thumb } = pending;
  const saved = store.get(SAVE_KEY);
  if (saved && saved.placed > 0) {
    const ok = await confirmBox('Start a new puzzle?', 'Your unfinished puzzle will be cleared.', 'Start new', 'Keep it');
    if (!ok) return;
  }
  settings.lastSize = n;
  saveSettings();
  await openPuzzle({ source, n, thumb, seed: randomSeed() });
}

async function openPuzzle(info, state) {
  showBusy('Cutting the pieces…');
  let image;
  try {
    image = await loadSource(info.source);
  } catch {
    hideBusy();
    store.remove(SAVE_KEY);
    refreshContinue();
    await confirmBox('Sorry', "That picture couldn't be opened.", 'OK', null);
    return;
  }
  hideBusy();

  const { cols, rows } = info.cols ? info : gridFor(info.n, image.width / image.height);
  current = { source: info.source, n: info.n, seed: info.seed, thumb: info.thumb, cols, rows };

  showScreen('play');
  if (history.state?.screen === 'play') history.replaceState({ screen: 'play' }, '');
  else history.pushState({ screen: 'play' }, '');
  $('#done').hidden = true;
  stopConfetti();

  puzzle?.destroy();
  puzzle = new Puzzle($('#board'), {
    image,
    cols,
    rows,
    seed: info.seed,
    saved: state,
    hint: settings.hint,
    onPlace: updateProgress,
    onChange: scheduleSave,
    onComplete: celebrate,
  });
  if (IS_LOCAL) window.puzzle = puzzle; // handy for poking at it from the browser console
  updateProgress(puzzle.placedCount, puzzle.total);
  scheduleSave();
}

function updateProgress(placed, total) {
  $('#progress').textContent = `${placed} of ${total}`;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

function saveNow() {
  clearTimeout(saveTimer);
  if (!puzzle || !current || puzzle.complete) return;
  store.set(SAVE_KEY, {
    ...current,
    state: puzzle.getState(),
    placed: puzzle.placedCount,
    total: puzzle.total,
    updated: Date.now(),
  });
}

function celebrate() {
  clearTimeout(saveTimer);
  store.remove(SAVE_KEY);
  playCheer();
  setTimeout(() => {
    if (!puzzle?.complete) return;
    $('#done-text').textContent = `All ${puzzle.total} pieces are in place.`;
    $('#done').hidden = false;
    startConfetti();
  }, 1000);
}

function goHome() {
  saveNow();
  puzzle?.destroy();
  puzzle = null;
  current = null;
  stopConfetti();
  showScreen('home');
  refreshContinue();
}

function showScreen(name) {
  $('#home').hidden = name !== 'home';
  $('#play').hidden = name !== 'play';
  if (name === 'home') window.scrollTo(0, 0);
}

// ----- Dialogs -----

function confirmBox(title, text, okLabel, cancelLabel = 'Cancel') {
  const dlg = $('#confirm-dialog');
  const ok = $('#confirm-ok');
  const cancel = $('#confirm-cancel');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  ok.textContent = okLabel;
  cancel.hidden = !cancelLabel;
  cancel.textContent = cancelLabel || '';
  dlg.showModal();
  return new Promise((resolve) => {
    const finish = (value) => {
      ok.onclick = cancel.onclick = dlg.oncancel = null;
      if (dlg.open) dlg.close();
      resolve(value);
    };
    ok.onclick = () => finish(true);
    cancel.onclick = () => finish(false);
    dlg.oncancel = () => finish(false);
  });
}

function showBusy(text) {
  $('#busy-text').textContent = text;
  $('#busy').hidden = false;
}

function hideBusy() {
  $('#busy').hidden = true;
}

// ----- Confetti -----

let confettiRaf = 0;

function startConfetti() {
  const canvas = $('#confetti');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  const colors = ['#b8456b', '#f4a261', '#e9c46a', '#2a9d8f', '#9b5de5', '#4cc9f0', '#f28482'];
  const bits = Array.from({ length: 160 }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.6,
    w: 6 + Math.random() * 8,
    h: 4 + Math.random() * 6,
    vy: 1.5 + Math.random() * 2.5,
    vx: (Math.random() - 0.5) * 1.5,
    a: Math.random() * Math.PI,
    va: (Math.random() - 0.5) * 0.2,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  cancelAnimationFrame(confettiRaf);
  const frame = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const b of bits) {
      b.x += b.vx + Math.sin((now - start) / 400 + b.a) * 0.6;
      b.y += b.vy;
      b.a += b.va;
      if (b.y < H + 20) alive = true;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    confettiRaf = alive ? requestAnimationFrame(frame) : 0;
  };
  confettiRaf = requestAnimationFrame(frame);
}

function stopConfetti() {
  cancelAnimationFrame(confettiRaf);
  confettiRaf = 0;
  const c = $('#confetti');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

// ----- Wiring -----

function init() {
  if (history.state?.screen) history.replaceState(null, '');
  setSoundEnabled(settings.sound);
  updateSoundButton();
  renderBuiltins();
  renderPhotos();
  refreshContinue();

  const grid = $('#size-grid');
  for (const s of SIZES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-btn';
    btn.dataset.n = s.n;
    btn.innerHTML = `<strong>${s.n}</strong><span>${s.label}</span>`;
    btn.addEventListener('click', () => {
      $('#size-dialog').close();
      startNew(s.n);
    });
    grid.append(btn);
  }
  $('#size-cancel').addEventListener('click', () => $('#size-dialog').close());

  $('#photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    showBusy('Adding your photo…');
    let rec;
    try {
      rec = await importPhoto(file);
      await photos.put(rec);
    } catch {
      hideBusy();
      await confirmBox('Sorry', "That photo couldn't be added. Please try a different one.", 'OK', null);
      return;
    }
    hideBusy();
    await renderPhotos();
    chooseSize({ type: 'photo', id: rec.id }, rec.thumb, rec.aspect);
  });

  $('#continue-btn').addEventListener('click', () => {
    const saved = store.get(SAVE_KEY);
    if (saved) openPuzzle(saved, saved.state);
  });

  $('#sound-btn').addEventListener('click', () => {
    settings.sound = !settings.sound;
    setSoundEnabled(settings.sound);
    saveSettings();
    updateSoundButton();
  });

  $('#home-btn').addEventListener('click', () => {
    if (history.state?.screen === 'play') history.back();
    else goHome();
  });
  window.addEventListener('popstate', () => {
    if (!$('#play').hidden) goHome();
  });

  const hintBtn = $('#hint-btn');
  hintBtn.setAttribute('aria-pressed', String(settings.hint));
  hintBtn.addEventListener('click', () => {
    settings.hint = !settings.hint;
    saveSettings();
    hintBtn.setAttribute('aria-pressed', String(settings.hint));
    puzzle?.setHint(settings.hint);
  });

  $('#spread-btn').addEventListener('click', () => puzzle?.scatter());
  $('#again-btn').addEventListener('click', () => current && openPuzzle({ ...current, seed: randomSeed() }));
  $('#another-btn').addEventListener('click', () => $('#home-btn').click());

  document.addEventListener('visibilitychange', () => document.hidden && saveNow());
  window.addEventListener('pagehide', saveNow);
  // Stop iPhones from zooming the page when pinching on the puzzle.
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // Ask the browser not to clear her photos when the phone is low on space.
  navigator.storage?.persist?.().catch(() => {});

  // Offline support. Skipped on this computer so changes show up immediately while building.
  if ('serviceWorker' in navigator && !IS_LOCAL) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
