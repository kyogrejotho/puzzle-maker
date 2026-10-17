// Gentle sound effects made with the Web Audio API (no sound files needed).

let ac = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

// Browsers only allow audio after the person touches the screen,
// so this is called from the first touch on a piece.
export function unlockAudio() {
  if (!enabled) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

function tone(freq, start, dur, { type = 'sine', vol = 0.12, slideTo } = {}) {
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.6);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function playSnap() {
  if (!enabled || !ac) return;
  tone(660, 0, 0.14, { slideTo: 990, vol: 0.1 });
}

export function playCheer() {
  if (!enabled || !ac) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.13, 0.5, { type: 'triangle', vol: 0.12 }));
}
