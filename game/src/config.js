// Glowmoth tuning: every number the game balances on lives here, so tuning is one file.
export const VIEW = { width: 960, height: 600 };

export const MOTH = {
  radius: 14,
  accel: 2400, // px/s^2 toward the pointer
  maxSpeed: 310,
  dashSpeed: 760,
  dashTime: 0.18, // seconds of burst
  dashCooldown: 1.1, // seconds before the next dash
  invulnAfterHit: 2.0, // seconds of blinking safety after a hit
  trailEvery: 0.03, // seconds between dash-trail puffs
};

export const LAMPS = {
  baseCount: 4, // lamps on level 1; +1 each level
  radius: 26, // touch radius of a lantern
  glowRadius: 150, // lit lantern light radius
  points: 100,
};

export const POLLEN = {
  maxOnField: 12,
  respawnEvery: 2.2, // seconds
  radius: 8,
  basePoints: 10,
  comboWindow: 3.5, // seconds to keep a combo alive
  comboCap: 8, // combo multiplier caps at x8
};

export const BATS = {
  baseCount: 2, // bats on level 1; +1 each level
  maxCount: 8,
  baseSpeed: 95, // +12 per level
  speedPerLevel: 12,
  radius: 16,
  sineAmpMin: 30,
  sineAmpMax: 90,
  dashKillPoints: 50, // dashing through a bat scares it off
};

export const WEBS = {
  baseCount: 1, // webs on level 1; +1 every 2 levels
  maxCount: 4,
  radiusMin: 55,
  radiusMax: 82,
  slowFactor: 0.45, // moth speed inside a web
};

export const GAME = {
  lives: 3,
  levelBonusBase: 200,
  levelBonusPerLevel: 100,
  lifeBonus: 25, // per spare life on level clear
};

// Deep indigo night, warm amber lamps, cream-and-teal moth, purple bats.
export const PALETTE = {
  skyTop: '#171233',
  skyBottom: '#0a0718',
  ground: '#100c26',
  lampLit: '#ffb347',
  lampDim: '#5a5470',
  lampGlow: 'rgba(255, 179, 71, 0.55)',
  pollen: '#ffe9a8',
  mothWing: '#f6ead2',
  mothWingTip: '#37c8ab',
  mothBody: '#3a2f4d',
  bat: '#241a3d',
  batEye: '#ff5d5d',
  web: 'rgba(230, 230, 245, 0.5)',
  hudText: '#f2ead8',
  accent: '#ffb347',
};
