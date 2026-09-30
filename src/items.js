// Item database, equipment slots and the little pixel-art icons.

export const ITEMS = {
  knife: {
    name: 'Knife',
    type: 'weapon',
    atk: 4,
    reach: 18,
    icon: 'knife',
    desc: 'A short, quick blade. Better than bare fists. ATK +4.',
  },
  short_sword: {
    name: 'Short Sword',
    type: 'weapon',
    atk: 8,
    reach: 26,
    icon: 'sword',
    desc: 'A plain but well-balanced blade. ATK +8.',
  },
  spirit_bolt: {
    name: 'Spirit Bolt',
    type: 'spell',
    mp: 8,
    power: 12,
    icon: 'bolt',
    desc: 'Hurl a bolt of spirit energy straight ahead. Costs 8 MP.',
  },
  iron_key: {
    name: 'Iron Key',
    type: 'key',
    icon: 'key',
    desc: 'A heavy, rust-flecked key. It must open a door somewhere in the castle.',
  },
};

// Slot id -> which item type it accepts.
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
export const PASSIVE_SLOTS = Array.from({ length: 10 }, (_, i) => ({
  id: `passive${i + 1}`,
  label: `Passive ${i + 1}`,
  accepts: 'passive',
}));
export const ALL_SLOTS = [...SLOTS, ...PASSIVE_SLOTS];

export const BASE_ATK = 5;

// Leveling: XP needed to go from `level` to the next one.
export const xpToNext = (level) => Math.round(25 * Math.pow(level, 1.6));
// Each level adds 15% to weapon (and 10% to spell) damage.
export const weaponDamage = (item, level) => Math.round((BASE_ATK + (item?.atk || 0)) * (1 + 0.15 * (level - 1)));
export const spellDamage = (item, level) => Math.round((item?.power || 0) * (1 + 0.1 * (level - 1)));
export const HP_PER_LEVEL = 12;
export const MP_PER_LEVEL = 6;

// 16x16 icons. Each character is a palette entry, '.' is transparent.
const ICON_ART = {
  sword: {
    pal: { w: '#f4f6ff', s: '#aab4cc', d: '#5e6882', g: '#f0c050', o: '#9a6a1c', b: '#6a3e1e' },
    rows: [
      '..............ws',
      '.............wsd',
      '............wsd.',
      '...........wsd..',
      '..........wsd...',
      '.........wsd....',
      '........wsd.....',
      '.......wsd......',
      '..g...wsd.......',
      '..og.wsd........',
      '...ogsd.........',
      '....og..........',
      '...b.og.........',
      '..bb..o.........',
      '.bb.............',
      'gb..............',
    ],
  },
  knife: {
    pal: { w: '#f4f6ff', s: '#aab4cc', d: '#5e6882', g: '#c0a060', b: '#4a2e18' },
    rows: [
      '................',
      '................',
      '..........ws....',
      '.........wsd....',
      '........wsd.....',
      '.......wsd......',
      '......wsd.......',
      '.....wsd........',
      '...g.sd.........',
      '....gg..........',
      '...bgg..........',
      '..bb..g.........',
      '.bb.............',
      '................',
      '................',
      '................',
    ],
  },
  bolt: {
    pal: { w: '#ffffff', c: '#b8dcff', b: '#5a8ae0', d: '#2a4a9a' },
    rows: [
      '................',
      '................',
      '......dbbd......',
      '....dbccccbd....',
      '...dbcwwwwcbd...',
      '..dbcwwwwwwcbd..',
      '..bcwwwwwwwwcb..',
      'bbccwwwwwwwwccbb',
      'bbccwwwwwwwwccbb',
      '..bcwwwwwwwwcb..',
      '..dbcwwwwwwcbd..',
      '...dbcwwwwcbd...',
      '....dbccccbd....',
      '......dbbd......',
      '................',
      '................',
    ],
  },
  key: {
    pal: { g: '#f0c050', o: '#9a6a1c', h: '#fff0b0' },
    rows: [
      '................',
      '....oggo........',
      '...ohgggo.......',
      '..og....go......',
      '..og....go......',
      '..og....go......',
      '...ogggggo......',
      '....oggo........',
      '.....og.........',
      '.....og.........',
      '.....oggg.......',
      '.....og.........',
      '.....oggg.......',
      '.....og.........',
      '.....oo.........',
      '................',
    ],
  },
};

const iconCache = {};
export function getIcon(name) {
  if (iconCache[name]) return iconCache[name];
  if (typeof document === 'undefined') return null;
  const art = ICON_ART[name];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const x = c.getContext('2d');
  art.rows.forEach((row, py) => {
    [...row].forEach((ch, px) => {
      if (ch === '.') return;
      x.fillStyle = art.pal[ch];
      x.fillRect(px, py, 1, 1);
    });
  });
  iconCache[name] = c;
  return c;
}
