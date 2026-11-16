// All sound is synthesized with WebAudio — no audio files, no network.
// Every effect is a short oscillator or noise burst with an envelope; the context
// is created lazily on the first user gesture, and everything no-ops until then
// (headless screenshot runs simply stay silent).
let ctx = null;
let muted = false;
let padNodes = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    startPad();
  } catch (e) {
    ctx = null;
  }
}

export function setMuted(value) {
  muted = value;
  if (padNodes) padNodes.gain.gain.value = value ? 0 : 0.05;
}
export function isMuted() {
  return muted;
}

// A very quiet two-note night pad under the game, so the garden feels alive.
function startPad() {
  try {
    const gain = ctx.createGain();
    gain.gain.value = muted ? 0 : 0.05;
    gain.connect(ctx.destination);
    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 110;
    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 164.81;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    oscA.start();
    oscB.start();
    lfo.start();
    padNodes = { gain, oscA, oscB, lfo };
  } catch (e) {
    padNodes = null;
  }
}

function blip(freqFrom, freqTo, duration, type, volume, delay = 0) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch (e) {
    /* silent */
  }
}

function noiseBurst(duration, volume, filterFreq) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
  } catch (e) {
    /* silent */
  }
}

export const sfx = {
  // Pickup chime: pitch climbs with the combo, so a hot streak sounds hot.
  pickup(combo) {
    const base = 620 * Math.pow(1.059, Math.min(combo, 12));
    blip(base, base * 1.5, 0.14, 'sine', 0.16);
  },
  // Lighting a lamp: a warm little arpeggio.
  lamp() {
    blip(523.25, 523.25, 0.12, 'triangle', 0.18);
    blip(659.25, 659.25, 0.12, 'triangle', 0.18, 0.07);
    blip(783.99, 783.99, 0.2, 'triangle', 0.18, 0.14);
  },
  // Getting hit: a low thud.
  hit() {
    blip(180, 55, 0.25, 'sawtooth', 0.22);
    noiseBurst(0.15, 0.12, 300);
  },
  // Dash: a quick airy whoosh.
  dash() {
    noiseBurst(0.16, 0.14, 1400);
  },
  // Scaring a bat off with a dash: a bright chirp.
  scare() {
    blip(880, 1560, 0.12, 'square', 0.08);
  },
  // Level clear: a rising major arpeggio.
  clear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, f, 0.18, 'triangle', 0.16, i * 0.09));
  },
  // Game over: a short descending line.
  over() {
    [392, 329.63, 261.63, 196].forEach((f, i) => blip(f, f * 0.94, 0.22, 'triangle', 0.15, i * 0.13));
  },
  // Button / start blip.
  ui() {
    blip(440, 660, 0.08, 'sine', 0.12);
  },
};
