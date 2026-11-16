// All canvas drawing: the night garden, the moth, bats, webs, lamps, pollen,
// particles, and the HUD. DOM overlays (in index.html) carry the title, pause,
// level-clear and game-over screens; this file draws everything in-world.
import { LAMPS, PALETTE, VIEW } from './config.js';
import { drawMoth } from './moth.js';
import { drawBat, drawPollen, drawWeb } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

// Stars and fireflies are generated once per world from its seed.
export function makeBackdrop(rng) {
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({
      x: rng.range(0, VIEW.width),
      y: rng.range(0, VIEW.height - 90),
      r: rng.range(0.6, 1.8),
      phase: rng.range(0, Math.PI * 2),
    });
  }
  const fireflies = [];
  for (let i = 0; i < 14; i += 1) {
    fireflies.push({
      x: rng.range(0, VIEW.width),
      y: rng.range(60, VIEW.height - 80),
      phase: rng.range(0, Math.PI * 2),
      speed: rng.range(0.2, 0.7),
    });
  }
  // Grass tufts along the bottom.
  const grass = [];
  for (let x = 8; x < VIEW.width; x += 26) {
    grass.push({ x: x + rng.range(-6, 6), h: rng.range(18, 42), lean: rng.range(-8, 8) });
  }
  return { stars, fireflies, grass };
}

function drawBackground(ctx, backdrop, time) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Moon.
  const moon = ctx.createRadialGradient(830, 70, 6, 830, 70, 60);
  moon.addColorStop(0, 'rgba(246, 234, 210, 0.9)');
  moon.addColorStop(0.35, 'rgba(246, 234, 210, 0.25)');
  moon.addColorStop(1, 'rgba(246, 234, 210, 0)');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(830, 70, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6ead2';
  ctx.beginPath();
  ctx.arc(830, 70, 22, 0, Math.PI * 2);
  ctx.fill();

  // Twinkling stars.
  for (const s of backdrop.stars) {
    ctx.globalAlpha = 0.35 + Math.sin(time * 1.4 + s.phase) * 0.3;
    ctx.fillStyle = '#e8e2ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Drifting fireflies.
  for (const f of backdrop.fireflies) {
    const fx = f.x + Math.sin(time * f.speed + f.phase) * 24;
    const fy = f.y + Math.cos(time * f.speed * 0.8 + f.phase) * 12;
    const a = 0.25 + Math.abs(Math.sin(time * 1.8 + f.phase)) * 0.55;
    const glow = ctx.createRadialGradient(fx, fy, 0.5, fx, fy, 10);
    glow.addColorStop(0, `rgba(255, 233, 168, ${a})`);
    glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground + grass silhouettes.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, VIEW.height - 46, VIEW.width, 46);
  ctx.strokeStyle = '#1d1838';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const tuft of backdrop.grass) {
    ctx.beginPath();
    ctx.moveTo(tuft.x, VIEW.height);
    ctx.quadraticCurveTo(tuft.x + tuft.lean, VIEW.height - tuft.h * 0.6, tuft.x + tuft.lean * 1.6, VIEW.height - tuft.h);
    ctx.stroke();
  }
}

function drawLamp(ctx, lamp, time) {
  const { x, y } = lamp;
  // Hanging string.
  ctx.strokeStyle = '#3a3355';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 46);
  ctx.lineTo(x, y - 14);
  ctx.stroke();
  // Warm glow when lit, breathing gently.
  if (lamp.lit) {
    const breathe = 0.85 + Math.sin(time * 2.2 + x) * 0.15;
    const radius = LAMPS.glowRadius * lamp.glow * breathe;
    const glow = ctx.createRadialGradient(x, y, 6, x, y, radius);
    glow.addColorStop(0, PALETTE.lampGlow);
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lantern body: dim grey when unlit, amber when lit.
  ctx.fillStyle = lamp.lit ? PALETTE.lampLit : PALETTE.lampDim;
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 12);
  ctx.lineTo(x + 12, y - 12);
  ctx.lineTo(x + 8, y + 12);
  ctx.lineTo(x - 8, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lamp.lit ? '#fff3d6' : '#8b85a3';
  ctx.fillRect(x - 6, y - 6, 12, 12);
  ctx.fillStyle = '#241a3d';
  ctx.fillRect(x - 4, y - 16, 8, 4);
  if (!lamp.lit) {
    // A faint pulsing outline so unlit lamps are findable.
    ctx.globalAlpha = 0.35 + Math.sin(time * 2 + y) * 0.2;
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawWorld(ctx, world, backdrop, time) {
  drawBackground(ctx, backdrop, time);
  // Lamp light pools sit under everything else.
  for (const lamp of world.lamps) drawLamp(ctx, lamp, time);
  for (const web of world.webs) drawWeb(ctx, web, time);
  for (const p of world.pollen) drawPollen(ctx, p, time);
  for (const bat of world.bats) {
    if (bat.active) drawBat(ctx, bat);
  }
  // Particles above the field, below the moth.
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (world.moth.alive) drawMoth(ctx, world.moth, time);
}

// HUD is a DOM overlay (index.html); this keeps its numbers fresh.
export function updateHud(world, dashReady) {
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(text)) el.textContent = String(text);
  };
  set('hud-score', world.score);
  set('hud-best', world.best);
  set('hud-level', world.level);
  set('hud-lamps', `${world.lamps.filter((l) => l.lit).length}/${world.lamps.length}`);
  set('hud-combo', world.combo > 1 ? `x${Math.min(world.combo, 8)} combo` : '');
  const lives = document.getElementById('hud-lives');
  if (lives) {
    const hearts = '♥'.repeat(Math.max(0, world.lives)) + '♡'.repeat(Math.max(0, 3 - world.lives));
    if (lives.textContent !== hearts) lives.textContent = hearts;
  }
  const dash = document.getElementById('hud-dash');
  if (dash) {
    dash.style.width = `${Math.round(dashReady * 100)}%`;
    dash.classList.toggle('ready', dashReady >= 1);
  }
}
