// The grove's other inhabitants: mites in 4 kinds (moving danger), thornvines
// (sticky slow zones), spores (the pickups and the currency), and the BOSSES
// (THORNMAW on bloom 3, BLIGHTMAW on bloom 5, THE ROTKING on bloom 7 — a
// giant blight-beast, dash-hits to kill). All spawn from a seeded RNG so
// ?seed=N replays. First declarations: spawnMites, spawnBoss, updateBoss,
// incomingList, drawMite.
import { BOSS, BOSSES, GLOWCAPS, MITES, MITE_KINDS, SPORES, THORNS, VIEW } from './config.js';

// Which mite kinds a bloom can meet, and their share of the spawn.
export function kindsForBloom(bloom) {
  return MITE_KINDS.filter((k) => k.firstBloom <= bloom);
}

export function spawnMites(rng, bloom, phase, tide) {
  const kinds = kindsForBloom(bloom);
  const totalWeight = kinds.reduce((s, k) => s + k.weight, 0);
  const count = Math.max(
    1,
    Math.min(MITES.maxCount, MITES.baseCount + (bloom - 1) + tide.extraMites),
  );
  const mites = [];
  for (let i = 0; i < count; i += 1) {
    let pick = rng.next() * totalWeight;
    let kind = kinds[0];
    for (const k of kinds) {
      pick -= k.weight;
      if (pick <= 0) {
        kind = k;
        break;
      }
    }
    const fromLeft = rng.next() < 0.5;
    const baseSpeed = (MITES.baseSpeed + MITES.speedPerLevel * (bloom - 1)) * phase.mite * tide.miteMult;
    mites.push({
      kind: kind.id,
      name: kind.name,
      x: fromLeft ? -30 : VIEW.width + 30,
      y: rng.range(90, VIEW.height - 160),
      dir: fromLeft ? 1 : -1,
      speed: baseSpeed * (kind.id === 'dart' ? 1.7 : kind.id === 'bulwark' ? 0.55 : 1) * (0.9 + rng.next() * 0.3),
      amp: rng.range(MITES.sineAmpMin, MITES.sineAmpMax),
      freq: rng.range(1.2, 2.4),
      phase: rng.range(0, Math.PI * 2),
      baseY: 0,
      flap: rng.range(0, Math.PI * 2),
      radius: kind.id === 'bulwark' ? 24 : kind.id === 'dart' ? 12 : MITES.radius,
      hits: kind.id === 'bulwark' ? 2 : 1, // Bulwark takes 2 dash-hits
      hitCd: 0, // seconds until the next dash-hit can land: one dash spends
      // one hit, however long the wisp overlaps the mite (a Bulwark needs
      // 2 separate dashes, not one pass through it)
      spitTimer: kind.id === 'spitter' ? rng.range(1.5, 3) : 0,
      active: true,
    });
    mites[i].baseY = mites[i].y;
  }
  return mites;
}

export function updateMites(mites, globs, dt, time, wisp, rng) {
  // rng is the world's seeded RNG: mite re-entry lanes come from it, so a
  // ?seed=N run replays exactly (no Math.random in gameplay).
  for (const mite of mites) {
    if (!mite.active) continue;
    mite.flap += dt * 14;
    if (mite.hitCd > 0) mite.hitCd -= dt;
    if (mite.kind === 'dart') {
      // Darts fly straight and fast, then turn at the edge.
      mite.x += mite.dir * mite.speed * dt;
      mite.y = mite.baseY + Math.sin(time * 0.8 + mite.phase) * 12;
    } else {
      mite.x += mite.dir * mite.speed * dt;
      mite.y = mite.baseY + Math.sin(time * mite.freq + mite.phase) * mite.amp;
    }
    if (mite.dir > 0 && mite.x > VIEW.width + 40) {
      mite.x = -40;
      mite.baseY = Math.max(70, Math.min(VIEW.height - 140, mite.baseY + (rng.next() - 0.5) * 140));
    } else if (mite.dir < 0 && mite.x < -40) {
      mite.x = VIEW.width + 40;
      mite.baseY = Math.max(70, Math.min(VIEW.height - 140, mite.baseY + (rng.next() - 0.5) * 140));
    }
    // Spitters lob a slow blight glob at the wisp every few seconds.
    if (mite.kind === 'spitter') {
      mite.spitTimer -= dt;
      if (mite.spitTimer <= 0 && wisp && wisp.alive) {
        mite.spitTimer = 3.5;
        const dx = wisp.x - mite.x;
        const dy = wisp.y - mite.y;
        const d = Math.hypot(dx, dy) || 1;
        globs.push({ x: mite.x, y: mite.y, vx: (dx / d) * 110, vy: (dy / d) * 110, life: 5, active: true });
      }
    }
  }
  for (const glob of globs) {
    if (!glob.active) continue;
    glob.x += glob.vx * dt;
    glob.y += glob.vy * dt;
    glob.life -= dt;
    if (glob.life <= 0 || glob.x < -20 || glob.x > VIEW.width + 20 || glob.y < -20 || glob.y > VIEW.height + 20) {
      glob.active = false;
    }
  }
}

// BOSS: THORNMAW / BLIGHTMAW / THE ROTKING. Spawns top-centre, drifts in a
// wide sine like a mite, and every few seconds telegraphs (flashes) then
// swoops at the wisp.
export function spawnBoss(rng, bloom) {
  const spec = BOSSES[bloom];
  return {
    name: spec.name,
    x: VIEW.width / 2 + rng.range(-160, 160),
    y: 150,
    dir: rng.next() < 0.5 ? 1 : -1,
    speed: 60,
    amp: 80,
    freq: 0.9,
    phase: rng.range(0, Math.PI * 2),
    baseY: 150,
    flap: 0,
    active: true,
    hits: spec.hits,
    maxHits: spec.hits,
    radius: spec.radius,
    killPoints: spec.killPoints,
    color: spec.color,
    eye: spec.eye,
    swoopTimer: 2.5, // seconds until the first swoop
    swooping: 0, // seconds of swoop left
    telegraph: 0, // seconds of flashing left before a swoop
    vx: 0,
    vy: 0,
  };
}

export function updateBoss(boss, dt, time, wisp) {
  if (!boss.active) return;
  boss.flap += dt * 10;
  // Escalation, matching the boss bar: a hurt boss swoops more often, and
  // at its last hit faster (PHASE 2: every 3.2s; ENRAGED: every 2.5s at
  // 240 px/s, from a base of 4.0s at 185 px/s).
  const swoopInterval = boss.hits <= 1 ? 2.5 : boss.hits < boss.maxHits ? 3.2 : BOSS.swoopEvery;
  const swoopSpeed = boss.hits <= 1 ? 240 : BOSS.swoopSpeed;
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph <= 0) {
      // Swoop: velocity straight at the wisp's current spot.
      const dx = wisp.x - boss.x;
      const dy = wisp.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      boss.vx = (dx / d) * swoopSpeed;
      boss.vy = (dy / d) * swoopSpeed;
      boss.swooping = 0.9;
    }
    return;
  }
  if (boss.swooping > 0) {
    boss.swooping -= dt;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.x = Math.max(50, Math.min(VIEW.width - 50, boss.x));
    boss.y = Math.max(60, Math.min(VIEW.height - 70, boss.y));
    if (boss.swooping <= 0) {
      boss.baseY = boss.y;
      boss.swoopTimer = swoopInterval;
    }
    return;
  }
  boss.swoopTimer -= dt;
  boss.x += boss.dir * boss.speed * dt;
  boss.y = boss.baseY + Math.sin(time * boss.freq + boss.phase) * boss.amp;
  if (boss.dir > 0 && boss.x > VIEW.width - 60) boss.dir = -1;
  else if (boss.dir < 0 && boss.x < 60) boss.dir = 1;
  if (boss.swoopTimer <= 0 && wisp.alive) boss.telegraph = BOSS.telegraph;
}

export function drawBoss(ctx, boss, time) {
  if (!boss.active) return;
  const flash = boss.telegraph > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.scale(boss.dir, 1);
  // Warning glow while telegraphing a swoop.
  if (flash) {
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, boss.radius + 60);
    glow.addColorStop(0, 'rgba(255, 46, 46, 0.5)');
    glow.addColorStop(1, 'rgba(255, 46, 46, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius + 60, 0, Math.PI * 2);
    ctx.fill();
  }
  const flap = Math.sin(boss.flap) * 0.5;
  ctx.fillStyle = boss.color;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.35 + flap * 0.4));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * boss.radius * 0.9, -boss.radius * 0.7, side * boss.radius * 1.5, -boss.radius * 0.15);
    ctx.quadraticCurveTo(side * boss.radius * 0.8, boss.radius * 0.25, 0, boss.radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Body + jagged thorn crown + glowing eyes.
  ctx.beginPath();
  ctx.ellipse(0, 0, boss.radius * 0.55, boss.radius * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-boss.radius * 0.35, -boss.radius * 0.28);
  ctx.lineTo(-boss.radius * 0.18, -boss.radius * 0.62);
  ctx.lineTo(0, -boss.radius * 0.34);
  ctx.lineTo(boss.radius * 0.18, -boss.radius * 0.62);
  ctx.lineTo(boss.radius * 0.35, -boss.radius * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = boss.eye;
  ctx.beginPath();
  ctx.arc(boss.radius * 0.25, -boss.radius * 0.1, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Name tag above the boss, so the screenshot names it.
  ctx.save();
  ctx.font = '700 14px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 93, 242, 0.95)';
  ctx.fillText(boss.name, boss.x, boss.y - boss.radius - 18);
  ctx.restore();
}

// INCOMING list for a bloom: what the wave banner and the queue panel name.
export function incomingList(bloom, phase, tide) {
  const kinds = kindsForBloom(bloom);
  const count = Math.max(1, Math.min(MITES.maxCount, MITES.baseCount + (bloom - 1) + tide.extraMites));
  const boss = BOSSES[bloom];
  const caps = GLOWCAPS.baseCount + (bloom - 1);
  return {
    bloom, count, caps, boss: boss ? boss.name : null, phase: phase.name,
    kinds: kinds.map((k) => k.name),
    text: `BLOOM ${bloom} — INCOMING: ${count} MITES${boss ? ` + ${boss.name} BOSS` : ''} · ${caps} GLOWCAPS · PHASE: ${phase.name} (${phase.blurb})`,
  };
}

const KIND_COLORS = { mite: '#1c1030', dart: '#241a3d', spitter: '#33122e', bulwark: '#2b1a10' };
const KIND_EYES = { mite: '#ff5df2', dart: '#ffd23d', spitter: '#7dffce', bulwark: '#ff8a3d' };

export function drawMite(ctx, mite) {
  ctx.save();
  ctx.translate(mite.x, mite.y);
  ctx.scale(mite.dir, 1);
  const flap = Math.sin(mite.flap) * 0.6;
  const r = mite.radius;
  ctx.fillStyle = KIND_COLORS[mite.kind] || '#1c1030';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.4 + flap * 0.45));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * r * 0.6, -r * 0.45, side * r, -r * 0.08);
    ctx.quadraticCurveTo(side * r * 0.55, r * 0.15, 0, r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.55, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bulwark shows its second hit as a cracked shell line.
  if (mite.kind === 'bulwark' && mite.hits < 2) {
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.2);
    ctx.lineTo(0, r * 0.1);
    ctx.lineTo(r * 0.3, -r * 0.25);
    ctx.stroke();
  }
  ctx.fillStyle = KIND_EYES[mite.kind] || '#ff5df2';
  ctx.beginPath();
  ctx.arc(r * 0.25, -r * 0.12, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGlob(ctx, glob) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 93, 242, 0.9)';
  ctx.beginPath();
  ctx.arc(glob.x, glob.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 93, 242, 0.25)';
  ctx.beginPath();
  ctx.arc(glob.x, glob.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function spawnThorns(rng, bloom, caps) {
  const count = Math.min(THORNS.baseCount + Math.floor((bloom - 1) / 2), THORNS.maxCount);
  const thorns = [];
  let guard = 0;
  while (thorns.length < count && guard < 60) {
    guard += 1;
    const thorn = {
      x: rng.range(110, VIEW.width - 110),
      y: rng.range(110, VIEW.height - 130),
      radius: rng.range(THORNS.radiusMin, THORNS.radiusMax),
    };
    // Keep thorns clear of glowcaps and of the wisp's start, so a bloom is fair.
    const clearOfCaps = caps.every((c) => Math.hypot(c.x - thorn.x, c.y - thorn.y) > thorn.radius + 80);
    const clearOfStart = Math.hypot(thorn.x - VIEW.width / 2, thorn.y - (VIEW.height - 110)) > thorn.radius + 90;
    const clearOfThorns = thorns.every((t) => Math.hypot(t.x - thorn.x, t.y - thorn.y) > t.radius + thorn.radius + 40);
    if (clearOfCaps && clearOfStart && clearOfThorns) thorns.push(thorn);
  }
  return thorns;
}

export function drawThorn(ctx, thorn, time) {
  ctx.save();
  ctx.translate(thorn.x, thorn.y);
  ctx.strokeStyle = 'rgba(120, 220, 160, 0.45)';
  ctx.lineWidth = 1.5;
  // Tangled vines: curved lines from the centre, with thorn spikes.
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const ex = Math.cos(a) * thorn.radius;
    const ey = Math.sin(a) * thorn.radius;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a + 0.5) * thorn.radius * 0.5, Math.sin(a + 0.5) * thorn.radius * 0.5, ex, ey);
    ctx.stroke();
    // A spike halfway out.
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * thorn.radius * 0.5, Math.sin(a) * thorn.radius * 0.5);
    ctx.lineTo(Math.cos(a + 0.35) * thorn.radius * 0.62, Math.sin(a + 0.35) * thorn.radius * 0.62);
    ctx.lineTo(Math.cos(a - 0.2) * thorn.radius * 0.62, Math.sin(a - 0.2) * thorn.radius * 0.62);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120, 220, 160, 0.6)';
    ctx.fill();
  }
  // A dark heart in the middle.
  ctx.fillStyle = '#0d1f1a';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function spawnSpore(rng, existing, caps) {
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const p = {
      x: rng.range(50, VIEW.width - 50),
      y: rng.range(60, VIEW.height - 80),
      r: SPORES.radius,
      phase: rng.range(0, Math.PI * 2),
      active: true,
    };
    const clear = caps.every((c) => Math.hypot(c.x - p.x, c.y - p.y) > 60)
      && existing.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 40);
    if (clear) return p;
  }
  return null;
}

export function drawSpore(ctx, p, time) {
  const pulse = 0.7 + Math.sin(time * 3 + p.phase) * 0.3;
  const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 16 * pulse);
  glow.addColorStop(0, 'rgba(255, 210, 61, 0.9)');
  glow.addColorStop(1, 'rgba(255, 210, 61, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 16 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
  ctx.fill();
}
