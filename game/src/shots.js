// The screenshot scenes behind ?shot=play|boss|clear|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// an autopilot that sets the pointer the moth chases (the same input path a
// player uses), so every frame is what a short game really looks like and the
// same seed always gives the same frame. The 'end' pilot is timid — it chases
// lamps but never flees bats — so it is caught out, as a hurried player is.
// First declarations: stageShot (play / boss / clear / end).
import { EVENT_CLEAR, EVENT_OVER, startLevel, stepWorld } from './world.js';
import { updateMoth, tryDash } from './moth.js';
import { updateBats, updateBoss } from './entities.js';
import { VIEW } from './config.js';

const STEP = 1 / 60;
const PLAY_SECONDS = 12;
const CLEAR_SECONDS = 60;
const BOSS_SECONDS = 8;
const END_LIMIT_SECONDS = 600;

// Where the autopilot wants the moth to go: nearest unlit lamp (or pollen),
// detouring for pollen right in its path, and fleeing sideways from any bat
// that gets close.
function autopilotTarget(world, flee) {
  const moth = world.moth;
  let tx = VIEW.width / 2;
  let ty = VIEW.height / 2;
  let best = Infinity;
  for (const lamp of world.lamps) {
    if (lamp.lit) continue;
    const d = Math.hypot(lamp.x - moth.x, lamp.y - moth.y);
    if (d < best) {
      best = d;
      tx = lamp.x;
      ty = lamp.y;
    }
  }
  // A pollen mote right on the way is worth the detour (and builds a combo).
  for (const p of world.pollen) {
    const d = Math.hypot(p.x - moth.x, p.y - moth.y);
    if (d < 120 && d < best) {
      best = d;
      tx = p.x;
      ty = p.y;
    }
  }
  if (flee) {
    for (const bat of world.bats) {
      if (!bat.active) continue;
      const dx = moth.x - bat.x;
      const dy = moth.y - bat.y;
      const d = Math.hypot(dx, dy);
      if (d < 110) {
        const push = (110 - d) / 110;
        tx += (dx / (d || 1)) * 260 * push;
        ty += (dy / (d || 1)) * 260 * push;
      }
    }
    // Flee the boss too — but dash through it when it is close, for a hit.
    const boss = world.boss;
    if (boss && boss.active) {
      const dx = moth.x - boss.x;
      const dy = moth.y - boss.y;
      const d = Math.hypot(dx, dy);
      if (d < 130) {
        const push = (130 - d) / 130;
        tx += (dx / (d || 1)) * 300 * push;
        ty += (dy / (d || 1)) * 300 * push;
      }
    }
  }
  return { x: Math.max(20, Math.min(VIEW.width - 20, tx)), y: Math.max(20, Math.min(VIEW.height - 20, ty)) };
}

function runSteps(world, input, seconds, flee, stopOn, dashNear = false) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = autopilotTarget(world, flee);
    input.pointer.x = target.x;
    input.pointer.y = target.y;
    input.pointer.inside = true;
    const slow = world.webs.some((w) => Math.hypot(world.moth.x - w.x, world.moth.y - w.y) < w.radius) ? 0.45 : 1;
    // Dash when a bat or the boss is right on the moth: a scare, with a trail.
    if (dashNear) {
      const near = world.bats.some((b) => b.active && Math.hypot(world.moth.x - b.x, world.moth.y - b.y) < 70)
        || (world.boss && world.boss.active && Math.hypot(world.moth.x - world.boss.x, world.moth.y - world.boss.y) < 90);
      if (near) tryDash(world.moth, world.upgrades);
    }
    updateMoth(world.moth, input, STEP, slow, world.upgrades);
    updateBats(world.bats, STEP, world.time);
    if (world.boss) updateBoss(world.boss, STEP, world.time, world.moth);
    const events = stepWorld(world, STEP);
    if (stopOn && (events & stopOn)) return events;
    if (events & EVENT_OVER) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene and return which screen to draw over it.
 * play: level 3 mid-game — lamps half lit, combo running, bats close, a dash
 *   trail in frame (the cover: gameplay, not a title screen).
 * boss: level 5 — the MOTH-EATER mid-fight, boss bar and wave banner up.
 * clear: the moment the last lamp lights (level-clear screen + pollen shop).
 * end: played until the moth runs out of lives (game-over screen).
 */
export function stageShot(name, world, input) {
  if (name === 'play') {
    // Clear levels 1-2, then play level 3 for a while: a dense, live garden.
    for (let guard = 0; guard < 3 && world.level < 3; guard += 1) {
      const events = runSteps(world, input, CLEAR_SECONDS, true, EVENT_CLEAR, true);
      if (events & EVENT_OVER) break;
    }
    runSteps(world, input, PLAY_SECONDS, true, 0, true);
    return { screen: 'play', score: world.score };
  }
  if (name === 'boss') {
    // Jump straight to level 5: the MOTH-EATER, 7 bats, 8 lamps, full moon.
    world.level = 5;
    startLevel(world);
    // A mid-fight frame: half the lamps lit, a combo running, pollen banked.
    let lit = 0;
    for (const lamp of world.lamps) {
      if (lit < 4) {
        lamp.lit = true;
        lamp.glow = 1;
        lit += 1;
      }
    }
    world.score = 4200;
    world.combo = 5;
    world.comboTimer = 3.5;
    world.pollenBank = 34;
    runSteps(world, input, BOSS_SECONDS, true, 0, true);
    world.waveUntil = world.time + 3.5; // keep the wave banner up for the shot
    return { screen: 'play', score: world.score };
  }
  if (name === 'clear') {
    // Play until a level clears (the clear screen + SHOP), then keep playing
    // while the bank is short of the cheapest upgrade: the shop screenshot
    // should show a real "Buy" state, not only "Need more pollen". Stop at
    // three clears, or as soon as the moth takes a hit — a hurt moth keeps
    // the clear it already earned.
    let clears = 0;
    while (clears < 3) {
      const events = runSteps(world, input, CLEAR_SECONDS, true, EVENT_CLEAR, true);
      if (!(events & EVENT_CLEAR)) break;
      clears += 1;
      if (world.pollenBank >= 20 || world.lives < 3 || !world.moth.alive) break;
    }
    if (clears > 0) return { screen: 'clear', score: world.score };
    return { screen: 'play', score: world.score };
  }
  if (name === 'end') {
    runSteps(world, input, END_LIMIT_SECONDS, false, EVENT_OVER);
    return { screen: 'over', score: world.score };
  }
  return { screen: 'play', score: world.score };
}
