// 200 weapons: 182 generated from class tables + 18 hand-named legendaries.
// Every weapon gets its own attack animation from a mix of motion type,
// arc, speed, reach, blade shape, colours and elemental trail (see weaponFx.js).
import { mulberry32, pick } from './rng.js';
import { ELEMENTS, ELEMENT_IDS } from './elements.js';

// shape: how the weapon is drawn. motions: which swings it can use.
const CLASSES = [
  { id: 'dagger',     n: 12, label: 'Dagger',     shape: 'dagger',     motions: ['flurry', 'thrust', 'slash'], atk: 3,  dur: 0.22, len: 14, w: 2 },
  { id: 'sword',      n: 16, label: 'Sword',      shape: 'sword',      motions: ['slash', 'double', 'upper'],  atk: 6,  dur: 0.3,  len: 24, w: 3 },
  { id: 'longsword',  n: 18, label: 'Longsword',  shape: 'sword',      motions: ['slash', 'double', 'overhead'], atk: 9, dur: 0.36, len: 32, w: 3 },
  { id: 'greatsword', n: 12, label: 'Greatsword', shape: 'greatsword', motions: ['overhead', 'spin', 'slash'], atk: 14, dur: 0.55, len: 42, w: 6 },
  { id: 'rapier',     n: 10, label: 'Rapier',     shape: 'rapier',     motions: ['thrust', 'flurry'],          atk: 6,  dur: 0.26, len: 30, w: 1 },
  { id: 'katana',     n: 12, label: 'Katana',     shape: 'katana',     motions: ['slash', 'double', 'upper'],  atk: 9,  dur: 0.28, len: 32, w: 2 },
  { id: 'axe',        n: 12, label: 'Axe',        shape: 'axe',        motions: ['overhead', 'slash'],         atk: 12, dur: 0.46, len: 28, w: 3 },
  { id: 'mace',       n: 12, label: 'Mace',       shape: 'mace',       motions: ['overhead', 'smash'],         atk: 11, dur: 0.44, len: 24, w: 3 },
  { id: 'hammer',     n: 10, label: 'Warhammer',  shape: 'hammer',     motions: ['smash', 'overhead'],         atk: 15, dur: 0.6,  len: 30, w: 4 },
  { id: 'spear',      n: 12, label: 'Spear',      shape: 'spear',      motions: ['thrust', 'flurry'],          atk: 8,  dur: 0.34, len: 40, w: 2 },
  { id: 'lance',      n: 8,  label: 'Lance',      shape: 'lance',      motions: ['thrust'],                    atk: 12, dur: 0.42, len: 46, w: 4, lunge: 40 },
  { id: 'scythe',     n: 10, label: 'Scythe',     shape: 'scythe',     motions: ['reap', 'spin'],              atk: 12, dur: 0.5,  len: 36, w: 3 },
  { id: 'claw',       n: 10, label: 'Claws',      shape: 'claw',       motions: ['flurry', 'double'],          atk: 5,  dur: 0.24, len: 12, w: 2 },
  { id: 'flail',      n: 8,  label: 'Flail',      shape: 'flail',      motions: ['overhead', 'spin'],          atk: 11, dur: 0.5,  len: 30, w: 3 },
  { id: 'staff',      n: 8,  label: 'Staff',      shape: 'staff',      motions: ['slash', 'thrust'],           atk: 6,  dur: 0.34, len: 34, w: 2, beam: 'orb' },
];

const MATERIALS = [
  { name: 'Rusty',      blade: '#9a7a60', edge: '#c9a888', hilt: '#5a3a1e', guard: '#7a5a3a' },
  { name: 'Iron',       blade: '#8a93a4', edge: '#cfd6e2', hilt: '#4a2e18', guard: '#7c7c88' },
  { name: 'Steel',      blade: '#a8b2c6', edge: '#f0f4fa', hilt: '#3a2414', guard: '#b0a070' },
  { name: 'Silver',     blade: '#c8d0e0', edge: '#ffffff', hilt: '#2a2a4a', guard: '#d8d8f0' },
  { name: 'Mithril',    blade: '#9cd6e6', edge: '#eafcff', hilt: '#1e3a4a', guard: '#8ad0e0' },
  { name: 'Obsidian',   blade: '#3c3250', edge: '#9a88c0', hilt: '#1a1020', guard: '#6a5a88' },
  { name: 'Runic',      blade: '#6aa2da', edge: '#d0ecff', hilt: '#20304a', guard: '#e0c060', glow: 'rgba(120,180,255,0.5)' },
  { name: 'Dragonbone', blade: '#dccca4', edge: '#fff6dc', hilt: '#6a2a1a', guard: '#c04030' },
  { name: 'Sanguine',   blade: '#a4202e', edge: '#ff7888', hilt: '#2a0a10', guard: '#e0b040', glow: 'rgba(255,40,60,0.45)' },
  { name: 'Abyssal',    blade: '#402264', edge: '#b88aff', hilt: '#100818', guard: '#7040b0', glow: 'rgba(160,100,255,0.5)' },
];

// Named whips (the whip class is hand-picked, not material x class).
const WHIPS = [
  { name: 'Leather Whip',      tier: 0, atk: 5,  color: '#8a5a2a', tip: '#c08850' },
  { name: 'Chain Whip',        tier: 1, atk: 8,  color: '#8a8aa0', tip: '#d0d0e0', style: 'chain' },
  { name: 'Thorn Whip',        tier: 2, atk: 11, color: '#3a7a2a', tip: '#9ae060', style: 'thorn', element: 'poison' },
  { name: 'Barbed Whip',       tier: 2, atk: 12, color: '#6a4a3a', tip: '#e0e0e0', style: 'thorn' },
  { name: 'Bone Whip',         tier: 3, atk: 14, color: '#d8ccb0', tip: '#fff4dc', style: 'bone' },
  { name: 'Flame Whip',        tier: 4, atk: 17, color: '#c83a10', tip: '#ffd060', style: 'flame', element: 'fire' },
  { name: 'Frost Lash',        tier: 5, atk: 20, color: '#5ab0e0', tip: '#e8faff', style: 'chain', element: 'ice' },
  { name: 'Storm Lash',        tier: 5, atk: 21, color: '#c8b830', tip: '#fffab0', style: 'chain', element: 'thunder' },
  { name: 'Silver Scourge',    tier: 6, atk: 24, color: '#c8d0e0', tip: '#ffffff', style: 'chain', element: 'holy' },
  { name: 'Shadow Whip',       tier: 7, atk: 28, color: '#402060', tip: '#b890ff', style: 'flame', element: 'dark' },
  { name: 'Blood Lash',        tier: 8, atk: 32, color: '#901020', tip: '#ff6070', style: 'thorn', element: 'blood' },
  { name: "Nightstalker's Lash", tier: 9, atk: 38, color: '#b0a070', tip: '#fff0a0', style: 'morningstar', element: 'holy' },
];

// Hand-named legendaries. `beam` fires a projectile at the peak of the swing.
const LEGENDS = [
  { name: 'Wyrmfang',            cls: 'dagger',     tier: 6, atk: 26, element: 'fire',    motion: 'flurry',   colors: { blade: '#ff9040', edge: '#ffe0a0', hilt: '#401008', guard: '#ffb030' } },
  { name: "Widow's Talons",      cls: 'claw',       tier: 6, atk: 28, element: 'poison',  motion: 'flurry',   colors: { blade: '#304020', edge: '#b0ff60', hilt: '#101808', guard: '#608030' } },
  { name: 'Emberheart',          cls: 'longsword',  tier: 5, atk: 30, element: 'fire',    motion: 'double',   beam: 'fireball' },
  { name: "Kraken's Tooth",      cls: 'spear',      tier: 6, atk: 32, element: 'ice',     motion: 'flurry',   beam: 'shard' },
  { name: 'Moonfang',            cls: 'katana',     tier: 7, atk: 38, element: 'dark',    motion: 'double',   beam: 'crescent', colors: { blade: '#c8c0ff', edge: '#ffffff', hilt: '#20103a', guard: '#8060d0', glow: 'rgba(170,140,255,0.6)' } },
  { name: 'Ossuary Maul',        cls: 'mace',       tier: 6, atk: 36, element: null,      motion: 'smash',    colors: { blade: '#e0d4b8', edge: '#fff8e8', hilt: '#3a2a1a', guard: '#c0b090' } },
  { name: 'Gorgonblade',         cls: 'sword',      tier: 6, atk: 30, element: 'poison',  motion: 'slash',    beam: 'venom' },
  { name: 'Sanguine Kiss',       cls: 'rapier',     tier: 7, atk: 34, element: 'blood',   motion: 'flurry' },
  { name: 'Thunderclap',         cls: 'hammer',     tier: 7, atk: 46, element: 'thunder', motion: 'smash',    beam: 'bolt' },
  { name: 'Nightreaver',         cls: 'axe',        tier: 7, atk: 42, element: 'dark',    motion: 'overhead', beam: 'crescent' },
  { name: 'Starfall',            cls: 'flail',      tier: 7, atk: 40, element: 'holy',    motion: 'spin' },
  { name: 'Hellreaver',          cls: 'scythe',     tier: 8, atk: 48, element: 'fire',    motion: 'spin',     beam: 'fireball' },
  { name: 'Frostmourne Edge',    cls: 'greatsword', tier: 8, atk: 54, element: 'ice',     motion: 'overhead', beam: 'shard' },
  { name: 'Sunspear',            cls: 'lance',      tier: 8, atk: 50, element: 'holy',    motion: 'thrust',   beam: 'cross' },
  { name: "Cathedral's Wrath",   cls: 'staff',      tier: 8, atk: 34, element: 'holy',    motion: 'thrust',   beam: 'cross' },
  { name: 'Eclipse',             cls: 'sword',      tier: 9, atk: 58, element: 'dark',    motion: 'double',   beam: 'crescent', colors: { blade: '#20182a', edge: '#ffe8a0', hilt: '#0a0610', guard: '#e0b040', glow: 'rgba(255,220,120,0.5)' } },
  { name: 'Aurelion',            cls: 'greatsword', tier: 9, atk: 66, element: 'holy',    motion: 'spin',     beam: 'cross', colors: { blade: '#fff4c0', edge: '#ffffff', hilt: '#604010', guard: '#ffd040', glow: 'rgba(255,240,160,0.7)' } },
  // The most powerful weapon in the castle: a colossal blade of energy that
  // sweeps across the whole screen.
  { name: 'Requiem of Agilancer', cls: 'greatsword', tier: 10, atk: 120, element: 'holy', motion: 'giant', id: 'requiem',
    colors: { blade: '#e8f0ff', edge: '#ffffff', hilt: '#1a1030', guard: '#c0a0ff', glow: 'rgba(170,150,255,0.8)' },
    desc: 'The last blade of the Agilancer order. Its edge is the night itself; it cleaves everything on the screen.' },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function motionParams(r, motion, cls) {
  const j = (a) => (r() - 0.5) * a;
  return {
    motion,
    a0: -2.0 + j(0.5), a1: 0.45 + j(0.4),           // slash arc (radians, 0 = forward)
    turns: 1 + (r() < 0.4 ? 0.5 : 0),               // spin
    stabs: 3 + Math.floor(r() * 3),                  // flurry
    lag: 0.035 + r() * 0.03,                         // whip wave
    curve: cls.shape === 'katana' ? 3 + r() * 3 : 0, // blade curvature
  };
}

function build() {
  const out = [];
  // Hand-made starter weapons (ids referenced by rooms and saves).
  out.push({ id: 'knife', name: 'Knife', cls: 'dagger', shape: 'dagger', tier: 0, atk: 4, dur: 0.22, len: 14, w: 2,
    anim: { motion: 'slash', a0: -1.8, a1: 0.4 }, colors: MATERIALS[1], desc: 'A short, quick blade. Better than bare fists.' });
  out.push({ id: 'short_sword', name: 'Short Sword', cls: 'sword', shape: 'sword', tier: 0, atk: 8, dur: 0.3, len: 24, w: 3,
    anim: { motion: 'slash', a0: -2.0, a1: 0.35 }, colors: MATERIALS[2], desc: 'A plain but well-balanced blade.' });

  let seed = 1000;
  for (const cls of CLASSES) {
    for (let i = 0; i < cls.n; i++) {
      const r = mulberry32(seed++);
      const tier = Math.min(9, Math.floor(((i + 0.5) * 10) / cls.n));
      const mat = MATERIALS[tier];
      const element = (i % 5 === 2 || i % 5 === 4) && tier > 0 ? pick(r, ELEMENT_IDS) : null;
      const motion = cls.motions[i % cls.motions.length];
      let name = `${mat.name} ${cls.label}`;
      if (element) name += ` of ${ELEMENTS[element].word}`;
      else if (out.some((w) => w.name === name)) name = `${mat.name} ${pick(r, ['Heavy', 'Keen', 'Old', 'Cruel', 'Fine', 'Grim'])} ${cls.label}`;
      const atk = Math.round(cls.atk * (1 + tier * 0.42) + (element ? 2 : 0));
      out.push({
        id: slug(name), name, cls: cls.id, shape: cls.shape, tier, atk, element,
        dur: +(cls.dur * (0.88 + r() * 0.24)).toFixed(3),
        len: Math.round(cls.len * (0.9 + r() * 0.2)), w: cls.w, lunge: cls.lunge || (motion === 'thrust' ? 10 : 0),
        anim: motionParams(r, motion, cls), colors: mat,
        beam: cls.beam || (element && tier >= 6 && r() < 0.5 ? pick(r, ['crescent', 'shard', 'fireball', 'bolt', 'venom']) : null),
      });
    }
  }
  for (const [i, wdef] of WHIPS.entries()) {
    const r = mulberry32(5000 + i);
    out.push({
      id: slug(wdef.name), name: wdef.name, cls: 'whip', shape: 'whip', tier: wdef.tier, atk: wdef.atk, element: wdef.element || null,
      dur: +(0.4 + r() * 0.08).toFixed(3), len: 52 + wdef.tier * 2, w: 2,
      anim: { ...motionParams(r, 'whip', { shape: 'whip' }), style: wdef.style || 'leather' },
      colors: { blade: wdef.color, edge: wdef.tip, hilt: '#3a2010', guard: wdef.tip },
    });
  }
  for (const [i, L] of LEGENDS.entries()) {
    const cls = CLASSES.find((c) => c.id === L.cls);
    const r = mulberry32(7000 + i);
    const mat = L.colors || { ...MATERIALS[Math.min(9, L.tier)], glow: L.element ? ELEMENTS[L.element].glow : undefined };
    out.push({
      id: L.id || slug(L.name), name: L.name, cls: L.cls, shape: cls.shape, tier: L.tier, atk: L.atk, element: L.element,
      dur: L.motion === 'giant' ? 0.9 : +(cls.dur * 0.95).toFixed(3),
      len: L.motion === 'giant' ? 300 : Math.round(cls.len * 1.15), w: cls.w + 1, lunge: cls.lunge || 0,
      anim: { ...motionParams(r, L.motion, cls), motion: L.motion }, colors: mat, beam: L.beam || null,
      legendary: true, desc: L.desc,
    });
  }
  // Descriptions for the rest.
  for (const w of out) {
    w.type = 'weapon';
    w.reach = w.len;
    if (!w.desc) {
      const el = w.element ? ` Imbued with ${ELEMENTS[w.element].name.toLowerCase()}.` : '';
      const beam = w.beam ? ' Its swing releases a projectile.' : '';
      w.desc = `${cap(w.anim.motion)} attacks.${el}${beam}`;
    }
  }
  return out;
}
const cap = (s) => ({ slash: 'Sweeping', double: 'Two-strike', upper: 'Rising', overhead: 'Overhead', thrust: 'Piercing', flurry: 'Rapid', spin: 'Spinning', smash: 'Ground-shaking', reap: 'Reaping', whip: 'Lashing', giant: 'World-cleaving' }[s] || 'Swift');

export const WEAPONS = build();
