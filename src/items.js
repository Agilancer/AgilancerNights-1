// Item database, equipment slots and the little pixel-art icons.

export const ITEMS = {
  short_sword: {
    name: 'Short Sword',
    type: 'weapon',
    atk: 8,
    reach: 26,
    icon: 'sword',
    desc: 'A plain but well-balanced blade. ATK +8.',
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
