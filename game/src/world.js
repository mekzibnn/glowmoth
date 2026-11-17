// The world: glowcaps to bloom (WIN the bloom), hearts (LOSE when they run
// out), scoring times the CHAIN, the sporefall PHASE that changes the grove,
// the BOSSES on blooms 3, 5 and 7, the RELIC DRAFT after each bloom, the
// TIDE difficulty, the 8 FEATS, and the run stats behind the victory screen.
// GOAL: bloom every glowcap; WIN the campaign by clearing bloom 7. The first
// declarations say the whole game: goal / win / lose / score / boss / draft.
// Events: 'cap' | 'spore' | 'hit' | 'scare' | 'clear' | 'over' | 'boss-hit' | 'boss-kill' | 'win'
import { BOSSES, GAME, GLOWCAPS, MITES, PHASES, RELICS, SPORES, THORNS, TIDES, VIEW } from './config.js';
import { makeRng } from './random.js';
import { createWisp, resetWisp } from './wisp.js';
import { spawnMites, spawnBoss, spawnSpore, spawnThorns, incomingList } from './entities.js';

export const EVENT_CAP = 1;
export const EVENT_SPORE = 2;
export const EVENT_HIT = 4;
export const EVENT_SCARE = 8;
export const EVENT_CLEAR = 16;
export const EVENT_OVER = 32;
export const EVENT_BOSS_HIT = 64;
export const EVENT_BOSS_KILL = 128;
export const EVENT_WIN = 256;

// PHASE for a bloom: DORMANT, SPROUT, BLOOM, SPORING, FULLBLOOM, then it cycles.
export function phaseForBloom(bloom) {
  return PHASES[(bloom - 1) % PHASES.length];
}

// The tide (difficulty) by id; WILDWOOD when unknown.
export function tideById(id) {
  return TIDES.find((t) => t.id === id) || TIDES[1];
}

// INCOMING preview for a bloom: what the wave banner and the queue show.
export function incomingForBloom(bloom, tide) {
  return incomingList(bloom, phaseForBloom(bloom), tide);
}

// RELIC DRAFT: offer 3 relics the run does not hold yet, weighted by rarity
// (common 5, rare 3, epic 1). When all 12 are held, offer a score bonus.
export function draftOffer(world) {
  const held = Object.keys(world.relics).filter((id) => world.relics[id]);
  const pool = RELICS.filter((r) => !world.relics[r.id]);
  if (pool.length === 0) return { relics: [], bonus: 1500 };
  const weight = { common: 5, rare: 3, epic: 1 };
  const offered = [];
  const bag = [...pool];
  while (offered.length < 3 && bag.length > 0) {
    let total = 0;
    for (const r of bag) total += weight[r.rarity];
    let pick = world.rng.next() * total;
    let chosen = bag[0];
    for (const r of bag) {
      pick -= weight[r.rarity];
      if (pick <= 0) {
        chosen = r;
        break;
      }
    }
    offered.push(chosen);
    bag.splice(bag.indexOf(chosen), 1);
  }
  return { relics: offered, bonus: 0 };
}

// Take a drafted relic: apply its one-time effects, mark it held.
export function takeRelic(world, id) {
  const relic = RELICS.find((r) => r.id === id);
  if (!relic || world.relics[id]) return false;
  world.relics[id] = true;
  if (id === 'heart') world.lives = Math.min(GAME.maxLives, world.lives + 1);
  if (id === 'cache') world.sporeBank += 15;
  return true;
}

// Reroll the draft for spores. Returns the new offer, or null when too poor.
export function rerollDraft(world, offer) {
  if (world.sporeBank < 15) return null;
  world.sporeBank -= 15;
  return draftOffer(world);
}

// BOSS: true while a boss is alive on this bloom.
export function bossAlive(world) {
  return !!(world.boss && world.boss.active);
}

export function createWorld(seed, tideId) {
  const tide = tideById(tideId);
  const world = {
    seed,
    rng: makeRng(seed),
    tide,
    bloom: 1,
    score: 0,
    best: 0,
    lives: tide.hearts,
    chain: 0, // consecutive pickups + scares without a hit, cap x8
    comboTimer: 0,
    sporeTimer: 0,
    sporeBank: 0, // spores are a currency: the DRAFT reroll spends them
    relics: {}, // held relic ids -> true
    phase: phaseForBloom(1),
    boss: null,
    wave: incomingForBloom(1, tide),
    waveUntil: 0, // world time until the wave banner fades
    wisp: createWisp(),
    caps: [],
    mites: [],
    thorns: [],
    spores: [],
    globs: [],
    particles: [],
    time: 0,
    // Run stats, for the victory screen: per-bloom scores (the chart),
    // counts, best chain, hits taken, bosses killed, seconds played.
    stats: {
      capsBloomed: 0, mitesScared: 0, sporesBanked: 0, bestChain: 0,
      hitsTaken: 0, bossesKilled: 0, bloomsCleared: 0, startTime: 0,
      perBloom: [], // { bloom, score } at each clear, for the chart
    },
    feats: loadFeats(),
    hitsThisBloom: 0,
    won: false,
  };
  try {
    world.best = Number(window.localStorage.getItem('bloomwarden-best') || 0) || 0;
  } catch (e) {
    world.best = 0;
  }
  world.stats.startTime = 0;
  startBloom(world);
  return world;
}

export function saveBest(world) {
  if (world.score <= world.best) return;
  world.best = world.score;
  try {
    window.localStorage.setItem('bloomwarden-best', String(world.best));
  } catch (e) {
    /* storage unavailable */
  }
}

// FEATS: kept in localStorage as a JSON set of unlocked ids.
export function loadFeats() {
  try {
    return JSON.parse(window.localStorage.getItem('bloomwarden-feats') || '{}') || {};
  } catch (e) {
    return {};
  }
}

export function unlockFeat(world, id) {
  if (world.feats[id]) return false;
  world.feats[id] = true;
  try {
    window.localStorage.setItem('bloomwarden-feats', JSON.stringify(world.feats));
  } catch (e) {
    /* storage unavailable */
  }
  return true;
}

function placeCaps(rng, bloom) {
  const count = GLOWCAPS.baseCount + (bloom - 1);
  const caps = [];
  let guard = 0;
  while (caps.length < count && guard < 400) {
    guard += 1;
    const cap = {
      x: rng.range(100, VIEW.width - 100),
      y: rng.range(110, VIEW.height - 180),
      lit: false,
      glow: 0, // 0..1, animates up when bloomed
    };
    const spread = caps.every((c) => Math.hypot(c.x - cap.x, c.y - cap.y) > 170);
    const clearOfStart = Math.hypot(cap.x - VIEW.width / 2, cap.y - (VIEW.height - 110)) > 130;
    if (spread && clearOfStart) caps.push(cap);
  }
  return caps;
}

export function startBloom(world) {
  const rng = world.rng;
  world.phase = phaseForBloom(world.bloom);
  world.wave = incomingForBloom(world.bloom, world.tide);
  world.waveUntil = world.time + 3.5; // the wave banner shows for 3.5 seconds
  world.caps = placeCaps(rng, world.bloom);
  world.thorns = spawnThorns(rng, world.bloom, world.caps);
  world.mites = spawnMites(rng, world.bloom, world.phase, world.tide);
  world.boss = BOSSES[world.bloom] ? spawnBoss(rng, world.bloom) : null;
  world.globs = [];
  world.spores = [];
  for (let i = 0; i < 8; i += 1) {
    const p = spawnSpore(rng, world.spores, world.caps);
    if (p) world.spores.push(p);
  }
  world.sporeTimer = 0;
  world.chain = 0;
  world.comboTimer = 0;
  world.hitsThisBloom = 0;
  resetWisp(world.wisp);
}

export function capsLeft(world) {
  return world.caps.filter((c) => !c.lit).length;
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

// The chain multiplies glowcap, spore and scare points (cap x8).
function chainMult(world) {
  return Math.max(1, Math.min(world.chain, SPORES.comboCap));
}

function award(world, base) {
  return Math.round(base * chainMult(world) * world.tide.mult);
}

function takeHit(world, events) {
  world.lives -= 1;
  world.chain = 0;
  world.comboTimer = 0;
  world.hitsThisBloom += 1;
  world.stats.hitsTaken += 1;
  world.wisp.invuln = world.relics.ironwisp ? 3.0 : 2.0;
  burst(world, world.wisp.x, world.wisp.y, '#ff5df2', 20, 200);
  if (world.lives <= 0) {
    world.wisp.alive = false;
    saveBest(world);
    return events | EVENT_OVER;
  }
  return events | EVENT_HIT;
}

export function stepWorld(world, dt) {
  let events = 0;
  world.time += dt;
  const wisp = world.wisp;

  // Chain decay.
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.chain = 0;
  }

  // Spore respawn.
  world.sporeTimer += dt;
  if (world.sporeTimer >= SPORES.respawnEvery && world.spores.length < SPORES.maxOnField) {
    world.sporeTimer = 0;
    const p = spawnSpore(world.rng, world.spores, world.caps);
    if (p) world.spores.push(p);
  }

  // Spore Magnet relic: spores drift toward the wisp.
  if (world.relics.magnet && wisp.alive) {
    for (const p of world.spores) {
      const dx = wisp.x - p.x;
      const dy = wisp.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 1 && d < 260) {
        p.x += (dx / d) * 120 * dt;
        p.y += (dy / d) * 120 * dt;
      }
    }
  }

  // Glowcap glow animation.
  for (const cap of world.caps) {
    if (cap.lit && cap.glow < 1) cap.glow = Math.min(1, cap.glow + dt * 3);
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
  if (wisp.dashTime > 0) {
    wisp.trailTimer -= dt;
    if (wisp.trailTimer <= 0) {
      wisp.trailTimer = 0.03;
      world.particles.push({
        x: wisp.x, y: wisp.y, vx: 0, vy: 0,
        life: 0.35, maxLife: 0.35, color: '#2ee6a8', size: 5,
      });
    }
  }

  // --- Collisions ---
  if (wisp.alive) {
    // Glowcaps: bloom one, score it times the chain and the tide.
    const capRadius = 14 + GLOWCAPS.radius + (world.relics.widebloom ? 10 : 0);
    for (const cap of world.caps) {
      if (!cap.lit && Math.hypot(wisp.x - cap.x, wisp.y - cap.y) < capRadius) {
        cap.lit = true;
        const points = (GLOWCAPS.points + (world.relics.bloomheart ? 150 : 0))
          * (world.phase.name === 'FULLBLOOM' && world.relics.fullbloom ? 2 : 1);
        world.chain = Math.min(world.chain + 1, 99);
        world.comboTimer = world.relics.chainkeeper ? 6 : SPORES.comboWindow;
        world.stats.bestChain = Math.max(world.stats.bestChain, Math.min(world.chain, 8));
        world.score += award(world, points);
        world.stats.capsBloomed += 1;
        burst(world, cap.x, cap.y, '#b06cff', 18, 160);
        events |= EVENT_CAP;
        if (world.chain >= 8) unlockFeat(world, 'chain8');
      }
    }
    // Spores: points times the combo, times the phase — and they bank as
    // DRAFT money (the reroll spends them).
    for (const p of world.spores) {
      if (p.active && Math.hypot(wisp.x - p.x, wisp.y - p.y) < 14 + SPORES.radius) {
        p.active = false;
        world.chain = Math.min(world.chain + 1, 99);
        world.comboTimer = world.relics.chainkeeper ? 6 : SPORES.comboWindow;
        world.stats.bestChain = Math.max(world.stats.bestChain, Math.min(world.chain, 8));
        const mult = Math.min(world.chain, SPORES.comboCap);
        world.score += Math.round(SPORES.basePoints * mult * world.phase.spore * world.tide.mult);
        world.sporeBank += world.phase.spore;
        world.stats.sporesBanked += world.phase.spore;
        burst(world, p.x, p.y, '#ffd23d', 8, 90);
        events |= EVENT_SPORE;
        if (world.chain >= 8) unlockFeat(world, 'chain8');
        if (world.sporeBank >= 100) unlockFeat(world, 'hoard');
      }
    }
    world.spores = world.spores.filter((p) => p.active);

    // Mites: dashing through one scares it off; otherwise a hit costs a heart.
    // Dash Nova scares mites near the dash, not just touched ones.
    const scareRadius = 14 + MITES.radius + (world.relics.dashnova && wisp.dashTime > 0 ? 60 : 0);
    for (const mite of world.mites) {
      if (!mite.active) continue;
      const d = Math.hypot(wisp.x - mite.x, wisp.y - mite.y);
      if (d < scareRadius) {
        if (wisp.dashTime > 0) {
          mite.hits -= 1;
          if (mite.hits <= 0) {
            mite.active = false;
            world.chain = Math.min(world.chain + 1, 99);
            world.comboTimer = world.relics.chainkeeper ? 6 : SPORES.comboWindow;
            world.stats.bestChain = Math.max(world.stats.bestChain, Math.min(world.chain, 8));
            world.score += award(world, MITES.dashKillPoints);
            world.stats.mitesScared += 1;
            burst(world, mite.x, mite.y, '#2ee6a8', 14, 140);
            events |= EVENT_SCARE;
          } else {
            burst(world, mite.x, mite.y, '#ffd23d', 8, 100);
            events |= EVENT_SCARE;
          }
        } else if (wisp.invuln <= 0) {
          events = takeHit(world, events);
          if (events & EVENT_OVER) return events;
        }
      }
    }

    // Blight globs (spitters): a touch costs a heart.
    for (const glob of world.globs) {
      if (!glob.active) continue;
      if (Math.hypot(wisp.x - glob.x, wisp.y - glob.y) < 14 + 7) {
        glob.active = false;
        if (wisp.invuln <= 0) {
          events = takeHit(world, events);
          if (events & EVENT_OVER) return events;
        }
      }
    }

    // BOSS: a dash through it lands one of its hits; a plain touch costs a heart.
    const boss = world.boss;
    if (boss && boss.active) {
      const d = Math.hypot(wisp.x - boss.x, wisp.y - boss.y);
      if (d < 14 + boss.radius) {
        if (wisp.dashTime > 0) {
          boss.hits -= 1;
          wisp.dashTime = 0; // one hit per dash, then the wisp bounces off
          wisp.vx *= -0.6;
          wisp.vy *= -0.6;
          burst(world, boss.x, boss.y, '#ff5df2', 22, 200);
          if (boss.hits <= 0) {
            boss.active = false;
            world.score += Math.round(boss.killPoints * world.tide.mult);
            world.stats.bossesKilled += 1;
            burst(world, boss.x, boss.y, '#b06cff', 30, 260);
            unlockFeat(world, 'bossbane');
            events |= EVENT_BOSS_KILL;
          } else {
            events |= EVENT_BOSS_HIT;
          }
        } else if (wisp.invuln <= 0) {
          events = takeHit(world, events);
          if (events & EVENT_OVER) return events;
        }
      }
    }
  }

  // Bloom clear: every glowcap bloomed. The BOSS may still be alive — killing
  // it is a bonus, not the gate; the glowcaps are the win condition.
  if (wisp.alive && capsLeft(world) === 0) {
    const bonus = GAME.bloomBonusBase + GAME.bloomBonusPerBloom * world.bloom + GAME.lifeBonus * world.lives;
    world.score += Math.round(bonus * world.tide.mult);
    world.stats.bloomsCleared += 1;
    world.stats.perBloom.push({ bloom: world.bloom, score: world.score, lives: world.lives });
    if (world.relics.cache) world.sporeBank += 15;
    if (world.bloom === 1) unlockFeat(world, 'first');
    if (world.hitsThisBloom === 0) unlockFeat(world, 'unbroken');
    if (Object.keys(world.relics).filter((id) => world.relics[id]).length >= 6) unlockFeat(world, 'relics6');
    events |= EVENT_CLEAR;
    if (world.bloom >= GAME.blooms) {
      // The dawn breaks: the campaign is won.
      world.won = true;
      saveBest(world);
      unlockFeat(world, 'dawn');
      if (world.tide.id === 'blightstorm') unlockFeat(world, 'stormdawn');
      return events | EVENT_WIN;
    }
    world.bloom += 1;
    startBloom(world);
  }

  return events;
}

// Slow factor for the wisp this frame (thorns). Thornproof relic: thorns
// barely slow.
export function slowFactorAt(world, x, y) {
  const inThorn = world.thorns.some((t) => Math.hypot(x - t.x, y - t.y) < t.radius);
  if (!inThorn) return 1;
  if (world.relics.thornproof) return 0.8;
  return world.phase.thorn;
}

// Grade for the victory screen, from the run: S for a near-perfect dawn.
export function gradeForRun(world) {
  const deaths = world.stats.hitsTaken;
  if (world.tide.id === 'blightstorm' && deaths <= 3) return 'S';
  if (deaths === 0) return 'S';
  if (deaths <= 3) return 'A';
  if (deaths <= 6) return 'B';
  return 'C';
}
