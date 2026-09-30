// Adds up everything that modifies the player: level, armor, charms,
// vessels and relics. The result is stored on the player as `mods`.
import { ITEMS, HP_PER_LEVEL, MP_PER_LEVEL } from './items.js';
import { ELEMENT_IDS } from './data/elements.js';

export function emptyMods() {
  const m = { atk: 0, def: 0, maxHp: 0, maxMp: 0, hpRegen: 0, mpRegen: 0, luck: 0, xp: 0, crit: 0.05, critDmg: 0.5,
    speed: 0, jump: 0, lifesteal: 0, spell: 0, thorns: 0, iframes: 0, elemAtk: 0, drain: 0 };
  for (const e of ELEMENT_IDS) m[`res_${e}`] = 0;
  return m;
}

export function computeMods(state) {
  const m = emptyMods();
  for (const slot of ['head', 'body', 'charm1', 'charm2', 'charm3']) {
    const it = ITEMS[state.equip[slot]];
    if (!it?.bonus) continue;
    for (const [k, v] of Object.entries(it.bonus)) m[k] = (m[k] || 0) + v;
  }
  const rel = new Set(state.relics || []);
  if (rel.has('vampire_fang')) m.lifesteal += 0.03;
  for (const e of ELEMENT_IDS) m[`res_${e}`] = Math.min(1, m[`res_${e}`]);
  const lv = state.level;
  m.maxHpTotal = 100 + (lv - 1) * HP_PER_LEVEL + (state.vessels?.hp || 0) * 10 + m.maxHp;
  m.maxMpTotal = 100 + (lv - 1) * MP_PER_LEVEL + (state.vessels?.mp || 0) * 10 + m.maxMp;
  return m;
}

// Relic abilities the player has.
export function abilitiesOf(state) {
  const a = {};
  for (const id of state.relics || []) if (ITEMS[id]?.ability) a[ITEMS[id].ability] = true;
  return a;
}
