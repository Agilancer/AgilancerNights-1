// Elemental damage. Each element has a colour (weapon glow / particles), a
// status effect it may inflict, and a word used in item names.
export const ELEMENTS = {
  fire:    { name: 'Fire',      word: 'Flames',   color: '#ff8a30', glow: 'rgba(255,120,30,0.7)', status: 'burn' },
  ice:     { name: 'Ice',       word: 'Frost',    color: '#9ae4ff', glow: 'rgba(150,220,255,0.7)', status: 'freeze' },
  thunder: { name: 'Lightning', word: 'Storms',   color: '#ffec60', glow: 'rgba(255,236,96,0.75)', status: 'shock' },
  poison:  { name: 'Poison',    word: 'Venom',    color: '#8ae044', glow: 'rgba(130,224,68,0.7)', status: 'poison' },
  holy:    { name: 'Holy',      word: 'Light',    color: '#fff2a8', glow: 'rgba(255,240,160,0.8)', status: null },
  dark:    { name: 'Dark',      word: 'Shadow',   color: '#a070e0', glow: 'rgba(150,100,220,0.7)', status: 'curse' },
  blood:   { name: 'Blood',     word: 'Blood',    color: '#ff3a4a', glow: 'rgba(255,50,70,0.7)', status: 'bleed' },
};
export const ELEMENT_IDS = Object.keys(ELEMENTS);

// How much of each element an enemy family takes (1 = normal, 0 = immune,
// 2 = double). Families are assigned in enemies.js.
export const AFFINITY = {
  undead:  { holy: 2, fire: 1.5, dark: 0.5, poison: 0.5, blood: 0.5 },
  ghost:   { holy: 2.2, dark: 0.3, poison: 0.5, blood: 0.3, physical: 0.5 },
  beast:   { fire: 1.5, poison: 1.3 },
  demon:   { holy: 1.8, fire: 0, ice: 1.6, dark: 0.5 },
  arcane:  { thunder: 1.5, dark: 0.6, holy: 1.3 },
  slime:   { fire: 1.8, ice: 1.5, poison: 0.5, physical: 0.8 },
  brute:   { thunder: 1.4, poison: 1.3 },
  bug:     { fire: 1.8, poison: 0.5, ice: 1.3 },
  knight:  { thunder: 1.6, dark: 0.8, holy: 0.8 },
};
