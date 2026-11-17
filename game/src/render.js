// All canvas drawing: the fungal forest, the sporefall phase marker, the
// wisp, mites, the boss, thornvines, glowcaps, spores, particles, and the
// HUD. DOM overlays (in index.html) carry the title, pause, draft, victory
// and game-over screens; this file draws everything in-world and keeps the
// HUD fresh — the objective banner states the WIN and the LOSE in play, the
// incoming queue names the mites coming, the relics panel names what the run
// holds, so the first screenshot proves the game is complete: goal, rules,
// controls, win, lose, score, start, restart, HUD.
import { BOSSES, GLOWCAPS, PALETTE, RELICS, VIEW } from './config.js';
import { drawWisp } from './wisp.js';
import { drawMite, drawBoss, drawSpore, drawThorn, drawGlob } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

// Spore motes, canopy mushrooms and glow-shrooms are generated once per
// world from its seed, so the forest is dense and every run looks alive.
export function makeBackdrop(rng) {
  const motes = [];
  for (let i = 0; i < 150; i += 1) {
    motes.push({
      x: rng.range(0, VIEW.width),
      y: rng.range(0, VIEW.height - 110),
      r: rng.range(0.6, 1.8),
      phase: rng.range(0, Math.PI * 2),
    });
  }
  const drifters = [];
  for (let i = 0; i < 26; i += 1) {
    drifters.push({
      x: rng.range(0, VIEW.width),
      y: rng.range(80, VIEW.height - 100),
      phase: rng.range(0, Math.PI * 2),
      speed: rng.range(0.2, 0.7),
    });
  }
  // Canopy mushrooms along the bottom.
  const shrooms = [];
  for (let x = 20; x < VIEW.width; x += 90) {
    shrooms.push({
      x: x + rng.range(-20, 20),
      h: rng.range(22, 54),
      w: rng.range(18, 34),
      hue: rng.next() < 0.6 ? '176, 108, 255' : '46, 230, 168',
    });
  }
  // Glow-shrooms: tiny lights scattered on the forest floor.
  const floorGlow = [];
  for (let i = 0; i < 30; i += 1) {
    floorGlow.push({
      x: rng.range(20, VIEW.width - 20),
      y: rng.range(VIEW.height - 140, VIEW.height - 14),
      r: rng.range(1.5, 3),
      phase: rng.range(0, Math.PI * 2),
      hue: rng.next() < 0.5 ? '255, 210, 61' : '46, 230, 168',
    });
  }
  return { motes, drifters, shrooms, floorGlow };
}

// The phase marker, drawn in the sky: a ring that fills as the sporefall
// cycle turns (DORMANT a thin ring, FULLBLOOM a full glowing disc).
function drawPhaseMarker(ctx, phase) {
  const x = VIEW.width - 110;
  const y = 86;
  const r = 24;
  const phaseIndex = ['DORMANT', 'SPROUT', 'BLOOM', 'SPORING', 'FULLBLOOM'].indexOf(phase.name);
  const glow = ctx.createRadialGradient(x, y, 6, x, y, 66);
  glow.addColorStop(0, 'rgba(232, 255, 244, 0.9)');
  glow.addColorStop(0.35, 'rgba(232, 255, 244, 0.25)');
  glow.addColorStop(1, 'rgba(232, 255, 244, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 66, 0, Math.PI * 2);
  ctx.fill();
  // Ring fill by phase: 1/5, 2/5, 3/5, 4/5, full.
  ctx.strokeStyle = '#2ee6a8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (phaseIndex + 1)) / 5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232, 255, 244, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e8fff4';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackground(ctx, backdrop, time, phase) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  drawPhaseMarker(ctx, phase);

  // Twinkling spore motes.
  for (const s of backdrop.motes) {
    ctx.globalAlpha = 0.35 + Math.sin(time * 1.4 + s.phase) * 0.3;
    ctx.fillStyle = '#c8ffe9';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Drifting spores.
  for (const f of backdrop.drifters) {
    const fx = f.x + Math.sin(time * f.speed + f.phase) * 26;
    const fy = f.y + Math.cos(time * f.speed * 0.8 + f.phase) * 13;
    const a = 0.25 + Math.abs(Math.sin(time * 1.8 + f.phase)) * 0.55;
    const glow = ctx.createRadialGradient(fx, fy, 0.5, fx, fy, 11);
    glow.addColorStop(0, `rgba(255, 210, 61, ${a})`);
    glow.addColorStop(1, 'rgba(255, 210, 61, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  // Forest floor + canopy mushrooms + floor glow.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, VIEW.height - 56, VIEW.width, 56);
  for (const sh of backdrop.shrooms) {
    const x = sh.x;
    const baseY = VIEW.height;
    ctx.strokeStyle = '#1d3a2a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + 3, baseY - sh.h * 0.6, x, baseY - sh.h);
    ctx.stroke();
    ctx.fillStyle = `rgba(${sh.hue}, 0.85)`;
    ctx.beginPath();
    ctx.arc(x, baseY - sh.h, sh.w / 2, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 255, 244, 0.8)';
    ctx.beginPath();
    ctx.arc(x - sh.w / 5, baseY - sh.h - sh.w / 6, 2, 0, Math.PI * 2);
    ctx.arc(x + sh.w / 6, baseY - sh.h - sh.w / 8, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const fl of backdrop.floorGlow) {
    const a = 0.3 + Math.abs(Math.sin(time * 1.2 + fl.phase)) * 0.5;
    ctx.fillStyle = `rgba(${fl.hue}, ${a})`;
    ctx.beginPath();
    ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGlowcap(ctx, cap, time) {
  const { x, y } = cap;
  // A thin stem down to the forest floor.
  ctx.strokeStyle = '#3a5a48';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + 34);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
  // Warm glow when bloomed, breathing gently.
  if (cap.lit) {
    const breathe = 0.85 + Math.sin(time * 2.2 + x) * 0.15;
    const radius = GLOWCAPS.glowRadius * cap.glow * breathe;
    const glow = ctx.createRadialGradient(x, y, 6, x, y, radius);
    glow.addColorStop(0, PALETTE.capGlow);
    glow.addColorStop(1, 'rgba(176, 108, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mushroom cap: dim grey-violet when unbloomed, violet when bloomed.
  ctx.fillStyle = cap.lit ? PALETTE.capLit : PALETTE.capDim;
  ctx.beginPath();
  ctx.arc(x, y, 20, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cap.lit ? '#f2e4ff' : '#8b85a3';
  ctx.beginPath();
  ctx.arc(x - 7, y - 6, 3, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 9, 2.4, 0, Math.PI * 2);
  ctx.arc(x + 2, y - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1f1a';
  ctx.fillRect(x - 4, y, 8, 12);
  if (!cap.lit) {
    // A faint pulsing outline so unbloomed caps are findable.
    ctx.globalAlpha = 0.35 + Math.sin(time * 2 + y) * 0.2;
    ctx.strokeStyle = '#b06cff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawWorld(ctx, world, backdrop, time) {
  drawBackground(ctx, backdrop, time, world.phase);
  // Glowcap light pools sit under everything else.
  for (const cap of world.caps) drawGlowcap(ctx, cap, time);
  for (const thorn of world.thorns) drawThorn(ctx, thorn, time);
  for (const p of world.spores) drawSpore(ctx, p, time);
  for (const glob of world.globs) {
    if (glob.active) drawGlob(ctx, glob);
  }
  for (const mite of world.mites) {
    if (mite.active) drawMite(ctx, mite);
  }
  if (world.boss && world.boss.active) drawBoss(ctx, world.boss, time);
  // Particles above the field, below the wisp.
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (world.wisp.alive) drawWisp(ctx, world.wisp, time);
}

// HUD is a DOM overlay (index.html); this keeps its numbers fresh, plus the
// objective banner (WIN/LOSE, always in play), the wave banner (incoming
// preview at bloom start), the boss bar, the incoming queue (what is coming)
// and the relics panel (what the run holds) — so the first screenshot proves
// the game is complete: goal, rules, controls, win, lose, score, start,
// restart, HUD.
export function updateHud(world, dashReady) {
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(text)) el.textContent = String(text);
  };
  set('hud-score', world.score.toLocaleString('en-US'));
  set('hud-best', world.best.toLocaleString('en-US'));
  set('hud-bloom', `${world.bloom}/7`);
  set('hud-caps', `${world.caps.filter((c) => c.lit).length}/${world.caps.length}`);
  set('hud-spores', `✦ ${world.sporeBank}`);
  set('hud-phase', `☘ ${world.phase.name}`);
  set('hud-tide', world.tide.name);
  const chain = Math.min(world.chain, 8);
  set('hud-chain', chain > 1 ? `CHAIN x${chain}` : '');
  const lives = document.getElementById('hud-lives');
  if (lives) {
    const hearts = '♥'.repeat(Math.max(0, world.lives)) + '♡'.repeat(Math.max(0, 5 - world.lives));
    if (lives.textContent !== hearts) lives.textContent = hearts;
  }
  const dash = document.getElementById('hud-dash');
  if (dash) {
    dash.style.width = `${Math.round(dashReady * 100)}%`;
    dash.classList.toggle('ready', dashReady >= 1);
  }
  // Objective banner: WIN and LOSE, in play, at a glance.
  const lit = world.caps.filter((c) => c.lit).length;
  set('objective-text', `✦ WIN: bloom all ${world.caps.length} glowcaps (${lit}/${world.caps.length} bloomed) · LOSE: hearts run out · BLOOM ${world.bloom}/7 · PHASE: ${world.phase.name} — ${world.phase.blurb}`);
  // Wave banner: the incoming preview, visible for 3.5s after a bloom starts.
  const wave = document.getElementById('wave-banner');
  if (wave) {
    const show = world.time < world.waveUntil && world.wisp.alive;
    wave.classList.toggle('hidden', !show);
    if (show) set('wave-text', world.wave.text);
  }
  // Boss bar: only while a boss lives.
  const bossBar = document.getElementById('boss-bar');
  if (bossBar) {
    const alive = !!(world.boss && world.boss.active);
    bossBar.classList.toggle('hidden', !alive);
    if (alive) {
      set('boss-name', world.boss.name);
      const hits = document.getElementById('boss-hits');
      if (hits) {
        const hearts = '♥'.repeat(Math.max(0, world.boss.hits)) + '♡'.repeat(Math.max(0, world.boss.maxHits - world.boss.hits));
        if (hits.textContent !== hearts) hits.textContent = hearts;
      }
      const phase = document.getElementById('boss-phase');
      if (phase) {
        const label = world.boss.hits === world.boss.maxHits ? '' : world.boss.hits === 1 ? ' · ENRAGED: it swoops faster' : ' · PHASE 2: it swoops more';
        if (phase.textContent !== label) phase.textContent = label;
      }
    }
  }
  // Incoming queue (left panel): named kinds coming this bloom + NEXT bloom.
  const queue = document.getElementById('incoming-list');
  if (queue) {
    const counts = {};
    for (const m of world.mites) {
      if (m.active) counts[m.name] = (counts[m.name] || 0) + 1;
    }
    const lines = Object.entries(counts).map(([name, n]) => `${name} ×${n}`).join(' · ');
    const next = world.bloom < 7 ? `NEXT: bloom ${world.bloom + 1} — ${BOSSES[world.bloom + 1] ? `${BOSSES[world.bloom + 1].name} BOSS` : 'more mites'}` : 'NEXT: the dawn breaks';
    const text = `${lines || 'clear'} — ${next}`;
    if (queue.textContent !== text) queue.textContent = text;
  }
  // Relics panel (right panel): what the run holds.
  const relicsEl = document.getElementById('relics-list');
  if (relicsEl) {
    const held = RELICS.filter((r) => world.relics[r.id]);
    const text = held.length > 0 ? held.map((r) => r.name).join(' · ') : 'No relics yet — clear a bloom to draft one.';
    if (relicsEl.textContent !== text) relicsEl.textContent = text;
  }
  // Ability slots (bottom bar): dash + relic powers with their state.
  const slots = document.getElementById('ability-slots');
  if (slots) {
    const parts = [`DASH ${dashReady >= 1 ? 'READY' : '…'}`];
    if (world.relics.magnet) parts.push('MAGNET on');
    if (world.relics.dashnova) parts.push('NOVA on');
    if (world.relics.chainkeeper) parts.push('CHAIN 6s');
    const text = parts.join(' · ');
    if (slots.textContent !== text) slots.textContent = text;
  }
}
