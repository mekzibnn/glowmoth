// The spore-wisp: position, velocity, dash, invulnerability, glow pulse,
// and drawing. Steers toward the pointer with smooth acceleration; arrow
// keys / WASD add a direct push. A dash is a short burst in the current
// move direction that also makes the wisp briefly untouchable. RELICS
// (draft): Swift Spores +15% speed, Long Dash recharges the dash in 0.7s.
import { VIEW, WISP } from './config.js';

export function createWisp() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height - 110,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // facing up
    pulse: 0, // glow pulse phase
    dashTime: 0, // seconds of dash left
    dashCooldown: 0,
    invuln: 0,
    trailTimer: 0,
    alive: true,
  };
}

export function resetWisp(wisp) {
  wisp.x = VIEW.width / 2;
  wisp.y = VIEW.height - 110;
  wisp.vx = 0;
  wisp.vy = 0;
  wisp.angle = -Math.PI / 2;
  wisp.dashTime = 0;
  wisp.dashCooldown = 0;
  wisp.invuln = 0;
  wisp.alive = true;
}

export function updateWisp(wisp, input, dt, slowFactor, relics = {}) {
  if (!wisp.alive) return;
  if (wisp.dashCooldown > 0) wisp.dashCooldown -= dt;
  if (wisp.invuln > 0) wisp.invuln -= dt;
  wisp.pulse += dt;

  // Steering: toward the pointer when it is inside the canvas, plus keys.
  const kv = input.keyVector();
  let tx = 0;
  let ty = 0;
  if (input.pointer.inside) {
    tx = input.pointer.x - wisp.x;
    ty = input.pointer.y - wisp.y;
    const dist = Math.hypot(tx, ty);
    if (dist > 4) {
      tx /= dist;
      ty /= dist;
    } else {
      tx = 0;
      ty = 0;
    }
  }
  tx += kv.x;
  ty += kv.y;
  const len = Math.hypot(tx, ty);
  if (len > 1) {
    tx /= len;
    ty /= len;
  }

  const maxSpeed = WISP.maxSpeed * slowFactor * (relics.swift ? 1.15 : 1);
  if (wisp.dashTime > 0) {
    wisp.dashTime -= dt;
  } else {
    wisp.vx += tx * WISP.accel * dt;
    wisp.vy += ty * WISP.accel * dt;
    // Gentle damping so the wisp settles instead of orbiting the pointer.
    wisp.vx *= Math.pow(0.12, dt);
    wisp.vy *= Math.pow(0.12, dt);
    const speed = Math.hypot(wisp.vx, wisp.vy);
    if (speed > maxSpeed) {
      wisp.vx = (wisp.vx / speed) * maxSpeed;
      wisp.vy = (wisp.vy / speed) * maxSpeed;
    }
  }
  wisp.x += wisp.vx * dt;
  wisp.y += wisp.vy * dt;
  wisp.x = Math.max(WISP.radius, Math.min(VIEW.width - WISP.radius, wisp.x));
  wisp.y = Math.max(WISP.radius, Math.min(VIEW.height - WISP.radius, wisp.y));

  const moving = Math.hypot(wisp.vx, wisp.vy);
  if (moving > 20) wisp.angle = Math.atan2(wisp.vy, wisp.vx);
}

// Start a dash in the direction the wisp is currently moving (or facing).
// Long Dash (relic) recharges in 0.7s instead of 1.1s.
export function tryDash(wisp, relics = {}) {
  if (!wisp.alive || wisp.dashCooldown > 0 || wisp.dashTime > 0) return false;
  let dx = wisp.vx;
  let dy = wisp.vy;
  const speed = Math.hypot(dx, dy);
  if (speed < 20) {
    dx = Math.cos(wisp.angle);
    dy = Math.sin(wisp.angle);
  } else {
    dx /= speed;
    dy /= speed;
  }
  wisp.vx = dx * WISP.dashSpeed;
  wisp.vy = dy * WISP.dashSpeed;
  wisp.dashTime = WISP.dashTime;
  wisp.dashCooldown = relics.longdash ? 0.7 : WISP.dashCooldown;
  wisp.invuln = Math.max(wisp.invuln, WISP.dashTime + 0.08);
  return true;
}

export function drawWisp(ctx, wisp, time) {
  const blink = wisp.invuln > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.save();
  ctx.translate(wisp.x, wisp.y);
  if (blink) ctx.globalAlpha = 0.35;
  // Breathing glow around the wisp.
  const breathe = 0.8 + Math.sin(wisp.pulse * 3) * 0.2;
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 40 * breathe);
  glow.addColorStop(0, 'rgba(46, 230, 168, 0.45)');
  glow.addColorStop(1, 'rgba(46, 230, 168, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 40 * breathe, 0, Math.PI * 2);
  ctx.fill();
  // Three orbiting motes, trailing behind the direction of travel.
  for (let i = 0; i < 3; i += 1) {
    const a = wisp.pulse * 2.2 + (i * Math.PI * 2) / 3;
    const ox = Math.cos(a) * 20;
    const oy = Math.sin(a) * 20;
    ctx.fillStyle = i === 0 ? '#ffd23d' : '#2ee6a8';
    ctx.beginPath();
    ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Core: a bright seed with a teal ring and a tiny sprout.
  ctx.fillStyle = '#e8fff4';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2ee6a8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#7dffce';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.quadraticCurveTo(4, -18, 10, -16);
  ctx.moveTo(0, -9);
  ctx.quadraticCurveTo(-4, -18, -10, -16);
  ctx.stroke();
  ctx.fillStyle = '#0d1f1a';
  ctx.beginPath();
  ctx.arc(-3.5, -1, 1.6, 0, Math.PI * 2);
  ctx.arc(3.5, -1, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
