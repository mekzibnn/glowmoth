// Bloomwarden v3 tuning: every number the game balances on lives here, so
// tuning is one file. GOAL: bloom every glowcap to WIN the bloom; WIN the
// campaign by clearing bloom 7; LOSE when 3 hearts run out. Score from
// glowcaps, spore combos and scared mites, all times the CHAIN (consecutive
// pickups + scares without a hit, cap x8). BOSSES: THORNMAW on bloom 3,
// BLIGHTMAW on bloom 5, THE ROTKING on bloom 7 (5 dash-hits, +2000).
// DRAFT: after each bloom, pick 1 of 3 RELICS (rarity, reroll 15 spores).
// TIDES: 3 difficulties (score x0.75 / x1 / x1.5). PHASES: the sporefall
// cycle changes the grove every bloom. FEATS: 8, kept in localStorage.
export const VIEW = { width: 1280, height: 800 };

export const WISP = {
  radius: 14,
  accel: 2600, // px/s^2 toward the pointer
  maxSpeed: 330,
  dashSpeed: 820,
  dashTime: 0.18, // seconds of burst
  dashCooldown: 1.1, // seconds before the next dash (0.7 with Long Dash)
  invulnAfterHit: 2.0, // seconds of blinking safety after a hit
  trailEvery: 0.03, // seconds between dash-trail puffs
};

export const GLOWCAPS = {
  baseCount: 7, // glowcaps on bloom 1; +1 each bloom
  radius: 30, // touch radius of a glowcap
  glowRadius: 170, // bloomed glowcap light radius
  points: 300, // times the chain, times the tide
};

export const SPORES = {
  maxOnField: 20,
  respawnEvery: 1.6, // seconds
  radius: 9,
  basePoints: 25, // times the combo, times the phase
  comboWindow: 3.5, // seconds to keep a combo alive (6 with Chainkeeper)
  comboCap: 8, // chain multiplier caps at x8
};

export const MITES = {
  baseCount: 4, // mites on bloom 1; +1 each bloom
  maxCount: 12,
  baseSpeed: 100, // +12 per bloom, times the phase's mite factor
  speedPerLevel: 12,
  radius: 16,
  sineAmpMin: 30,
  sineAmpMax: 90,
  dashKillPoints: 100, // dashing through a mite scares it off, times the chain
};

// MITE KINDS — the roster the title screen names and the incoming queue
// counts. Each kind moves differently and answers a different play.
export const MITE_KINDS = [
  { id: 'mite', name: 'Mite', blurb: 'drifts in waves — dash through it', firstBloom: 1, weight: 5 },
  { id: 'dart', name: 'Dart', blurb: 'fast and straight — sidestep it', firstBloom: 2, weight: 3 },
  { id: 'spitter', name: 'Spitter', blurb: 'lobs blight from afar — keep moving', firstBloom: 3, weight: 2 },
  { id: 'bulwark', name: 'Bulwark', blurb: 'takes 2 dash-hits — hit it twice', firstBloom: 4, weight: 2 },
];

export const THORNS = {
  baseCount: 2, // thornvines on bloom 1; +1 every 2 blooms
  maxCount: 6,
  radiusMin: 60,
  radiusMax: 90,
  slowFactor: 0.45, // wisp speed inside thorns (0.8 with Thornproof)
};

// BOSSES — a giant blight-beast that hunts the wisp on blooms 3, 5 and 7:
// dash-hits to scare it off, a telegraphed swoop every 4 seconds — faster
// and more often as it loses hits (PHASE 2: 3.2s; ENRAGED at 1 hit: 2.5s,
// 240 px/s), matching the boss bar.
export const BOSSES = {
  3: { name: 'THORNMAW', radius: 36, hits: 3, killPoints: 1000, color: '#7a2e6e', eye: '#ff5df2' },
  5: { name: 'BLIGHTMAW', radius: 40, hits: 3, killPoints: 1000, color: '#2e1040', eye: '#ff2e2e' },
  7: { name: 'THE ROTKING', radius: 48, hits: 5, killPoints: 2000, color: '#3d0f2b', eye: '#ffd23d' },
};
export const BOSS = {
  swoopEvery: 4.0, // seconds between swoops
  swoopSpeed: 185, // px/s during a swoop
  telegraph: 0.5, // seconds of flashing before a swoop
};

// RELICS — the draft after each bloom: pick 1 of 3. Rarity weights the
// offer; every relic does something real in the game (see world.js).
export const RELICS = [
  { id: 'swift', name: 'Swift Spores', rarity: 'common', desc: '+15% flying speed' },
  { id: 'longdash', name: 'Long Dash', rarity: 'common', desc: 'Dash recharges in 0.7s' },
  { id: 'thornproof', name: 'Thornproof', rarity: 'common', desc: 'Thorns barely slow you' },
  { id: 'heart', name: '+1 Heart', rarity: 'common', desc: 'One more heart (max 5)' },
  { id: 'widebloom', name: 'Wide Bloom', rarity: 'common', desc: 'Glowcaps bloom from farther away' },
  { id: 'magnet', name: 'Spore Magnet', rarity: 'rare', desc: 'Spores drift toward you' },
  { id: 'chainkeeper', name: 'Chainkeeper', rarity: 'rare', desc: 'Combo window lasts 6s, not 3.5s' },
  { id: 'bloomheart', name: 'Bloomheart', rarity: 'rare', desc: 'Glowcaps are worth +150 more' },
  { id: 'ironwisp', name: 'Iron Wisp', rarity: 'rare', desc: '3s of safety after a hit, not 2s' },
  { id: 'dashnova', name: 'Dash Nova', rarity: 'rare', desc: 'A dash scares mites nearby, not just touched' },
  { id: 'cache', name: 'Spore Cache', rarity: 'epic', desc: '+15 spores banked at every dawn' },
  { id: 'fullbloom', name: 'Fullbloom Charm', rarity: 'epic', desc: 'FULLBLOOM doubles glowcap points too' },
];
export const DRAFT_REROLL_COST = 15;

// TIDES — difficulty, chosen on the title screen. The tide multiplies the
// score and changes how many mites come and how fast they are.
export const TIDES = [
  { id: 'gentle', name: 'GENTLE SPOREFALL', mult: 0.75, miteMult: 0.75, extraMites: -1, hearts: 4, desc: 'Fewer, slower mites. A first bloom.' },
  { id: 'wildwood', name: 'WILDWOOD', mult: 1, miteMult: 1, extraMites: 0, hearts: 3, desc: 'The grove as it was meant.' },
  { id: 'blightstorm', name: 'BLIGHTSTORM', mult: 1.5, miteMult: 1.25, extraMites: 2, hearts: 3, desc: 'More mites, tougher, hungrier. Score x1.5' },
];

// PHASES — the sporefall cycle: every bloom the grove changes with it.
// Phase = (bloom - 1) % 5.
export const PHASES = [
  { name: 'DORMANT', mite: 0.8, spore: 1, thorn: 0.45, blurb: 'mites drift slow' },
  { name: 'SPROUT', mite: 0.9, spore: 1, thorn: 0.6, blurb: 'thorns loosen, slow less' },
  { name: 'BLOOM', mite: 1.0, spore: 1, thorn: 0.45, blurb: 'a balanced bloom' },
  { name: 'SPORING', mite: 1.15, spore: 1, thorn: 0.45, blurb: 'mites quicken' },
  { name: 'FULLBLOOM', mite: 1.25, spore: 2, thorn: 0.45, blurb: 'Sporefall — spores worth double' },
];

// FEATS — 8 achievements, kept in localStorage, shown on the title screen
// and the victory screen. Each names what it takes.
export const FEATS = [
  { id: 'first', name: 'First Bloom', desc: 'Clear bloom 1' },
  { id: 'unbroken', name: 'Unbroken', desc: 'Clear a bloom without a hit' },
  { id: 'bossbane', name: 'Bossbane', desc: 'Scare off a boss' },
  { id: 'chain8', name: 'Chain x8', desc: 'Reach a x8 chain' },
  { id: 'hoard', name: 'Spore Hoard', desc: 'Bank 100 spores in one run' },
  { id: 'relics6', name: 'Relic Set', desc: 'Hold 6 relics at once' },
  { id: 'dawn', name: 'Dawnbringer', desc: 'Win the campaign (clear bloom 7)' },
  { id: 'stormdawn', name: 'Blightstorm Dawn', desc: 'Win on BLIGHTSTORM' },
];

export const GAME = {
  blooms: 7, // the campaign: clear bloom 7 and the dawn breaks (VICTORY)
  lives: 3,
  maxLives: 5,
  bloomBonusBase: 600,
  bloomBonusPerBloom: 300,
  lifeBonus: 50, // per spare heart on bloom clear
};

// The fungal forest: deep green-black night, teal wisp, violet glowcaps,
// magenta blight, amber spores. Nothing here is a lantern.
export const PALETTE = {
  skyTop: '#0d1f1a',
  skyBottom: '#050a08',
  ground: '#0a1410',
  capLit: '#b06cff',
  capDim: '#4a4460',
  capGlow: 'rgba(176, 108, 255, 0.55)',
  spore: '#ffd23d',
  wispCore: '#e8fff4',
  wispGlow: '#2ee6a8',
  wispTrail: '#37c8ab',
  mite: '#1c1030',
  miteEye: '#ff5df2',
  dart: '#241a3d',
  spitter: '#33122e',
  bulwark: '#2b1a10',
  thorn: 'rgba(120, 220, 160, 0.45)',
  hudText: '#eaf7ee',
  accent: '#2ee6a8',
};
