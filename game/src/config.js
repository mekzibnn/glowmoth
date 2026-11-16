// Glowmoth v2 tuning: every number the game balances on lives here, so tuning
// is one file. GOAL: light every lamp to WIN the level; LOSE when 3 lives run
// out. Score from lamps (+100), pollen combos (up to x8) and scared bats (+50).
// BOSS: the MOTH-EATER comes every 5th level (3 dash-hits to kill, +500).
// SHOP: pollen is a bank between levels — spend it on 4 upgrades.
// MOON: every level the moon changes phase and the garden changes with it.
export const VIEW = { width: 960, height: 600 };

export const MOTH = {
  radius: 14,
  accel: 2400, // px/s^2 toward the pointer
  maxSpeed: 310,
  dashSpeed: 760,
  dashTime: 0.18, // seconds of burst
  dashCooldown: 1.1, // seconds before the next dash (0.7 with Long Dash)
  invulnAfterHit: 2.0, // seconds of blinking safety after a hit
  trailEvery: 0.03, // seconds between dash-trail puffs
};

export const LAMPS = {
  baseCount: 6, // lamps on level 1; +1 each level (v2: denser garden)
  radius: 26, // touch radius of a lantern
  glowRadius: 150, // lit lantern light radius
  points: 100,
};

export const POLLEN = {
  maxOnField: 18, // v2: denser garden
  respawnEvery: 1.8, // seconds
  radius: 8,
  basePoints: 10,
  comboWindow: 3.5, // seconds to keep a combo alive
  comboCap: 8, // combo multiplier caps at x8
};

export const BATS = {
  baseCount: 3, // bats on level 1; +1 each level (v2: denser garden)
  maxCount: 10,
  baseSpeed: 95, // +12 per level, times the moon's bat factor
  speedPerLevel: 12,
  radius: 16,
  sineAmpMin: 30,
  sineAmpMax: 90,
  dashKillPoints: 50, // dashing through a bat scares it off
};

export const WEBS = {
  baseCount: 2, // webs on level 1; +1 every 2 levels (v2: denser garden)
  maxCount: 5,
  radiusMin: 55,
  radiusMax: 82,
  slowFactor: 0.45, // moth speed inside a web (0.8 with Webproof)
};

// BOSS — the MOTH-EATER, a giant bat that hunts the moth every 5th level:
// 3 dash-hits to scare it off (+500), a telegraphed swoop every 4 seconds.
export const BOSS = {
  every: 5, // levels 5, 10, 15, ...
  name: 'MOTH-EATER',
  radius: 34,
  hits: 3, // dash-hits to kill
  killPoints: 500,
  swoopEvery: 4.0, // seconds between swoops
  swoopSpeed: 165, // px/s during a swoop
  telegraph: 0.5, // seconds of flashing before a swoop
};

// SHOP — between levels, spend the pollen bank on upgrades (each once).
// Keys 1-4 or click. Pollen is a currency: picking pollen up banks it.
export const SHOP = [
  { id: 'life', key: '1', name: '+1 Life', desc: 'One more heart (max 5)', cost: 30 },
  { id: 'speed', key: '2', name: 'Swift Wings', desc: '+15% flying speed', cost: 20 },
  { id: 'dash', key: '3', name: 'Long Dash', desc: 'Dash recharges in 0.7s', cost: 25 },
  { id: 'webproof', key: '4', name: 'Webproof', desc: 'Webs barely slow you', cost: 20 },
];

// MOON — one nameable twist LANTERNWAKE does not have: every level the moon
// changes phase and the garden changes with it. Phase = (level - 1) % 5.
export const MOON = [
  { name: 'NEW', bat: 0.8, pollen: 1, web: 0.45, blurb: 'bats drift slow' },
  { name: 'CRESCENT', bat: 0.9, pollen: 1, web: 0.6, blurb: 'webs shimmer, slow less' },
  { name: 'HALF', bat: 1.0, pollen: 1, web: 0.45, blurb: 'a balanced night' },
  { name: 'GIBBOUS', bat: 1.15, pollen: 1, web: 0.45, blurb: 'bats quicken' },
  { name: 'FULL', bat: 1.25, pollen: 2, web: 0.45, blurb: 'Mothlight — pollen worth double' },
];

export const GAME = {
  lives: 3,
  maxLives: 5,
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
  boss: '#2e1040',
  bossEye: '#ff2e2e',
  web: 'rgba(230, 230, 245, 0.5)',
  hudText: '#f2ead8',
  accent: '#ffb347',
};
