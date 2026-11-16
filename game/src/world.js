// The world: lamps to light, levels, collisions, scoring, and the events the
// game loop turns into sound, particles and screen changes.
// Events: 'lamp' | 'pollen' | 'hit' | 'scare' | 'clear' | 'over'
import { BATS, GAME, LAMPS, POLLEN, VIEW, WEBS } from './config.js';
import { makeRng } from './random.js';
import { createMoth, resetMoth } from './moth.js';
import { spawnBats, spawnPollen, spawnWebs } from './entities.js';

export const EVENT_LAMP = 1;
export const EVENT_POLLEN = 2;
export const EVENT_HIT = 4;
export const EVENT_SCARE = 8;
export const EVENT_CLEAR = 16;
export const EVENT_OVER = 32;

export function createWorld(seed) {
  const world = {
    seed,
    rng: makeRng(seed),
    level: 1,
    score: 0,
    best: 0,
    lives: GAME.lives,
    combo: 0,
    comboTimer: 0,
    pollenTimer: 0,
    moth: createMoth(),
    lamps: [],
    bats: [],
    webs: [],
    pollen: [],
    particles: [],
    time: 0,
  };
  try {
    world.best = Number(window.localStorage.getItem('glowmoth-best') || 0) || 0;
  } catch (e) {
    world.best = 0;
  }
  startLevel(world);
  return world;
}

export function saveBest(world) {
  if (world.score <= world.best) return;
  world.best = world.score;
  try {
    window.localStorage.setItem('glowmoth-best', String(world.best));
  } catch (e) {
    /* storage unavailable */
  }
}

function placeLamps(rng, level) {
  const count = LAMPS.baseCount + (level - 1);
  const lamps = [];
  let guard = 0;
  while (lamps.length < count && guard < 200) {
    guard += 1;
    const lamp = {
      x: rng.range(80, VIEW.width - 80),
      y: rng.range(80, VIEW.height - 140),
      lit: false,
      glow: 0, // 0..1, animates up when lit
    };
    const spread = lamps.every((l) => Math.hypot(l.x - lamp.x, l.y - lamp.y) > 150);
    const clearOfStart = Math.hypot(lamp.x - VIEW.width / 2, lamp.y - (VIEW.height - 90)) > 110;
    if (spread && clearOfStart) lamps.push(lamp);
  }
  return lamps;
}

export function startLevel(world) {
  const rng = world.rng;
  world.lamps = placeLamps(rng, world.level);
  world.webs = spawnWebs(rng, world.level, world.lamps);
  world.bats = spawnBats(rng, world.level);
  world.pollen = [];
  for (let i = 0; i < 6; i += 1) {
    const p = spawnPollen(rng, world.pollen, world.lamps);
    if (p) world.pollen.push(p);
  }
  world.pollenTimer = 0;
  world.combo = 0;
  world.comboTimer = 0;
  resetMoth(world.moth);
}

export function lampsLeft(world) {
  return world.lamps.filter((l) => !l.lit).length;
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = world.rng.next() * Math.PI * 2;
    const s = speed * (0.4 + world.rng.next() * 0.8);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + world.rng.next() * 0.4,
      maxLife: 0.9,
      color,
      size: 2 + world.rng.next() * 3,
    });
  }
}

export function stepWorld(world, dt) {
  let events = 0;
  world.time += dt;
  const moth = world.moth;

  // Combo decay.
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // Pollen respawn.
  world.pollenTimer += dt;
  if (world.pollenTimer >= POLLEN.respawnEvery && world.pollen.length < POLLEN.maxOnField) {
    world.pollenTimer = 0;
    const p = spawnPollen(world.rng, world.pollen, world.lamps);
    if (p) world.pollen.push(p);
  }

  // Lamp glow animation.
  for (const lamp of world.lamps) {
    if (lamp.lit && lamp.glow < 1) lamp.glow = Math.min(1, lamp.glow + dt * 3);
  }

  // Particles.
  for (const p of world.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.2, dt);
    p.vy *= Math.pow(0.2, dt);
    p.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);

  // Dash trail puffs.
  if (moth.dashTime > 0) {
    moth.trailTimer -= dt;
    if (moth.trailTimer <= 0) {
      moth.trailTimer = 0.03;
      world.particles.push({
        x: moth.x, y: moth.y, vx: 0, vy: 0,
        life: 0.35, maxLife: 0.35, color: '#37c8ab', size: 5,
      });
    }
  }

  // --- Collisions ---
  if (moth.alive) {
    // Lamps.
    for (const lamp of world.lamps) {
      if (!lamp.lit && Math.hypot(moth.x - lamp.x, moth.y - lamp.y) < 14 + LAMPS.radius) {
        lamp.lit = true;
        world.score += LAMPS.points;
        burst(world, lamp.x, lamp.y, '#ffb347', 18, 160);
        events |= EVENT_LAMP;
      }
    }
    // Pollen.
    for (const p of world.pollen) {
      if (p.active && Math.hypot(moth.x - p.x, moth.y - p.y) < 14 + POLLEN.radius) {
        p.active = false;
        world.combo = Math.min(world.combo + 1, 99);
        world.comboTimer = POLLEN.comboWindow;
        const mult = Math.min(world.combo, POLLEN.comboCap);
        world.score += POLLEN.basePoints * mult;
        burst(world, p.x, p.y, '#ffe9a8', 8, 90);
        events |= EVENT_POLLEN;
      }
    }
    world.pollen = world.pollen.filter((p) => p.active);

    // Bats: dashing through one scares it off; otherwise a hit costs a life.
    for (const bat of world.bats) {
      if (!bat.active) continue;
      const d = Math.hypot(moth.x - bat.x, moth.y - bat.y);
      if (d < 14 + BATS.radius) {
        if (moth.dashTime > 0) {
          bat.active = false;
          world.score += BATS.dashKillPoints;
          burst(world, bat.x, bat.y, '#37c8ab', 14, 140);
          events |= EVENT_SCARE;
        } else if (moth.invuln <= 0) {
          world.lives -= 1;
          world.combo = 0;
          world.comboTimer = 0;
          moth.invuln = 2.0;
          burst(world, moth.x, moth.y, '#ff5d5d', 20, 200);
          events |= EVENT_HIT;
          if (world.lives <= 0) {
            moth.alive = false;
            saveBest(world);
            events |= EVENT_OVER;
          }
        }
      }
    }
  }

  // Level clear: every lamp lit.
  if (moth.alive && lampsLeft(world) === 0) {
    const bonus = GAME.levelBonusBase + GAME.levelBonusPerLevel * world.level + GAME.lifeBonus * world.lives;
    world.score += bonus;
    world.level += 1;
    events |= EVENT_CLEAR;
    startLevel(world);
  }

  return events;
}

// Slow factor for the moth this frame (webs).
export function slowFactorAt(world, x, y) {
  return world.webs.some((w) => Math.hypot(x - w.x, y - w.y) < w.radius) ? WEBS.slowFactor : 1;
}
