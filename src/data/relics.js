// Passive relics: always active once found; they fill the 10 passive slots.
// `ability` is read by the player and world.
export const RELIC_LIST = [
  { id: 'leap_boots',      name: 'Leap Boots',       ability: 'doubleJump', icon: 'boots',   desc: 'Jump again in mid-air. Places once out of reach are now within it.' },
  { id: 'gale_greaves',    name: 'Gale Greaves',     ability: 'sprint',     icon: 'greaves', desc: 'Double-tap left or right to sprint. Sprint-jumps carry you across wide gaps.' },
  { id: 'spirit_lantern',  name: 'Spirit Lantern',   ability: 'lantern',    icon: 'lantern', desc: 'Lights the dark and makes cracked, breakable walls glow.' },
  { id: 'mist_veil',       name: 'Mist Veil',        ability: 'mist',       icon: 'veil',    desc: 'Your body turns to mist as it touches iron grates, letting you pass through.' },
  { id: 'saints_soles',    name: "Saint's Soles",    ability: 'spikes',     icon: 'soles',   desc: 'Blessed soles. Spikes can no longer pierce your feet.' },
  { id: 'gravity_crown',   name: 'Gravity Crown',    ability: 'gravity',    icon: 'crown',   desc: 'Hold UP and press JUMP to leap to incredible heights.' },
  { id: 'salamander_scale', name: 'Salamander Scale', ability: 'lava',      icon: 'scale',   desc: 'Molten rock feels like warm water. You can wade through lava.' },
  { id: 'vampire_fang',    name: 'Vampire Fang',     ability: 'vampire',    icon: 'fang',    desc: 'Every blow you land restores a little of your life.' },
  { id: 'seer_eye',        name: "Seer's Eye",       ability: 'seer',       icon: 'eye',     desc: 'Reveals the entire castle on your map, and every chest within it.' },
  { id: 'echo_heart',      name: 'Echo Heart',       ability: 'echo',       icon: 'heart',   desc: 'Once per room, a killing blow leaves you standing with a third of your life.' },
];
