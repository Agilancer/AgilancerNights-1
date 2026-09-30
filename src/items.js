// Item registry: weapons, armor, charms, spells, relics, keys, vessels.
import { WEAPONS } from './data/weapons.js';
import { ARMOR_LIST } from './data/armor.js';
import { CHARM_LIST } from './data/charms.js';
import { SPELL_LIST } from './data/spells.js';
import { RELIC_LIST } from './data/relics.js';
import { ELEMENTS } from './data/elements.js';
import { drawWeaponIcon } from './weaponFx.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const ITEMS = {};
for (const w of WEAPONS) ITEMS[w.id] = w;
for (const a of ARMOR_LIST) ITEMS[slug(a.name)] = { ...a, id: slug(a.name) };
for (const c of CHARM_LIST) ITEMS[slug(c.name)] = { ...c, id: slug(c.name) };
for (const s of SPELL_LIST) ITEMS[s.id] = { ...s, type: 'spell' };
for (const r of RELIC_LIST) ITEMS[r.id] = { ...r, type: 'relic', tier: 5 };
Object.assign(ITEMS, {
  iron_key:    { id: 'iron_key', name: 'Iron Key', type: 'key', tier: 0, icon: 'key', color: '#b0b0c0', desc: 'A heavy, rust-flecked key. It must open a door somewhere in the castle.' },
  crimson_key: { id: 'crimson_key', name: 'Crimson Key', type: 'key', tier: 7, icon: 'key', color: '#e03040', desc: 'Warm to the touch, as if it had a pulse. It opens the way to the Halls of Flesh.' },
  abyss_key:   { id: 'abyss_key', name: 'Abyss Key', type: 'key', tier: 9, icon: 'key', color: '#a070ff', desc: 'It is not quite there when you look at it. The final door awaits.' },
  life_vessel: { id: 'life_vessel', name: 'Life Vessel', type: 'vessel', tier: 5, icon: 'heart', color: '#ff4050', desc: 'Max HP +10.' },
  mana_vessel: { id: 'mana_vessel', name: 'Mana Vessel', type: 'vessel', tier: 5, icon: 'flask', color: '#4080ff', desc: 'Max MP +10.' },
});

export const TYPE_LABEL = {
  weapon: 'Weapon', spell: 'Spell', head: 'Head', body: 'Body', charm: 'Charm',
  relic: 'Relic', key: 'Key item', vessel: 'Vessel',
};

export const SLOTS = [
  { id: 'rightHand', label: 'R. Hand', accepts: 'weapon' },
  { id: 'leftHand', label: 'L. Hand', accepts: 'weapon' },
  { id: 'spell', label: 'Spell', accepts: 'spell' },
  { id: 'head', label: 'Head', accepts: 'head' },
  { id: 'body', label: 'Body', accepts: 'body' },
  { id: 'charm1', label: 'Charm 1', accepts: 'charm' },
  { id: 'charm2', label: 'Charm 2', accepts: 'charm' },
  { id: 'charm3', label: 'Charm 3', accepts: 'charm' },
];
export const ALL_SLOTS = SLOTS;
export const PASSIVE_COUNT = 10;
export const RELICS = RELIC_LIST;

export const BASE_ATK = 5;
export const xpToNext = (level) => Math.round(25 * Math.pow(level, 1.6));
export const HP_PER_LEVEL = 12;
export const MP_PER_LEVEL = 6;
// Kept for older callers: damage of a weapon at a level with no bonuses.
export const weaponDamage = (item, level, bonusAtk = 0) => Math.round((BASE_ATK + (item?.atk || 0) + bonusAtk) * (1 + 0.15 * (level - 1)));
export const spellDamage = (item, level, spellBonus = 0) => Math.round((item?.power || 0) * (1 + 0.1 * (level - 1)) * (1 + spellBonus));

const BONUS_TEXT = {
  atk: (v) => `ATK +${v}`, def: (v) => `DEF +${v}`, maxHp: (v) => `Max HP +${v}`, maxMp: (v) => `Max MP +${v}`,
  hpRegen: (v) => `HP regen +${v}/s`, mpRegen: (v) => `MP regen +${v}/s`, luck: (v) => `Item finds +${pc(v)}`,
  xp: (v) => `XP +${pc(v)}`, crit: (v) => `Critical chance +${pc(v)}`, critDmg: (v) => `Critical damage +${pc(v)}`,
  speed: (v) => `Move speed +${pc(v)}`, jump: (v) => `Jump height +${pc(v)}`, lifesteal: (v) => `Life steal ${pc(v)}`,
  spell: (v) => `Spell power +${pc(v)}`, thorns: (v) => `Reflects ${pc(v)} of damage`, iframes: (v) => `Invulnerability +${v}s after hits`,
  elemAtk: (v) => `Elemental damage +${pc(v)}`, drain: (v) => `+${v} MP per kill`,
};
const pc = (v) => `${Math.round(v * 100)}%`;
export function describeBonus(b) {
  return Object.entries(b).map(([k, v]) => {
    if (k.startsWith('res_')) return v >= 1 ? `Immune to ${ELEMENTS[k.slice(4)].name.toLowerCase()}` : `${ELEMENTS[k.slice(4)].name} resistance ${pc(v)}`;
    return BONUS_TEXT[k] ? BONUS_TEXT[k](v) : `${k} +${v}`;
  }).join(', ') + '.';
}

// Colour of an item's name by how rare it is.
export function rarityColor(it) {
  if (it.legendary || it.tier >= 10) return '#ffb347';
  if (it.tier >= 8) return '#ff7ad9';
  if (it.tier >= 6) return '#b890ff';
  if (it.tier >= 4) return '#7fc8ff';
  if (it.tier >= 2) return '#9fe39f';
  return '#fff3cf';
}

for (const it of Object.values(ITEMS)) {
  if (!it.desc && it.bonus) it.desc = describeBonus(it.bonus);
}

// ---------- Procedural icons (32x32 canvases) ----------
const TIER_COL = ['#8a6a4a', '#9aa0ac', '#b8c0cc', '#d8e0f0', '#8ad8e8', '#6a5a98', '#6aa8e8', '#e8d8a8', '#d0304a', '#8a50e0', '#ffc850'];
const GEM = ['#c07040', '#b08840', '#9098a8', '#d8e0f0', '#f0c040', '#50c080', '#c02848', '#3868f0', '#3a3048', '#c8d8ff', '#a01020'];
const iconCache = {};

function glyph(x, name, col, col2) {
  x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 2;
  const dot = (cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  switch (name) {
    case 'head':
      x.beginPath(); x.moveTo(6, 22); x.quadraticCurveTo(6, 6, 16, 6); x.quadraticCurveTo(26, 6, 26, 22); x.closePath(); x.fill();
      x.fillStyle = '#0c0814'; x.fillRect(10, 14, 12, 3); x.fillStyle = col2; x.fillRect(15, 6, 2, 8); break;
    case 'body':
      x.beginPath(); x.moveTo(8, 6); x.lineTo(24, 6); x.lineTo(28, 12); x.lineTo(24, 14); x.lineTo(23, 27); x.lineTo(9, 27); x.lineTo(8, 14); x.lineTo(4, 12); x.closePath(); x.fill();
      x.fillStyle = col2; x.fillRect(15, 8, 2, 18); x.fillRect(10, 16, 12, 2); break;
    case 'ring': x.beginPath(); x.arc(16, 18, 8, 0, Math.PI * 2); x.lineWidth = 3; x.stroke(); dot(16, 9, 4, col2); break;
    case 'amulet':
      x.lineWidth = 1.5; x.beginPath(); x.moveTo(7, 4); x.lineTo(16, 18); x.lineTo(25, 4); x.stroke(); dot(16, 21, 6, col); dot(16, 21, 3.5, col2); break;
    case 'gem': x.beginPath(); x.moveTo(16, 5); x.lineTo(26, 14); x.lineTo(16, 28); x.lineTo(6, 14); x.closePath(); x.fill(); x.fillStyle = col2; x.fillRect(12, 12, 4, 4); break;
    case 'feather': x.beginPath(); x.ellipse(16, 15, 5, 12, 0.6, 0, Math.PI * 2); x.fill(); x.strokeStyle = col2; x.lineWidth = 1; x.beginPath(); x.moveTo(8, 27); x.lineTo(22, 5); x.stroke(); break;
    case 'fang': x.beginPath(); x.moveTo(9, 6); x.lineTo(23, 6); x.lineTo(17, 28); x.closePath(); x.fill(); x.fillStyle = col2; x.fillRect(11, 6, 10, 3); break;
    case 'book': x.fillRect(7, 5, 18, 22); x.fillStyle = col2; x.fillRect(9, 7, 14, 2); x.fillRect(14, 12, 4, 8); x.fillRect(12, 14, 8, 2); break;
    case 'vial': x.fillRect(13, 4, 6, 6); x.beginPath(); x.arc(16, 20, 8, 0, Math.PI * 2); x.fill(); dot(16, 21, 5, col2); break;
    case 'scarab': x.beginPath(); x.ellipse(16, 17, 8, 10, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = col2; x.lineWidth = 1.5; x.beginPath(); x.moveTo(16, 7); x.lineTo(16, 27); x.stroke(); x.fillRect(5, 12, 4, 2); x.fillRect(23, 12, 4, 2); break;
    case 'orb': {
      const g = x.createRadialGradient(13, 13, 1, 16, 16, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32); break;
    }
    case 'key':
      x.lineWidth = 3; x.beginPath(); x.arc(11, 11, 6, 0, Math.PI * 2); x.stroke(); x.fillRect(14, 14, 3, 14); x.fillRect(17, 22, 5, 3); x.fillRect(17, 26, 4, 2); break;
    case 'heart':
      x.beginPath(); x.moveTo(16, 27); x.bezierCurveTo(2, 17, 6, 5, 16, 11); x.bezierCurveTo(26, 5, 30, 17, 16, 27); x.fill(); dot(12, 13, 2, col2); break;
    case 'flask': x.fillRect(13, 4, 6, 8); x.beginPath(); x.moveTo(8, 27); x.lineTo(13, 12); x.lineTo(19, 12); x.lineTo(24, 27); x.closePath(); x.fill(); x.fillStyle = col2; x.fillRect(10, 20, 12, 5); break;
    case 'boots': x.fillRect(8, 5, 8, 16); x.fillRect(8, 19, 16, 7); x.fillStyle = col2; x.fillRect(6, 10, 3, 3); x.fillRect(5, 13, 3, 2); break;
    case 'greaves': x.fillRect(9, 4, 6, 22); x.fillRect(17, 4, 6, 22); x.fillStyle = col2; for (let i = 0; i < 3; i++) { x.fillRect(4 + i * 3, 10 + i * 4, 3, 1); x.fillRect(25 + i, 9 + i * 4, 4, 1); } break;
    case 'lantern': x.fillRect(12, 4, 8, 3); x.fillRect(10, 7, 12, 18); x.fillStyle = col2; x.fillRect(13, 10, 6, 12); x.fillStyle = col; x.fillRect(12, 25, 8, 3); break;
    case 'veil': x.globalAlpha = 0.75; x.beginPath(); x.moveTo(16, 4); x.quadraticCurveTo(30, 10, 26, 28); x.lineTo(6, 28); x.quadraticCurveTo(2, 10, 16, 4); x.fill(); x.globalAlpha = 1; x.fillStyle = col2; x.fillRect(12, 12, 3, 3); x.fillRect(18, 12, 3, 3); break;
    case 'soles': x.beginPath(); x.ellipse(11, 17, 5, 11, -0.1, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(22, 17, 5, 11, 0.1, 0, Math.PI * 2); x.fill(); x.fillStyle = col2; x.fillRect(15, 3, 2, 6); x.fillRect(13, 5, 6, 2); break;
    case 'crown': x.beginPath(); x.moveTo(5, 24); x.lineTo(5, 10); x.lineTo(11, 16); x.lineTo(16, 6); x.lineTo(21, 16); x.lineTo(27, 10); x.lineTo(27, 24); x.closePath(); x.fill(); dot(16, 19, 2.5, col2); break;
    case 'scale': x.beginPath(); x.moveTo(16, 4); x.quadraticCurveTo(29, 14, 16, 28); x.quadraticCurveTo(3, 14, 16, 4); x.fill(); x.strokeStyle = col2; x.lineWidth = 1; x.beginPath(); x.arc(16, 22, 6, Math.PI, 0); x.arc(16, 14, 6, Math.PI, 0); x.stroke(); break;
    case 'eye': x.beginPath(); x.ellipse(16, 16, 12, 7, 0, 0, Math.PI * 2); x.fill(); dot(16, 16, 5, col2); dot(16, 16, 2, '#000'); break;
    default: x.fillRect(8, 8, 16, 16);
  }
}

const FORM_GLYPH = {
  Ring: 'ring', Circlet: 'ring', Anklet: 'ring', Amulet: 'amulet', Pendant: 'amulet', Locket: 'amulet', Rosary: 'amulet',
  Brooch: 'gem', Coin: 'gem', Eye: 'eye', Sigil: 'gem', Prism: 'gem', Shard: 'gem', Idol: 'gem', Talisman: 'gem',
  Feather: 'feather', Fang: 'fang', Thorn: 'fang', Tome: 'book', Vial: 'vial', Scarab: 'scarab', Veil: 'veil', Scale: 'scale', Rod: 'gem',
};

export function getIcon(id) {
  if (iconCache[id]) return iconCache[id];
  if (typeof document === 'undefined') return null;
  const it = typeof id === 'string' ? ITEMS[id] : id;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  if (!it) { iconCache[id] = c; return c; }
  switch (it.type) {
    case 'weapon': drawWeaponIcon(x, it, 32); break;
    case 'head': case 'body': glyph(x, it.type, TIER_COL[Math.min(10, it.tier)], it.bonus && Object.keys(it.bonus).length > 1 ? '#f0c050' : '#2a2238'); break;
    case 'charm': glyph(x, FORM_GLYPH[it.name.split(' ')[1]] || 'gem', GEM[it.tier], it.tier >= 7 ? '#ffffff' : GEM[(it.tier + 4) % GEM.length]); break;
    case 'spell': glyph(x, 'orb', it.element ? ELEMENTS[it.element].color : '#a8d0ff'); break;
    case 'relic': glyph(x, it.icon, '#e8c060', '#ff5050'); break;
    default: glyph(x, it.icon || 'gem', it.color || '#f0c050', '#fff0b0');
  }
  iconCache[id] = c;
  return c;
}
