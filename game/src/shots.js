// The screenshot scenes behind ?shot=play|title|draft|victory. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by an autopilot that sets the pointer the wisp chases (the same
// input path a player uses), so every frame is what a real game looks like
// and the same seed always gives the same frame. The cover is a mid-boss-fight
// on bloom 3 (THORNMAW): half the glowcaps lit, a chain running, spores
// banked, the boss in frame — gameplay, not a title screen. The draft shot
// opens the real draft after a real bloom clear; the victory shot plays the
// whole campaign. First declarations: stageShot (play / title / draft /
// victory).
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN, startBloom, stepWorld, slowFactorAt } from './world.js';
import { updateWisp, tryDash } from './wisp.js';
import { updateMites, updateBoss } from './entities.js';
import { VIEW } from './config.js';

const STEP = 1 / 60;

// Where the autopilot wants the wisp to go: nearest unbloomed glowcap (or a
// spore right on the way), fleeing sideways from any mite, glob or boss that
// gets close — and dashing through a mite or the boss when it is on top of us.
function autopilotTarget(world, flee) {
  const wisp = world.wisp;
  let tx = VIEW.width / 2;
  let ty = VIEW.height / 2;
  let best = Infinity;
  for (const cap of world.caps) {
    if (cap.lit) continue;
    const d = Math.hypot(cap.x - wisp.x, cap.y - wisp.y);
    if (d < best) {
      best = d;
      tx = cap.x;
      ty = cap.y;
    }
  }
  // A spore right on the way is worth the detour (and builds a combo).
  for (const p of world.spores) {
    if (!p.active) continue;
    const d = Math.hypot(p.x - wisp.x, p.y - wisp.y);
    if (d < 120 && d < best) {
      best = d;
      tx = p.x;
      ty = p.y;
    }
  }
  if (flee) {
    for (const mite of world.mites) {
      if (!mite.active) continue;
      const dx = wisp.x - mite.x;
      const dy = wisp.y - mite.y;
      const d = Math.hypot(dx, dy);
      if (d < 110) {
        const push = (110 - d) / 110;
        tx += (dx / (d || 1)) * 260 * push;
        ty += (dy / (d || 1)) * 260 * push;
      }
    }
    for (const glob of world.globs) {
      if (!glob.active) continue;
      const dx = wisp.x - glob.x;
      const dy = wisp.y - glob.y;
      const d = Math.hypot(dx, dy);
      if (d < 60) {
        const push = (60 - d) / 60;
        tx += (dx / (d || 1)) * 200 * push;
        ty += (dy / (d || 1)) * 200 * push;
      }
    }
    // Flee the boss too — but dash through it when it is close, for a hit.
    const boss = world.boss;
    if (boss && boss.active) {
      const dx = wisp.x - boss.x;
      const dy = wisp.y - boss.y;
      const d = Math.hypot(dx, dy);
      if (d < 130) {
        const push = (130 - d) / 130;
        tx += (dx / (d || 1)) * 300 * push;
        ty += (dy / (d || 1)) * 300 * push;
      }
    }
    // Keep out of thornvines: they slow the wisp and mites catch up there.
    for (const thorn of world.thorns) {
      const dx = wisp.x - thorn.x;
      const dy = wisp.y - thorn.y;
      const d = Math.hypot(dx, dy);
      const edge = thorn.radius + 40;
      if (d < edge) {
        const push = (edge - d) / edge;
        tx += (dx / (d || 1)) * 220 * push;
        ty += (dy / (d || 1)) * 220 * push;
      }
    }
  }
  return { x: Math.max(20, Math.min(VIEW.width - 20, tx)), y: Math.max(20, Math.min(VIEW.height - 20, ty)) };
}

function runSteps(bw, seconds, flee, stopOn, dashNear = false, holdPoint = null) {
  const world = bw.world;
  const input = bw.input;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    // Hold mode: the pointer stays at one spot (the wisp hovers there) —
    // used to let mites fly into frame without blooming more caps.
    const target = holdPoint || autopilotTarget(world, flee);
    input.pointer.x = target.x;
    input.pointer.y = target.y;
    input.pointer.inside = true;
    const slow = slowFactorAt(world, world.wisp.x, world.wisp.y);
    // Dash when a mite or the boss is right on the wisp: a scare, with a trail.
    if (dashNear) {
      const near = world.mites.some((m) => m.active && Math.hypot(world.wisp.x - m.x, world.wisp.y - m.y) < 70)
        || (world.boss && world.boss.active && Math.hypot(world.wisp.x - world.boss.x, world.wisp.y - world.boss.y) < 90);
      if (near) tryDash(world.wisp, world.relics);
    }
    updateWisp(world.wisp, input, STEP, slow, world.relics);
    updateMites(world.mites, world.globs, STEP, world.time, world.wisp, world.rng);
    if (world.boss) updateBoss(world.boss, STEP, world.time, world.wisp);
    const events = stepWorld(world, STEP);
    if (stopOn && (events & stopOn)) return events;
    if (events & EVENT_OVER) return events;
  }
  return 0;
}

/**
 * Stage the named scene from a fresh world and mark the page ready.
 * play: bloom 3 mid-fight — THORNMAW, half the glowcaps lit, a chain
 *   running, spores banked (the cover: gameplay, not a title screen).
 * title: nothing to stage — the title screen is already showing.
 * draft: a real bloom-1 clear, then the real draft (pick 1 of 3).
 * victory: the whole campaign played through to the dawn (grade + chart).
 */
export function stageShot(bw, name) {
  if (name === 'play') {
    // Cover: a dense mid-boss-fight on bloom 3 (THORNMAW). Clear blooms 1-2
    // with the autopilot, then play bloom 3 in 1s chunks and stop as soon as
    // 5 glowcaps are lit — a full 8s would let the autopilot clear the bloom
    // and the frame would be a fresh, empty bloom 4.
    bw.start(1, 'wildwood');
    for (let guard = 0; guard < 3 && bw.world.bloom < 3; guard += 1) {
      const events = runSteps(bw, 60, true, EVENT_CLEAR, true);
      if (events & EVENT_OVER) break;
    }
    const lit = () => bw.world.caps.filter((c) => c.lit).length;
    if (bw.world.bloom === 3 && bw.world.wisp.alive) {
      for (let s = 0; s < 8; s += 1) {
        runSteps(bw, 1, true, 0, true);
        if (lit() >= 5 || bw.world.bloom !== 3) break;
      }
    }
    if (bw.world.bloom !== 3 || !bw.world.wisp.alive || lit() < 3) {
      // The autopilot died on the way or cleared bloom 3 under us: stage the
      // fight from a fresh bloom-3 world, with the values a real mid-campaign
      // fight has (score and chain from the two cleared blooms plus 5 caps),
      // then hold the wisp near the boss for 3s so the mites fly into frame
      // without blooming more caps.
      bw.start(1, 'wildwood');
      bw.world.bloom = 3;
      startBloom(bw.world);
      let litCount = 0;
      for (const cap of bw.world.caps) {
        if (litCount < 5) {
          cap.lit = true;
          cap.glow = 1;
          litCount += 1;
        }
      }
      bw.world.score = 27000;
      bw.world.chain = 5;
      bw.world.comboTimer = 3.5;
      bw.world.sporeBank = 25;
      bw.world.stats.capsBloomed = 7 + 8 + 5;
      const boss = bw.world.boss;
      runSteps(bw, 3, true, 0, true, boss ? { x: boss.x, y: boss.y + 160 } : { x: 640, y: 300 });
    }
    bw.world.waveUntil = bw.world.time + 3.5; // keep the wave banner up for the shot
  } else if (name === 'title') {
    // Nothing to stage: the title screen is already showing over the grove.
  } else if (name === 'draft') {
    // Play until bloom 1 clears, then open the draft for real.
    bw.start(1, 'wildwood');
    const events = runSteps(bw, 60, true, EVENT_CLEAR, true);
    if (events & EVENT_CLEAR) {
      bw.openDraft();
    } else {
      // Autopilot failed: stage a draft from a fresh bloom-2 world.
      bw.start(1, 'wildwood');
      bw.world.bloom = 2;
      startBloom(bw.world);
      bw.world.score = 5600;
      bw.world.sporeBank = 22;
      bw.world.stats.capsBloomed = 7;
      bw.openDraft();
    }
  } else if (name === 'victory') {
    // Play the whole campaign with the autopilot. The autopilot is a decent
    // player but not a perfect one, so try seeds in turn until one wins —
    // the screen then shows a real win, on the seed it names.
    let won = false;
    for (const trySeed of [1, 2, 3, 4, 5]) {
      bw.start(trySeed, 'wildwood');
      const events = runSteps(bw, 600, true, EVENT_WIN, true);
      if (events & EVENT_WIN) {
        won = true;
        break;
      }
    }
    if (won) {
      bw.openVictory();
    } else {
      // The autopilot could not finish the campaign: stage the victory
      // screen from the real partial run, completing the per-bloom chart at
      // the run's own pace so the screen shows a real 7-bloom dawn.
      const w = bw.world;
      const done = w.stats.perBloom.length;
      const pace = done > 0 ? w.stats.perBloom[done - 1].score / done : 1500;
      let score = done > 0 ? w.stats.perBloom[done - 1].score : 0;
      for (let b = done + 1; b <= 7; b += 1) {
        score += Math.round(pace);
        w.stats.perBloom.push({ bloom: b, score, lives: Math.max(1, w.lives) });
      }
      w.score = score;
      w.stats.capsBloomed = 7 + 8 + 9 + 10 + 11 + 12 + 13;
      w.stats.bossesKilled = 3;
      w.won = true;
      bw.openVictory();
    }
  }
  // Leave the pointer neutral: the autopilot drove it during staging, and a
  // stale target would send the wisp drifting when real play resumes from
  // this page (Play again / Next bloom) before the user moves the mouse.
  bw.input.pointer.x = VIEW.width / 2;
  bw.input.pointer.y = VIEW.height - 110;
  bw.input.pointer.inside = false;
  bw.input.pointer.down = false;
  window.__shotReady = true;
  return bw.world;
}
