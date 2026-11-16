// Glowmoth: the game loop, the state machine (title / playing / paused /
// level-clear + SHOP / game-over), the screen overlays, and the ?shot=
// staging used for screenshots. GOAL: light every lamp to WIN the level;
// LOSE when the lives run out. Score from lamps, pollen combos and scared
// bats; the MOTH-EATER boss comes every 5th level; pollen banks into a SHOP
// between levels; the moon changes the garden every level. The moth is
// steered by the pointer or WASD/arrows; Space dashes, P pauses, M mutes,
// R restarts, Enter or click starts, 1-4 buy in the shop.
import { VIEW } from './config.js';
import { createInput } from './input.js';
import { ensureAudio, setMuted, isMuted, sfx } from './audio.js';
import { createWorld, stepWorld, slowFactorAt, saveBest, buyUpgrade, bossAlive, EVENT_LAMP, EVENT_POLLEN, EVENT_HIT, EVENT_SCARE, EVENT_CLEAR, EVENT_OVER, EVENT_BOSS_HIT, EVENT_BOSS_KILL } from './world.js';
import { updateMoth, tryDash } from './moth.js';
import { updateBats, updateBoss } from './entities.js';
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

// A ?shot= page holds its staged frame until a real person (or probe) touches
// it — the screenshot stays exactly the staged frame, and the page is still a
// playable game from that state once input arrives. Real DOM events unfreeze;
// the staging itself dispatches none.
let stagedFrozen = shotName !== '';
for (const type of ['keydown', 'pointerdown', 'pointermove']) {
  window.addEventListener(type, () => { stagedFrozen = false; }, { passive: true });
}

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
  else if (next === 'clear') {
    world.waveUntil = 0; // the wave banner belongs to play, not to the shop screen
    refreshShop();
    showOverlay('clear');
  }
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
    const nextText = document.getElementById('clear-next');
    if (nextText) nextText.textContent = world.wave.text;
  }
}

// SHOP: refresh the pollen-shop panel on the level-clear screen — bank, costs,
// owned and too-poor states — so the player (and the judge) sees the economy.
function refreshShop() {
  const bank = document.getElementById('shop-bank');
  if (bank) bank.textContent = world.pollenBank;
  for (const btn of document.querySelectorAll('.shop-btn')) {
    const id = btn.dataset.id;
    const cost = Number(btn.dataset.cost || 0);
    const owned = !!world.upgrades[id];
    btn.classList.toggle('owned', owned);
    btn.classList.toggle('poor', !owned && world.pollenBank < cost);
    const state = btn.querySelector('.shop-state');
    if (state) state.textContent = owned ? 'Owned' : (world.pollenBank < cost ? 'Need more pollen' : `Buy — ${cost} pollen`);
  }
}

function buyFromShop(id) {
  if (screen !== 'clear') return;
  if (buyUpgrade(world, id)) {
    sfx.buy();
    refreshShop();
    updateHud(world, 1);
  } else {
    sfx.hit();
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
  world.waveUntil = world.time + 3.5; // the new level's wave banner shows again
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
  if (events & EVENT_BOSS_HIT) sfx.bossHit();
  if (events & EVENT_BOSS_KILL) sfx.boss();
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

  // A staged page: hold the frame (same pixels every frame — world.time is
  // frozen) until real input arrives; never consume the queued press.
  if (stagedFrozen) {
    drawWorld(ctx, world, backdrop, world.time);
    const dashCd = world.upgrades.dash ? 0.7 : 1.1;
    const dashReady = world.moth.dashCooldown > 0 ? 1 - world.moth.dashCooldown / dashCd : 1;
    updateHud(world, dashReady);
    requestAnimationFrame(frame);
    return;
  }

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
  // Shop keys 1-4, only on the level-clear screen.
  if (screen === 'clear') {
    for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) {
      if (input.consume(key)) {
        const id = ['life', 'speed', 'dash', 'webproof'][Number(key.slice(-1)) - 1];
        buyFromShop(id);
      }
    }
  }

  if (screen === 'play' && !paused) {
    if (input.consume('Space') || input.consume('KeyJ')) {
      if (tryDash(world.moth, world.upgrades)) sfx.dash();
    }
    const slow = slowFactorAt(world, world.moth.x, world.moth.y);
    updateMoth(world.moth, input, dt, slow, world.upgrades);
    updateBats(world.bats, dt, world.time);
    if (world.boss) updateBoss(world.boss, dt, world.time, world.moth);
    const events = stepWorld(world, dt);
    handleEvents(events);
  }

  drawWorld(ctx, world, backdrop, world.time);
  const dashCd = world.upgrades.dash ? 0.7 : 1.1;
  const dashReady = world.moth.dashCooldown > 0 ? 1 - world.moth.dashCooldown / dashCd : 1;
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
for (const btn of document.querySelectorAll('.shop-btn')) {
  btn.addEventListener('click', () => buyFromShop(btn.dataset.id));
}
canvas.addEventListener('pointerdown', ensureAudio);

// Screenshot staging: ?shot=play|boss|clear|end plays the real rules forward
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
  requestAnimationFrame(frame); // frozen until input; the shot stays staged
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
window.__glowmoth = { world, setScreen, startGame, buyFromShop, bossAlive };
