// The screenshot scenes behind ?shot=start|play|clear|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// an autopilot that sets the pointer the moth chases (the same input path a
// player uses), so every frame is what a short game really looks like and the
// same seed always gives the same frame. The 'end' pilot is timid — it chases
// lamps but never flees bats — so it is caught out, as a hurried player is.
import { EVENT_CLEAR, EVENT_OVER, stepWorld } from './world.js';
import { updateMoth } from './moth.js';
import { updateBats } from './entities.js';
import { VIEW } from './config.js';

const STEP = 1 / 60;
const START_SECONDS = 5;
const PLAY_SECONDS = 14;
const CLEAR_SECONDS = 40;
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
  }
  return { x: Math.max(20, Math.min(VIEW.width - 20, tx)), y: Math.max(20, Math.min(VIEW.height - 20, ty)) };
}

function runSteps(world, input, seconds, flee, stopOn) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = autopilotTarget(world, flee);
    input.pointer.x = target.x;
    input.pointer.y = target.y;
    input.pointer.inside = true;
    const slow = world.webs.some((w) => Math.hypot(world.moth.x - w.x, world.moth.y - w.y) < w.radius) ? 0.45 : 1;
    updateMoth(world.moth, input, STEP, slow);
    updateBats(world.bats, STEP, world.time);
    const events = stepWorld(world, STEP);
    if (stopOn && (events & stopOn)) return events;
    if (events & EVENT_OVER) return events;
  }
  return 0;
}

// The title backdrop: the garden drifts (bats fly, fireflies wander, stars
// twinkle) while the moth rests at its start — exactly what a fresh game shows
// behind the title screen, with score 0 and level 1.
function driftSteps(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.time += STEP;
    updateBats(world.bats, STEP, world.time);
  }
}

/**
 * Set `world` to the named scene and return which screen to draw over it.
 * start: a few seconds of garden drift behind the title.
 * play: mid-game, lamps half lit, combo running.
 * clear: the moment the last lamp lights (level-clear screen).
 * end: played until the moth runs out of lives (game-over screen).
 */
export function stageShot(name, world, input) {
  if (name === 'play') {
    runSteps(world, input, PLAY_SECONDS, true, 0);
    return { screen: 'play', score: world.score };
  }
  if (name === 'clear') {
    // Play until a level clears, then leave the world on the fresh next level
    // with the clear screen up: the clear overlay shows the bonus.
    const events = runSteps(world, input, CLEAR_SECONDS, true, EVENT_CLEAR);
    if (events & EVENT_CLEAR) return { screen: 'clear', score: world.score };
    return { screen: 'play', score: world.score };
  }
  if (name === 'end') {
    runSteps(world, input, END_LIMIT_SECONDS, false, EVENT_OVER);
    return { screen: 'over', score: world.score };
  }
  driftSteps(world, START_SECONDS);
  return { screen: 'title', score: 0 };
}
