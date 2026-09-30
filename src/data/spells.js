// Spells for the Spell slot. `cast` is handled in world.js castSpell().
export const SPELL_LIST = [
  { id: 'spirit_bolt',  name: 'Spirit Bolt',   tier: 0, mp: 8,  power: 12, cast: 'bolt',    desc: 'A bolt of spirit energy flies straight ahead.' },
  { id: 'fire_orb',     name: 'Hellfire Orb',  tier: 2, mp: 12, power: 18, cast: 'fireOrb', element: 'fire', desc: 'Lob an orb that bursts into flame where it lands.' },
  { id: 'ice_lance',    name: 'Ice Lance',     tier: 3, mp: 10, power: 20, cast: 'iceLance', element: 'ice', desc: 'A spear of ice that pierces every foe in a line.' },
  { id: 'holy_cross',   name: 'Holy Cross',    tier: 4, mp: 16, power: 24, cast: 'cross',   element: 'holy', desc: 'A spinning cross flies out and returns to you.' },
  { id: 'thunder_call', name: 'Thunder Call',  tier: 5, mp: 18, power: 30, cast: 'thunder', element: 'thunder', desc: 'Three bolts of lightning strike the ground ahead.' },
  { id: 'soul_drain',   name: 'Soul Drain',    tier: 6, mp: 20, power: 22, cast: 'drain',   element: 'dark', desc: 'Tear the life from nearby foes and take it for yourself.' },
  { id: 'bat_swarm',    name: 'Bat Swarm',     tier: 7, mp: 22, power: 16, cast: 'bats',    element: 'dark', desc: 'Five bats hunt down the nearest enemies.' },
  { id: 'meteor',       name: 'Starfall',      tier: 9, mp: 40, power: 80, cast: 'meteor',  element: 'fire', desc: 'Call down a burning star from beyond the castle walls.' },
];
