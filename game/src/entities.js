// The garden's other inhabitants: bats (moving danger), webs (sticky slow zones),
// pollen (the pickups), and the MOTH-EATER boss (a giant bat, 3 dash-hits to
// kill, every 5th level). All spawn from a seeded RNG so ?seed=N replays.
// First declarations: spawnBats, spawnBoss, updateBoss, incomingList.
import { BATS, BOSS, POLLEN, VIEW, WEBS } from './config.js';

export function spawnBats(rng, level, moon) {
  const count = Math.min(BATS.baseCount + (level - 1), BATS.maxCount);
  const bats = [];
  for (let i = 0; i < count; i += 1) {
    const fromLeft = rng.next() < 0.5;
    bats.push({
      x: fromLeft ? -30 : VIEW.width + 30,
      y: rng.range(70, VIEW.height - 120),
      dir: fromLeft ? 1 : -1,
      speed: (BATS.baseSpeed + BATS.speedPerLevel * (level - 1) + rng.range(-12, 22)) * moon.bat,
      amp: rng.range(BATS.sineAmpMin, BATS.sineAmpMax),
      freq: rng.range(1.2, 2.4),
      phase: rng.range(0, Math.PI * 2),
      baseY: 0,
      flap: rng.range(0, Math.PI * 2),
      active: true,
    });
    bats[i].baseY = bats[i].y;
  }
  return bats;
}

export function updateBats(bats, dt, time) {
  for (const bat of bats) {
    if (!bat.active) continue;
    bat.x += bat.dir * bat.speed * dt;
    bat.y = bat.baseY + Math.sin(time * bat.freq + bat.phase) * bat.amp;
    bat.flap += dt * 14;
    if (bat.dir > 0 && bat.x > VIEW.width + 40) {
      bat.x = -40;
      bat.baseY = Math.max(60, Math.min(VIEW.height - 110, bat.baseY + (Math.random() - 0.5) * 120));
    } else if (bat.dir < 0 && bat.x < -40) {
      bat.x = VIEW.width + 40;
      bat.baseY = Math.max(60, Math.min(VIEW.height - 110, bat.baseY + (Math.random() - 0.5) * 120));
    }
  }
}

// BOSS: the MOTH-EATER. Spawns top-centre, drifts in a wide sine like a bat,
// and every few seconds telegraphs (flashes) then swoops at the moth.
export function spawnBoss(rng) {
  return {
    x: VIEW.width / 2 + rng.range(-120, 120),
    y: 130,
    dir: rng.next() < 0.5 ? 1 : -1,
    speed: 55,
    amp: 70,
    freq: 0.9,
    phase: rng.range(0, Math.PI * 2),
    baseY: 130,
    flap: 0,
    active: true,
    hits: BOSS.hits,
    swoopTimer: 2.5, // seconds until the first swoop
    swooping: 0, // seconds of swoop left
    telegraph: 0, // seconds of flashing left before a swoop
    vx: 0,
    vy: 0,
  };
}

export function updateBoss(boss, dt, time, moth) {
  if (!boss.active) return;
  boss.flap += dt * 10;
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph <= 0) {
      // Swoop: velocity straight at the moth's current spot.
      const dx = moth.x - boss.x;
      const dy = moth.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      boss.vx = (dx / d) * BOSS.swoopSpeed;
      boss.vy = (dy / d) * BOSS.swoopSpeed;
      boss.swooping = 0.9;
    }
    return;
  }
  if (boss.swooping > 0) {
    boss.swooping -= dt;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.x = Math.max(40, Math.min(VIEW.width - 40, boss.x));
    boss.y = Math.max(50, Math.min(VIEW.height - 60, boss.y));
    if (boss.swooping <= 0) {
      boss.baseY = boss.y;
      boss.swoopTimer = BOSS.swoopEvery;
    }
    return;
  }
  boss.swoopTimer -= dt;
  boss.x += boss.dir * boss.speed * dt;
  boss.y = boss.baseY + Math.sin(time * boss.freq + boss.phase) * boss.amp;
  if (boss.dir > 0 && boss.x > VIEW.width - 50) boss.dir = -1;
  else if (boss.dir < 0 && boss.x < 50) boss.dir = 1;
  if (boss.swoopTimer <= 0 && moth.alive) boss.telegraph = BOSS.telegraph;
}

export function drawBoss(ctx, boss, time) {
  if (!boss.active) return;
  const flash = boss.telegraph > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.scale(boss.dir, 1);
  // Warning glow while telegraphing a swoop.
  if (flash) {
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
    glow.addColorStop(0, 'rgba(255, 46, 46, 0.5)');
    glow.addColorStop(1, 'rgba(255, 46, 46, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  const flap = Math.sin(boss.flap) * 0.5;
  ctx.fillStyle = '#2e1040';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.35 + flap * 0.4));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 34, -26, side * 56, -6);
    ctx.quadraticCurveTo(side * 30, 8, 0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Body + jagged crown tuft + glowing red eyes.
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, -10);
  ctx.lineTo(-6, -22);
  ctx.lineTo(0, -12);
  ctx.lineTo(6, -22);
  ctx.lineTo(12, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath();
  ctx.arc(9, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Name tag above the boss, so the screenshot names it.
  ctx.save();
  ctx.font = '700 13px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 46, 46, 0.9)';
  ctx.fillText(BOSS.name, boss.x, boss.y - 52);
  ctx.restore();
}

// INCOMING list for a level: what the wave banner names before it starts.
export function incomingList(level, moon) {
  const bats = Math.min(BATS.baseCount + (level - 1), BATS.maxCount);
  const boss = level % BOSS.every === 0;
  return `${bats} bats${boss ? ` + ${BOSS.name}` : ''} · moon ${moon.name.toLowerCase()}`;
}

export function drawBat(ctx, bat) {
  ctx.save();
  ctx.translate(bat.x, bat.y);
  ctx.scale(bat.dir, 1);
  const flap = Math.sin(bat.flap) * 0.6;
  ctx.fillStyle = '#241a3d';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.4 + flap * 0.45));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 16, -12, side * 26, -2);
    ctx.quadraticCurveTo(side * 14, 4, 0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath();
  ctx.arc(4, -2, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function spawnWebs(rng, level, lamps) {
  const count = Math.min(WEBS.baseCount + Math.floor((level - 1) / 2), WEBS.maxCount);
  const webs = [];
  let guard = 0;
  while (webs.length < count && guard < 60) {
    guard += 1;
    const web = {
      x: rng.range(90, VIEW.width - 90),
      y: rng.range(90, VIEW.height - 110),
      radius: rng.range(WEBS.radiusMin, WEBS.radiusMax),
    };
    // Keep webs clear of lamps and of the moth's start, so a level is fair.
    const clearOfLamps = lamps.every((l) => Math.hypot(l.x - web.x, l.y - web.y) > web.radius + 70);
    const clearOfStart = Math.hypot(web.x - VIEW.width / 2, web.y - (VIEW.height - 90)) > web.radius + 80;
    const clearOfWebs = webs.every((w) => Math.hypot(w.x - web.x, w.y - web.y) > w.radius + web.radius + 40);
    if (clearOfLamps && clearOfStart && clearOfWebs) webs.push(web);
  }
  return webs;
}

export function drawWeb(ctx, web, time) {
  ctx.save();
  ctx.translate(web.x, web.y);
  ctx.strokeStyle = 'rgba(230, 230, 245, 0.5)';
  ctx.lineWidth = 1;
  // Radial threads.
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * web.radius, Math.sin(a) * web.radius);
    ctx.stroke();
  }
  // Concentric rings, sagging slightly.
  for (let r = web.radius / 3; r < web.radius; r += web.radius / 3) {
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 8) {
      const rr = r + Math.sin(a * 3 + time * 0.6) * 1.5;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // The spider, waiting in the middle.
  ctx.fillStyle = '#1c1430';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function spawnPollen(rng, existing, lamps) {
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const p = {
      x: rng.range(40, VIEW.width - 40),
      y: rng.range(50, VIEW.height - 60),
      r: POLLEN.radius,
      phase: rng.range(0, Math.PI * 2),
      active: true,
    };
    const clear = lamps.every((l) => Math.hypot(l.x - p.x, l.y - p.y) > 50)
      && existing.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 34);
    if (clear) return p;
  }
  return null;
}

export function drawPollen(ctx, p, time) {
  const pulse = 0.7 + Math.sin(time * 3 + p.phase) * 0.3;
  const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 14 * pulse);
  glow.addColorStop(0, 'rgba(255, 233, 168, 0.9)');
  glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
}
