// 40 armor pieces: 20 for the head, 20 for the body.
// bonus keys match stats.js (def, atk, maxHp, maxMp, res_<element>, ...).
const H = (name, tier, def, bonus = {}, desc = '') => ({ name, tier, type: 'head', bonus: { def, ...bonus }, desc });
const B = (name, tier, def, bonus = {}, desc = '') => ({ name, tier, type: 'body', bonus: { def, ...bonus }, desc });

export const ARMOR_LIST = [
  H('Leather Cap', 0, 1), H('Iron Helm', 1, 3), H('Chain Coif', 1, 4), H('Bone Mask', 2, 5, { res_dark: 0.3 }, 'A mask carved from a skull. It whispers.'),
  H('Steel Helm', 2, 6), H('Silver Circlet', 3, 5, { maxMp: 20, res_holy: 0.3 }), H('Wizard Hat', 3, 3, { spell: 0.15, maxMp: 15 }),
  H("Hunter's Hood", 3, 6, { luck: 0.12 }), H('Knight Helm', 4, 9), H('Plague Mask', 4, 8, { res_poison: 1 }, 'Beaked and stuffed with herbs. Poison cannot touch you.'),
  H('Horned Helm', 5, 11, { atk: 3 }), H('Crystal Tiara', 5, 8, { maxMp: 40, mpRegen: 0.8 }), H('Dragon Helm', 6, 14, { res_fire: 0.6 }),
  H('Crown of Thorns', 6, 10, { atk: 6, thorns: 0.3 }, 'It bites. So do you.'), H('Frostguard Helm', 7, 16, { res_ice: 0.7 }),
  H('Sanguine Visor', 7, 15, { lifesteal: 0.03 }), H('Seraph Halo', 8, 14, { res_holy: 0.8, hpRegen: 1 }), H('Lich Crown', 8, 18, { spell: 0.3, maxMp: 50 }),
  H('Abyssal Helm', 9, 22, { res_dark: 0.8 }), H("Nightlord's Crown", 10, 28, { atk: 8, maxHp: 50, maxMp: 50 }, 'The crown of the master of this castle.'),
  B('Cloth Tunic', 0, 2), B('Leather Armor', 0, 4), B('Padded Gambeson', 1, 5), B('Chain Mail', 1, 8), B('Scale Mail', 2, 10),
  B('Bone Cuirass', 3, 11, { res_dark: 0.3 }), B('Mage Robe', 3, 6, { maxMp: 30, spell: 0.2 }), B("Hunter's Coat", 3, 9, { luck: 0.15, speed: 0.05 }),
  B('Silver Plate', 4, 13, { res_holy: 0.4 }), B('Knight Plate', 5, 16), B('Storm Coat', 5, 15, { res_thunder: 0.7 }),
  B('Plague Robes', 5, 12, { res_poison: 1 }), B('Dragon Mail', 6, 20, { res_fire: 0.7 }), B('Frost Plate', 6, 21, { res_ice: 0.7 }),
  B('Mirror Cuirass', 7, 19, { thorns: 0.4 }, 'Polished until it reflects harm back at its source.'), B('Sanguine Mail', 7, 23, { lifesteal: 0.04 }),
  B('Seraph Robes', 8, 22, { res_holy: 0.8, hpRegen: 1.2 }), B('Obsidian Plate', 8, 28), B('Abyssal Carapace', 9, 32, { res_dark: 0.8, maxHp: 30 }),
  B("Nightlord's Mantle", 10, 40, { maxHp: 60, maxMp: 60, atk: 6 }, 'Woven from the dark between the stars.'),
];
