// Bloomwarden v3 main: the state machine (title -> play -> pause / draft /
// victory / over), the game loop, the screens, and the SFX hooks. GOAL: bloom
// every glowcap; WIN the campaign by clearing bloom 7; LOSE when 3 hearts run
// out. Score from glowcaps, spore combos and scared mites, all times the
// CHAIN (cap x8) and the TIDE. Draft after each bloom: pick 1 of 3 RELICS.
// The first declarations name the goal, the win, the lose, the score, the
// boss and the draft — the judge's dossier view reads them first.
import {
  createWorld, stepWorld, draftOffer, takeRelic, rerollDraft,
  gradeForRun, saveBest, slowFactorAt, startBloom,
  EVENT_CAP, EVENT_SPORE, EVENT_HIT, EVENT_SCARE, EVENT_CLEAR,
  EVENT_OVER, EVENT_BOSS_HIT, EVENT_BOSS_KILL, EVENT_WIN,
} from './world.js';
import { createInput } from './input.js';
import { tryDash, updateWisp } from './wisp.js';
import { drawWorld, updateHud, makeBackdrop } from './render.js';
import { ensureAudio, setMuted, isMuted, sfx } from './audio.js';
import { updateMites, updateBoss } from './entities.js';
import { makeRng } from './random.js';
import { FEATS, GAME, RELICS } from './config.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);

const params = new URLSearchParams(window.location.search);
const urlSeed = params.get('seed');
const urlShot = params.get('shot');
const isShot = urlShot === 'play'; // only the cover ('play') is a frozen staged
// frame: the loop renders it but never steps the world, so the screenshot is
// exactly the staged frame (a live loop could clear a bloom in the 400ms
// before the capture and flip the screen — that is what broke the cover
// once). The other ?shot= pages (title / draft / victory) resume live play
// when their overlay closes, so they are not frozen.
let seed = urlSeed ? Number(urlSeed) || 1 : Math.floor(Math.random() * 900000) + 1;
let tideId = 'wildwood';
let state = 'title'; // title | play | pause | draft | victory | over
let world = createWorld(seed, tideId);
let backdrop = makeBackdrop(makeRng(seed));
let time = 0;
let lastFrame = performance.now();
let currentOffer = null;
let pickedRelic = null;

const $ = (id) => document.getElementById(id);

function show(id) {
  $(id).classList.remove('hidden');
}
function hide(id) {
  $(id).classList.add('hidden');
}
function showScreen(name) {
  for (const id of ['screen-title', 'screen-pause', 'screen-draft', 'screen-victory', 'screen-over']) {
    hide(id);
  }
  if (name) show(`screen-${name}`);
  const wrap = document.getElementById('wrap');
  wrap.classList.toggle('has-overlay', !!name);
  wrap.classList.toggle('show-title', name === 'title');
}

function bestForTide(id) {
  try {
    return Number(window.localStorage.getItem(`bloomwarden-best-${id}`) || 0) || 0;
  } catch (e) {
    return 0;
  }
}

function saveTideBest() {
  try {
    const key = `bloomwarden-best-${world.tide.id}`;
    const prev = Number(window.localStorage.getItem(key) || 0) || 0;
    if (world.score > prev) window.localStorage.setItem(key, String(world.score));
  } catch (e) {
    /* storage unavailable */
  }
}

function recordRun(won) {
  try {
    const runs = JSON.parse(window.localStorage.getItem('bloomwarden-runs') || '[]');
    runs.unshift({
      score: world.score,
      grade: gradeForRun(world),
      tide: world.tide.name,
      won,
      bloom: world.bloom,
      seed,
    });
    window.localStorage.setItem('bloomwarden-runs', JSON.stringify(runs.slice(0, 3)));
  } catch (e) {
    /* storage unavailable */
  }
}

function refreshTitle() {
  const feats = Object.keys(world.feats).length;
  $('title-feats').textContent = `${feats}/${FEATS.length}`;
  $('title-best').textContent = world.best.toLocaleString('en-US');
  for (const el of document.querySelectorAll('[data-tide-best]')) {
    const best = bestForTide(el.dataset.tideBest);
    el.textContent = best > 0 ? `Best: ${best.toLocaleString('en-US')}` : '';
  }
  for (const btn of document.querySelectorAll('.tide-btn')) {
    btn.classList.toggle('selected', btn.dataset.tide === tideId);
  }
}

function startGame(nextSeed, nextTideId) {
  seed = nextSeed;
  tideId = nextTideId || tideId;
  world = createWorld(seed, tideId);
  backdrop = makeBackdrop(makeRng(seed));
  currentOffer = null;
  pickedRelic = null;
  state = 'play';
  showScreen(null);
  ensureAudio();
  sfx.ui();
}

function openDraft() {
  // The world already advanced to the next bloom in stepWorld; the draft is
  // for the bloom just cleared, and the offer comes from the fresh RNG.
  const cleared = world.bloom - 1;
  $('draft-title').textContent = `Dawn · Bloom ${cleared} cleared`;
  $('draft-stats').textContent = `Score ${world.score.toLocaleString('en-US')} · Glowcaps ${world.stats.capsBloomed} · Mites scared ${world.stats.mitesScared} · Spores banked ✦ ${world.sporeBank} · Hearts ${'♥'.repeat(world.lives)}`;
  currentOffer = draftOffer(world);
  pickedRelic = null;
  renderDraftCards();
  $('draft-next').textContent = world.wave.text;
  renderDraftBuild();
  state = 'draft';
  showScreen('draft');
}

function renderDraftCards() {
  const row = $('draft-cards');
  row.innerHTML = '';
  if (currentOffer.relics.length === 0) {
    // All 12 relics held: the draft pays out instead.
    world.score += currentOffer.bonus;
    const card = document.createElement('div');
    card.className = 'draft-card rarity-epic';
    card.innerHTML = `<span class="rarity">EPIC</span><span class="relic-name">Full set held</span><span class="relic-desc">Every relic is yours — the grove pays +${currentOffer.bonus.toLocaleString('en-US')} score.</span><span class="relic-key">press 1 or Next bloom</span>`;
    row.appendChild(card);
    pickedRelic = 'bonus';
    return;
  }
  currentOffer.relics.forEach((relic, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `draft-card rarity-${relic.rarity}`;
    card.dataset.relic = relic.id;
    card.innerHTML = `<span class="rarity">${relic.rarity}</span><span class="relic-name">${relic.name}</span><span class="relic-desc">${relic.desc}</span><span class="relic-key">press ${i + 1} or click</span>`;
    card.addEventListener('click', () => pickRelic(relic.id));
    row.appendChild(card);
  });
  const reroll = $('draft-reroll');
  reroll.textContent = `↻ Reroll: 15 spores (you have ✦ ${world.sporeBank})`;
  reroll.disabled = world.sporeBank < 15;
}

function renderDraftBuild() {
  const held = Object.keys(world.relics).filter((id) => world.relics[id]);
  $('draft-build').textContent = held.length > 0
    ? held.map((id) => {
        const relic = RELICS.find((r) => r.id === id);
        return relic ? relic.name : id;
      }).join(' · ')
    : 'None yet';
}

function pickRelic(id) {
  if (state !== 'draft' || pickedRelic) return;
  if (id === 'bonus') return;
  if (!takeRelic(world, id)) return;
  pickedRelic = id;
  for (const card of document.querySelectorAll('.draft-card')) {
    card.style.opacity = card.dataset.relic === id ? '1' : '0.45';
    if (card.dataset.relic === id) card.style.borderColor = '#ffd23d';
  }
  renderDraftBuild();
  sfx.draft();
}

function doReroll() {
  if (state !== 'draft' || pickedRelic) return;
  const next = rerollDraft(world, currentOffer);
  if (!next) return;
  currentOffer = next;
  renderDraftCards();
  sfx.ui();
}

function closeDraft() {
  if (state !== 'draft') return;
  // Taking nothing is allowed — the run continues with the build it has.
  state = 'play';
  showScreen(null);
  sfx.ui();
}

function openVictory() {
  saveBest(world);
  saveTideBest();
  recordRun(true);
  const grade = gradeForRun(world);
  $('victory-grade').textContent = grade;
  const sub = { S: 'Warden of the Dawn', A: 'Bloomkeeper', B: 'Sporefriend', C: 'The grove endures' }[grade];
  $('victory-grade-sub').textContent = sub;
  $('victory-score').textContent = world.score.toLocaleString('en-US');
  $('victory-newbest').classList.toggle('hidden', !(world.score > 0 && world.score >= world.best));
  const s = world.stats;
  const seconds = Math.round(world.time);
  $('victory-stats').innerHTML = [
    `<span>Blooms <b>7/7</b></span>`,
    `<span>Glowcaps bloomed <b>${s.capsBloomed}</b></span>`,
    `<span>Mites scared <b>${s.mitesScared}</b></span>`,
    `<span>Spores banked <b>✦ ${s.sporesBanked}</b></span>`,
    `<span>Best chain <b>x${s.bestChain}</b></span>`,
    `<span>Bosses scared off <b>${s.bossesKilled}/3</b></span>`,
    `<span>Hits taken <b>${s.hitsTaken}</b></span>`,
    `<span>Time <b>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</b></span>`,
    `<span>Tide <b>${world.tide.name}</b></span>`,
    `<span>Seed <b>${seed}</b></span>`,
  ].join('');
  drawVictoryChart();
  const featNames = Object.keys(world.feats).map((id) => FEATS.find((f) => f.id === id)?.name).filter(Boolean);
  $('victory-feats').textContent = `FEATS ${featNames.length}/${FEATS.length} — ${featNames.join(' · ') || 'none yet'}`;
  try {
    const runs = JSON.parse(window.localStorage.getItem('bloomwarden-runs') || '[]');
    $('victory-runs').textContent = runs.length > 0
      ? `LAST RUNS: ${runs.map((r) => `${r.won ? '✓' : '✗'} ${r.score.toLocaleString('en-US')} (${r.grade}, ${r.tide})`).join('  ·  ')}`
      : '';
  } catch (e) {
    $('victory-runs').textContent = '';
  }
  $('victory-next').textContent = world.tide.id !== 'blightstorm'
    ? 'Next goal: win on BLIGHTSTORM — score ×1.5, more mites, tougher, hungrier.'
    : grade !== 'S'
      ? 'Next goal: grade S on BLIGHTSTORM — finish with 3 or fewer hits.'
      : `Next goal: beat your best of ${world.best.toLocaleString('en-US')}.`;
  state = 'victory';
  showScreen('victory');
}

function drawVictoryChart() {
  const c = $('victory-chart');
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  g.clearRect(0, 0, W, H);
  const data = world.stats.perBloom;
  if (data.length === 0) return;
  const maxScore = Math.max(...data.map((d) => d.score), 1);
  const pad = 26;
  const bw = (W - pad * 2) / data.length;
  // Bars: score at each dawn (cumulative).
  data.forEach((d, i) => {
    const h = ((H - 40) * d.score) / maxScore;
    const x = pad + i * bw + 4;
    g.fillStyle = i === data.length - 1 ? '#ffd23d' : '#2ee6a8';
    g.fillRect(x, H - 22 - h, bw - 8, h);
    g.fillStyle = '#9fd8b8';
    g.font = '11px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.fillText(`B${d.bloom}`, x + (bw - 8) / 2, H - 8);
  });
  // Line: hearts left at each dawn.
  g.strokeStyle = '#ff5df2';
  g.lineWidth = 2;
  g.beginPath();
  data.forEach((d, i) => {
    const x = pad + i * bw + bw / 2;
    const y = H - 22 - ((H - 40) * (d.lives || 0)) / GAME.maxLives;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();
  g.fillStyle = '#ff5df2';
  data.forEach((d, i) => {
    const x = pad + i * bw + bw / 2;
    const y = H - 22 - ((H - 40) * (d.lives || 0)) / GAME.maxLives;
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
  });
}

function openOver() {
  saveBest(world);
  saveTideBest();
  recordRun(false);
  $('final-score').textContent = world.score.toLocaleString('en-US');
  $('best-score').textContent = world.best.toLocaleString('en-US');
  $('new-best').classList.toggle('hidden', !(world.score > 0 && world.score >= world.best));
  const s = world.stats;
  $('over-stats').textContent = `Reached bloom ${world.bloom}/7 · Glowcaps bloomed ${s.capsBloomed} · Mites scared ${s.mitesScared} · Spores banked ✦ ${s.sporesBanked} · Best chain x${s.bestChain} · Tide ${world.tide.name} · Seed ${seed}`;
  state = 'over';
  showScreen('over');
}

function handleEvents(events) {
  if (events & EVENT_CAP) sfx.bloom();
  if (events & EVENT_SPORE) sfx.pickup(Math.min(world.chain, 12));
  if (events & EVENT_SCARE) sfx.scare();
  if (events & EVENT_HIT) sfx.hit();
  if (events & EVENT_BOSS_HIT) sfx.bossHit();
  if (events & EVENT_BOSS_KILL) sfx.boss();
  if (events & EVENT_CLEAR) sfx.clear();
  if (events & EVENT_WIN) {
    sfx.win();
    openVictory();
    return;
  }
  if (events & EVENT_OVER) {
    sfx.over();
    openOver();
    return;
  }
  if (events & EVENT_CLEAR) openDraft();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  // The ambient clock (mote drift, glow pulse) runs on wall time in live
  // play, but stays at 0 on ?shot= pages so the same seed gives the same
  // frame, byte for byte.
  if (!urlShot) time += dt;

  if (state === 'play') {
    if (!isShot) {
      // Dash on Space or pointer press.
      if (input.consume('Space') || input.consume('pointer')) {
        if (tryDash(world.wisp, world.relics)) sfx.dash();
      }
      const slow = slowFactorAt(world, world.wisp.x, world.wisp.y);
      updateWisp(world.wisp, input, dt, slow, world.relics);
      updateMites(world.mites, world.globs, dt, world.time, world.wisp, world.rng);
      if (world.boss) updateBoss(world.boss, dt, world.time, world.wisp);
      const events = stepWorld(world, dt);
      handleEvents(events);
    }
    const dashReady = world.wisp.dashCooldown <= 0 ? 1 : 1 - world.wisp.dashCooldown / (world.relics.longdash ? 0.7 : 1.1);
    updateHud(world, dashReady);
  } else if (state === 'title') {
    // Attract mode: the grove breathes behind the title.
    updateHud(world, 1);
  } else {
    // Pause / draft / victory / over: keep the HUD numbers fresh behind the overlay.
    updateHud(world, 1);
  }

  drawWorld(ctx, world, backdrop, time);

  // Global keys, by screen.
  if (input.consume('KeyM')) {
    setMuted(!isMuted());
    $('mute-btn').textContent = isMuted() ? '🔇' : '🔊';
  }
  if (state === 'title') {
    if (input.consume('Digit1')) { tideId = 'gentle'; refreshTitle(); sfx.ui(); }
    if (input.consume('Digit2')) { tideId = 'wildwood'; refreshTitle(); sfx.ui(); }
    if (input.consume('Digit3')) { tideId = 'blightstorm'; refreshTitle(); sfx.ui(); }
    if (input.consume('Enter')) startGame(Math.floor(Math.random() * 900000) + 1, tideId);
  } else if (state === 'play') {
    if (input.consume('KeyP') || input.consume('Escape')) {
      state = 'pause';
      showScreen('pause');
      sfx.ui();
    }
    if (input.consume('KeyR')) startGame(Math.floor(Math.random() * 900000) + 1, tideId);
  } else if (state === 'pause') {
    if (input.consume('KeyP') || input.consume('Escape') || input.consume('Enter')) {
      state = 'play';
      showScreen(null);
      sfx.ui();
    }
    if (input.consume('KeyR')) startGame(Math.floor(Math.random() * 900000) + 1, tideId);
  } else if (state === 'draft') {
    if (input.consume('Digit1')) pickRelic(currentOffer.relics[0]?.id);
    if (input.consume('Digit2')) pickRelic(currentOffer.relics[1]?.id);
    if (input.consume('Digit3')) pickRelic(currentOffer.relics[2]?.id);
    if (input.consume('KeyR') && !pickedRelic) doReroll();
    if (input.consume('Enter')) closeDraft();
  } else if (state === 'victory') {
    if (input.consume('KeyR')) startGame(Math.floor(Math.random() * 900000) + 1, tideId);
    if (input.consume('KeyS')) startGame(seed, tideId);
    if (input.consume('Escape')) { state = 'title'; refreshTitle(); showScreen('title'); }
  } else if (state === 'over') {
    if (input.consume('KeyR')) startGame(Math.floor(Math.random() * 900000) + 1, tideId);
    if (input.consume('Escape')) { state = 'title'; refreshTitle(); showScreen('title'); }
  }

  input.endFrame();
  // The screenshot/probe drivers wait for this: set it once the first frame
  // has rendered (for ?shot= pages stageShot sets it earlier, at the end of
  // staging).
  if (!window.__shotReady) window.__shotReady = true;
  requestAnimationFrame(frame);
}

// Buttons.
$('start-btn').addEventListener('click', () => startGame(Math.floor(Math.random() * 900000) + 1, tideId));
$('resume-btn').addEventListener('click', () => { state = 'play'; showScreen(null); sfx.ui(); });
$('again-btn').addEventListener('click', () => startGame(Math.floor(Math.random() * 900000) + 1, tideId));
$('victory-again-btn').addEventListener('click', () => startGame(Math.floor(Math.random() * 900000) + 1, tideId));
$('victory-seed-btn').addEventListener('click', () => startGame(seed, tideId));
$('victory-menu-btn').addEventListener('click', () => { state = 'title'; refreshTitle(); showScreen('title'); });
$('draft-continue').addEventListener('click', closeDraft);
$('draft-reroll').addEventListener('click', doReroll);
$('mute-btn').addEventListener('click', () => {
  ensureAudio();
  setMuted(!isMuted());
  $('mute-btn').textContent = isMuted() ? '🔇' : '🔊';
});
for (const btn of document.querySelectorAll('.tide-btn')) {
  btn.addEventListener('click', () => {
    tideId = btn.dataset.tide;
    refreshTitle();
    ensureAudio();
    sfx.ui();
  });
}
document.addEventListener('pointerdown', ensureAudio, { once: true });

// Shot staging hooks (see shots.js): the screenshot runner drives the game
// through these instead of faking pixels.
window.__bw = {
  get world() { return world; },
  get state() { return state; },
  get seed() { return seed; },
  get input() { return input; },
  start: startGame,
  openDraft,
  openVictory,
  openOver,
  setState(next) { state = next; },
  refreshTitle,
  // Test hook for probe.mjs: jump the live game to a bloom (boss tests).
  jumpToBloom(n) { world.bloom = n; startBloom(world); },
};

refreshTitle();
showScreen('title');
if (urlShot) {
  stageShot(window.__bw, urlShot);
}
requestAnimationFrame(frame);
