// Hundreds of charms: 24 effect families x 11 grades = 264 charms.
// Higher grades are stronger and some carry a second, lesser effect.
const GRADES = ['Copper', 'Bronze', 'Iron', 'Silver', 'Gold', 'Jade', 'Garnet', 'Sapphire', 'Onyx', 'Moonstone', 'Bloodstone'];

// key: stat in stats.js, lo/hi: magnitude at grade 0 / grade 10.
const FAMILIES = [
  { key: 'atk',         form: 'Ring',      noun: 'Might',       lo: 1,    hi: 14 },
  { key: 'def',         form: 'Brooch',    noun: 'Warding',     lo: 1,    hi: 14 },
  { key: 'maxHp',       form: 'Amulet',    noun: 'Vigor',       lo: 8,    hi: 90 },
  { key: 'maxMp',       form: 'Pendant',   noun: 'the Mind',    lo: 8,    hi: 70 },
  { key: 'hpRegen',     form: 'Locket',    noun: 'Mending',     lo: 0.3,  hi: 2.5 },
  { key: 'mpRegen',     form: 'Circlet',   noun: 'Clarity',     lo: 0.4,  hi: 3.5 },
  { key: 'luck',        form: 'Coin',      noun: 'Fortune',     lo: 0.05, hi: 0.5 },
  { key: 'xp',          form: 'Tome',      noun: 'Learning',    lo: 0.05, hi: 0.5 },
  { key: 'crit',        form: 'Eye',       noun: 'Precision',   lo: 0.03, hi: 0.25 },
  { key: 'speed',       form: 'Anklet',    noun: 'Haste',       lo: 0.03, hi: 0.18 },
  { key: 'jump',        form: 'Feather',   noun: 'Lightness',   lo: 0.03, hi: 0.15 },
  { key: 'lifesteal',   form: 'Fang',      noun: 'Hunger',      lo: 0.01, hi: 0.08 },
  { key: 'spell',       form: 'Sigil',     noun: 'Sorcery',     lo: 0.05, hi: 0.5 },
  { key: 'thorns',      form: 'Thorn',     noun: 'Spite',       lo: 0.1,  hi: 0.8 },
  { key: 'iframes',     form: 'Veil',      noun: 'Evasion',     lo: 0.1,  hi: 0.8 },
  { key: 'res_fire',    form: 'Scale',     noun: 'the Salamander', lo: 0.1, hi: 1 },
  { key: 'res_ice',     form: 'Shard',     noun: 'Winter',      lo: 0.1,  hi: 1 },
  { key: 'res_thunder', form: 'Rod',       noun: 'Grounding',   lo: 0.1,  hi: 1 },
  { key: 'res_poison',  form: 'Vial',      noun: 'Purity',      lo: 0.1,  hi: 1 },
  { key: 'res_dark',    form: 'Rosary',    noun: 'Faith',       lo: 0.1,  hi: 1 },
  { key: 'res_holy',    form: 'Idol',      noun: 'Heresy',      lo: 0.1,  hi: 1 },
  { key: 'elemAtk',     form: 'Prism',     noun: 'the Elements', lo: 0.05, hi: 0.6 },
  { key: 'critDmg',     form: 'Talisman',  noun: 'Ruin',        lo: 0.1,  hi: 1 },
  { key: 'drain',       form: 'Scarab',    noun: 'Souls',       lo: 1,    hi: 8 },  // MP per kill
];

const round = (v) => (v >= 5 ? Math.round(v) : Math.round(v * 100) / 100);

function build() {
  const out = [];
  FAMILIES.forEach((f, fi) => {
    GRADES.forEach((g, gi) => {
      const k = gi / (GRADES.length - 1);
      const bonus = { [f.key]: round(f.lo + (f.hi - f.lo) * k) };
      if (gi >= 7) {
        const s = FAMILIES[(fi * 7 + gi) % FAMILIES.length];
        if (s.key !== f.key) bonus[s.key] = round((s.lo + (s.hi - s.lo) * k) * 0.35);
      }
      out.push({ name: `${g} ${f.form} of ${f.noun}`, type: 'charm', tier: gi, bonus, family: f.key });
    });
  });
  return out;
}

export const CHARM_LIST = build();
