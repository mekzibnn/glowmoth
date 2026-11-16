// Glowmoth: the game loop, the state machine (title / playing / paused /
// level-clear / game-over), the screen overlays, and the ?shot= staging used
// for screenshots. The moth is steered by the pointer or WASD/arrows; Space
// dashes, P pauses, M mutes, R restarts, Enter or click starts.
import { VIEW } from './config.js';
import { createInput } from './input.js';
import { ensureAudio, setMuted, isMuted, sfx } from './audio.js';
import { createWorld, stepWorld, slowFactorAt, saveBest, EVENT_LAMP, EVENT_POLLEN, EVENT_HIT, EVENT_SCARE, EVENT_CLEAR, EVENT_OVER } from './world.js';
import { updateMoth, tryDash } from './moth.js';
import { updateBats } from './entities.js';
import { drawWorld, makeBackdrop, updateHud } from './render.js';
import { stageShot } from './shots.js';
import { makeRng, randomSeed } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 0) || randomSeed();
const shotName = params.get('shot') || '';

const world = createWorld(seed);
const backdrop = makeBackdrop(makeRng(seed ^ 0x9e3779b9));
let screen = 'title'; // title | play | pause | clear | over
let clearBonus = 0;
let lastTime = performance.now();
let paused = false;

window.__shotReady = false;

const overlays = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  clear: document.getElementById('screen-clear'),
  over: document.getElementById('screen-over'),
};

function showOverlay(name) {
  for (const [key, el] of Object.entries(overlays)) {
    if (el) el.classList.toggle('hidden', key !== name);
  }
  const hud = document.getElementById('hud');
  if (hud) hud.classList.toggle('dim', name === 'title');
}

function setScreen(next) {
  screen = next;
  if (next === 'title') {
    const bestEl = document.getElementById('title-best');
    if (bestEl) bestEl.textContent = world.best;
    showOverlay('title');
  } else if (next === 'pause') showOverlay('pause');
  else if (next === 'clear') showOverlay('clear');
  else if (next === 'over') showOverlay('over');
  else showOverlay(null);
  if (next === 'over') {
    const finalScore = document.getElementById('final-score');
    if (finalScore) finalScore.textContent = world.score;
    const bestScore = document.getElementById('best-score');
    if (bestScore) bestScore.textContent = world.best;
    const newBest = document.getElementById('new-best');
    if (newBest) newBest.classList.toggle('hidden', world.score < world.best || world.score === 0);
  }
  if (next === 'clear') {
    const bonus = document.getElementById('clear-bonus');
    if (bonus) bonus.textContent = clearBonus;
    const levelNow = document.getElementById('clear-level');
    if (levelNow) levelNow.textContent = world.level;
  }
}

function startGame() {
  ensureAudio();
  sfx.ui();
  const fresh = createWorld(randomSeed());
  // Keep the same objects the renderer holds: copy fresh state over.
  Object.assign(world, fresh);
  setScreen('play');
}

function continueAfterClear() {
  ensureAudio();
  sfx.ui();
  setScreen('play');
}

function togglePause() {
  if (screen !== 'play' && screen !== 'pause') return;
  paused = screen === 'play';
  setScreen(paused ? 'pause' : 'play');
}

function toggleMute() {
  ensureAudio();
  setMuted(!isMuted());
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = isMuted() ? '🔇' : '🔊';
}

function handleEvents(events) {
  if (events & EVENT_LAMP) sfx.lamp();
  if (events & EVENT_POLLEN) sfx.pickup(world.combo);
  if (events & EVENT_HIT) sfx.hit();
  if (events & EVENT_SCARE) sfx.scare();
  if (events & EVENT_CLEAR) {
    // The world already advanced a level and banked the bonus; show the screen.
    clearBonus = 200 + 100 * (world.level - 1) + 25 * world.lives;
    sfx.clear();
    setScreen('clear');
  }
  if (events & EVENT_OVER) {
    sfx.over();
    setScreen('over');
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // Global keys, whatever the screen.
  if (input.consume('KeyM')) toggleMute();
  if (screen === 'title' && (input.consume('Enter') || input.consume('Space') || input.consume('pointer'))) {
    startGame();
  } else if (screen === 'clear' && (input.consume('Enter') || input.consume('Space') || input.consume('pointer'))) {
    continueAfterClear();
  } else if (screen === 'over' && (input.consume('KeyR') || input.consume('Enter') || input.consume('Space') || input.consume('pointer'))) {
    startGame();
  } else if (input.consume('KeyP') || input.consume('Escape')) {
    togglePause();
  }
  if (screen === 'pause' && input.consume('KeyR')) startGame();

  if (screen === 'play' && !paused) {
    if (input.consume('Space') || input.consume('KeyJ')) {
      if (tryDash(world.moth)) sfx.dash();
    }
    const slow = slowFactorAt(world, world.moth.x, world.moth.y);
    updateMoth(world.moth, input, dt, slow);
    updateBats(world.bats, dt, world.time);
    const events = stepWorld(world, dt);
    handleEvents(events);
  }

  drawWorld(ctx, world, backdrop, world.time);
  const dashReady = world.moth.dashCooldown > 0 ? 1 - world.moth.dashCooldown / 1.1 : 1;
  updateHud(world, dashReady);
  input.endFrame();
  requestAnimationFrame(frame);
}

// Buttons on the overlays.
document.getElementById('start-btn')?.addEventListener('click', () => {
  if (screen === 'title') startGame();
});
document.getElementById('again-btn')?.addEventListener('click', () => {
  if (screen === 'over') startGame();
});
document.getElementById('next-btn')?.addEventListener('click', () => {
  if (screen === 'clear') continueAfterClear();
});
document.getElementById('resume-btn')?.addEventListener('click', () => {
  if (screen === 'pause') togglePause();
});
document.getElementById('mute-btn')?.addEventListener('click', toggleMute);
canvas.addEventListener('pointerdown', ensureAudio);

// Screenshot staging: ?shot=start|play|clear|end plays the real rules forward
// and leaves the game on that screen; the frame is then a real render.
if (shotName) {
  const staged = stageShot(shotName, world, input);
  if (staged.screen === 'title') setScreen('title');
  else if (staged.screen === 'clear') {
    clearBonus = 200 + 100 * (world.level - 1) + 25 * world.lives;
    setScreen('clear');
  } else if (staged.screen === 'over') {
    setScreen('over');
  } else {
    setScreen('play');
  }
  drawWorld(ctx, world, backdrop, world.time);
  updateHud(world, 1);
  window.__shotReady = true;
} else {
  const bestEl = document.getElementById('title-best');
  if (bestEl) bestEl.textContent = world.best;
  setScreen('title');
  drawWorld(ctx, world, backdrop, 0);
  updateHud(world, 1);
  window.__shotReady = true;
  requestAnimationFrame(frame);
}

// Expose a tiny handle for the screenshot script (state + staging only).
window.__glowmoth = { world, setScreen, startGame };
