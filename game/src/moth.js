// The moth: position, velocity, dash, invulnerability, wing flap, and drawing.
// Steers toward the pointer with smooth acceleration; arrow keys / WASD add a
// direct push. A dash is a short burst in the current move direction that also
// makes the moth briefly untouchable. UPGRADES (shop): Swift Wings +15% speed,
// Long Dash recharges the dash in 0.7s instead of 1.1s.
import { MOTH, VIEW } from './config.js';

export function createMoth() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height - 90,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // facing up
    flap: 0, // wing-flap phase
    dashTime: 0, // seconds of dash left
    dashCooldown: 0,
    invuln: 0,
    trailTimer: 0,
    alive: true,
  };
}

export function resetMoth(moth) {
  moth.x = VIEW.width / 2;
  moth.y = VIEW.height - 90;
  moth.vx = 0;
  moth.vy = 0;
  moth.angle = -Math.PI / 2;
  moth.dashTime = 0;
  moth.dashCooldown = 0;
  moth.invuln = 0;
  moth.alive = true;
}

export function updateMoth(moth, input, dt, slowFactor, upgrades = {}) {
  if (!moth.alive) return;
  if (moth.dashCooldown > 0) moth.dashCooldown -= dt;
  if (moth.invuln > 0) moth.invuln -= dt;

  // Steering: toward the pointer when it is inside the canvas, plus keys.
  const kv = input.keyVector();
  let tx = 0;
  let ty = 0;
  if (input.pointer.inside) {
    tx = input.pointer.x - moth.x;
    ty = input.pointer.y - moth.y;
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

  const maxSpeed = MOTH.maxSpeed * slowFactor * (upgrades.speed ? 1.15 : 1);
  if (moth.dashTime > 0) {
    moth.dashTime -= dt;
  } else {
    moth.vx += tx * MOTH.accel * dt;
    moth.vy += ty * MOTH.accel * dt;
    // Gentle damping so the moth settles instead of orbiting the pointer.
    moth.vx *= Math.pow(0.12, dt);
    moth.vy *= Math.pow(0.12, dt);
    const speed = Math.hypot(moth.vx, moth.vy);
    if (speed > maxSpeed) {
      moth.vx = (moth.vx / speed) * maxSpeed;
      moth.vy = (moth.vy / speed) * maxSpeed;
    }
  }
  moth.x += moth.vx * dt;
  moth.y += moth.vy * dt;
  moth.x = Math.max(MOTH.radius, Math.min(VIEW.width - MOTH.radius, moth.x));
  moth.y = Math.max(MOTH.radius, Math.min(VIEW.height - MOTH.radius, moth.y));

  const moving = Math.hypot(moth.vx, moth.vy);
  if (moving > 20) {
    moth.angle = Math.atan2(moth.vy, moth.vx);
    moth.flap += dt * (6 + moving / 40);
  } else {
    moth.flap += dt * 3;
  }
}

// Start a dash in the direction the moth is currently moving (or facing).
// Long Dash (shop) recharges in 0.7s instead of 1.1s.
export function tryDash(moth, upgrades = {}) {
  if (!moth.alive || moth.dashCooldown > 0 || moth.dashTime > 0) return false;
  let dx = moth.vx;
  let dy = moth.vy;
  const speed = Math.hypot(dx, dy);
  if (speed < 20) {
    dx = Math.cos(moth.angle);
    dy = Math.sin(moth.angle);
  } else {
    dx /= speed;
    dy /= speed;
  }
  moth.vx = dx * MOTH.dashSpeed;
  moth.vy = dy * MOTH.dashSpeed;
  moth.dashTime = MOTH.dashTime;
  moth.dashCooldown = upgrades.dash ? 0.7 : MOTH.dashCooldown;
  moth.invuln = Math.max(moth.invuln, MOTH.dashTime + 0.08);
  return true;
}

export function drawMoth(ctx, moth, time) {
  const blink = moth.invuln > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.save();
  ctx.translate(moth.x, moth.y);
  ctx.rotate(moth.angle + Math.PI / 2);
  if (blink) ctx.globalAlpha = 0.35;
  // Soft glow around the moth.
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
  glow.addColorStop(0, 'rgba(255, 233, 168, 0.35)');
  glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  // Wings: two flapping ellipses, cream with teal tips.
  const flap = Math.sin(moth.flap) * 0.55;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.5 + flap * 0.5));
    ctx.fillStyle = '#f6ead2';
    ctx.beginPath();
    ctx.ellipse(side * 12, -2, 13, 8, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#37c8ab';
    ctx.beginPath();
    ctx.ellipse(side * 20, -6, 7, 5, side * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Body + head + antennae.
  ctx.fillStyle = '#3a2f4d';
  ctx.beginPath();
  ctx.ellipse(0, 2, 6, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6ead2';
  ctx.beginPath();
  ctx.arc(0, -11, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f6ead2';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.quadraticCurveTo(-7, -22, -11, -20);
  ctx.moveTo(2, -14);
  ctx.quadraticCurveTo(7, -22, 11, -20);
  ctx.stroke();
  ctx.fillStyle = '#241a3d';
  ctx.beginPath();
  ctx.arc(-1.8, -12, 1.2, 0, Math.PI * 2);
  ctx.arc(1.8, -12, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
