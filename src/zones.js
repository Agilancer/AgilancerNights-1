// Castle zones. Each is deeper, darker and stranger than the last.
//   tier / mult: loot tier and enemy stat multiplier
//   dark:  0..1 how much of the screen is swallowed by darkness
//   tint:  colour washed over the scene      bg: 'tile' | 'sky' | 'void'
//   fx:    ambient particles                  wobble: screen distortion
//   foes:  enemy types with palette variants  gate: ability needed to enter
export const ZONES = [
  { name: 'Castle Gate', tier: 0, mult: 1, dark: 0, fx: 'dust', foes: [] },
  {
    name: 'Marble Gallery', tier: 1, mult: 1.25, dark: 0, fx: 'dust', bg: 'tile',
    theme: { wall: ['wall_1', 'wall_4', 'wall_1'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'arcade_wall', shade: 0.45 },
    decor: { wall: ['window_cross', 'window_blue', 'tapestry', 'window_tall'], floor: ['statue', 'candelabra', 'gargoyle'], hang: ['chandelier', 'banner_blue', 'curtain'] },
    foes: [['skeleton'], ['zombie'], ['goblin'], ['skeleton_archer'], ['spider']],
    rooms: ['Hall of Busts', 'Portrait Gallery', 'Grand Stair', 'Mirror Hall', 'Sculptors\' Walk', 'Velvet Corridor', 'Hall of Kings', 'The Colonnade', 'Ballroom', 'Salon of Whispers', 'Marble Nave', 'Trophy Hall', 'Gilded Passage', 'East Gallery', 'West Gallery', 'Chandelier Hall'],
  },
  {
    name: 'Outer Ramparts', tier: 2, mult: 1.7, dark: 0, fx: 'wind', bg: 'sky', gate: 'doubleJump',
    theme: { wall: ['brick', 'wall_1', 'wall_4'], cap: 'plat_stone', oneway: 'plat_brick', bg: 'brick', shade: 0.5 },
    decor: { wall: ['arrow_slit', 'torch'], floor: ['barrel', 'crate', 'gargoyle_2'], hang: ['banner_red', 'banner_lion'] },
    foes: [['harpy', 'moon'], ['skeleton_archer', 'moon'], ['wolf', 'moon'], ['goblin_shaman'], ['orc']],
    rooms: ['Windswept Wall', 'Watchtower', 'Moonlit Parapet', 'Gatehouse', 'Crow\'s Walk', 'Broken Bastion', 'Signal Tower', 'Outer Keep', 'Rampart Stair', 'The Long Wall', 'Archers\' Nest', 'Storm Battlement', 'Barbican', 'Sentry Post'],
  },
  {
    name: 'Royal Library', tier: 3, mult: 2.3, dark: 0.25, fx: 'motes', bg: 'tile', gate: 'sprint',
    theme: { wall: ['wall_4', 'brick', 'wall_1'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'bookshelf', shade: 0.55 },
    decor: { wall: ['lantern', 'window_tall', 'torch'], floor: ['candelabra', 'clock', 'statue', 'bookshelf'], hang: ['chandelier_2', 'curtain_torn'] },
    foes: [['dark_wizard'], ['wraith', 'arcane'], ['goblin_shaman', 'arcane'], ['slime', 'arcane'], ['lich']],
    rooms: ['Reading Room', 'Forbidden Stacks', 'Scriptorium', 'Map Room', 'Hall of Tomes', 'Archivist\'s Cell', 'Alchemy Nook', 'Star Chart Room', 'Index of Sorrows', 'The Quiet Stacks', 'Candlelit Aisle', 'Restricted Section', 'Bindery', 'Ink Vault'],
  },
  {
    name: 'Catacombs', tier: 4, mult: 3.0, dark: 0.45, fx: 'dust', bg: 'tile', gate: 'mist',
    theme: { wall: ['wall_crumble', 'brick', 'wall_4'], cap: 'plat_broken', oneway: 'plat_iron', bg: 'wall_crumble', shade: 0.62 },
    decor: { wall: ['torch', 'window_broken'], floor: ['coffin_alcove', 'statue_alcove', 'sack', 'statue'], hang: ['chains'] },
    foes: [['zombie', 'bone'], ['skeleton', 'bone'], ['giant_spider'], ['spider', 'toxic'], ['orc', 'bone'], ['lich', 'bone']],
    rooms: ['Ossuary', 'Bone Gallery', 'Charnel Pit', 'Tomb of the Nameless', 'Crypt Stair', 'Hall of Skulls', 'Weeping Crypt', 'Sepulchre', 'Embalmers\' Hall', 'Rat Warren', 'Burial Niches', 'The Deep Tombs', 'Coffin Walk', 'Sunken Crypt', 'Hall of Urns', 'Mourners\' Gate'],
  },
  {
    name: 'Clockwork Spire', tier: 5, mult: 3.7, dark: 0.3, fx: 'storm', bg: 'tile', gate: 'spikes',
    theme: { wall: ['wall_4', 'brick', 'wall_1'], cap: 'plat_stone', oneway: 'plat_chain', bg: 'brick', shade: 0.58 },
    decor: { wall: ['window_tall', 'window_blue', 'lantern'], floor: ['clock', 'candelabra', 'gargoyle'], hang: ['chains', 'chandelier'] },
    foes: [['harpy', 'storm'], ['banshee'], ['evil_knight'], ['skeleton_archer', 'storm'], ['minotaur']],
    rooms: ['Pendulum Hall', 'Gear Loft', 'Bell Chamber', 'Escapement', 'The Stopped Hour', 'Winding Stair', 'Counterweight Shaft', 'Chime Room', 'Spire Balcony', 'Clockmaker\'s Room', 'Hall of Hours', 'Minute Walk', 'Storm Belfry', 'Mainspring'],
  },
  {
    name: 'Drowned Cistern', tier: 6, mult: 4.5, dark: 0.5, fx: 'drips', bg: 'tile', gate: 'gravity', tint: 'rgba(20,80,90,0.18)',
    theme: { wall: ['wall_2', 'brick_moss', 'wall_2'], cap: 'plat_vines', oneway: 'plat_vines', bg: 'brick_moss', shade: 0.62 },
    decor: { wall: ['waterfall', 'waterfall_2', 'window_broken'], floor: ['statue', 'gargoyle_2'], hang: ['chains', 'curtain_torn'] },
    foes: [['slime', 'toxic'], ['wraith', 'drowned'], ['lich', 'drowned'], ['giant_spider', 'drowned'], ['banshee', 'drowned'], ['zombie', 'drowned']],
    rooms: ['Flooded Gallery', 'Sluice Gate', 'Weeping Reservoir', 'Drowned Chapel', 'Rusted Pumphouse', 'The Undertow', 'Siren\'s Grotto', 'Black Water Hall', 'Moss Cathedral', 'Drain of Sighs', 'Sunken Stair', 'Cistern Depths', 'Bloated Hall', 'Tide Chamber'],
  },
  {
    name: 'Infernal Forge', tier: 7, mult: 5.4, dark: 0.35, fx: 'embers', bg: 'tile', gate: 'lava', tint: 'rgba(255,90,20,0.12)',
    theme: { wall: ['wall_red', 'brick_blood', 'wall_red'], cap: 'plat_broken', oneway: 'plat_lava', bg: 'wall_red', shade: 0.6 },
    decor: { wall: ['lavafall', 'torch'], floor: ['fireplace', 'crates', 'barrel', 'gargoyle_head'], hang: ['chains'] },
    foes: [['demon', 'magma'], ['orc_brute', 'crimson'], ['troll', 'magma'], ['dark_wizard', 'magma'], ['wolf', 'crimson']],
    rooms: ['Slag Hall', 'Bellows Room', 'Anvil of Screams', 'Crucible', 'Smelting Pit', 'Chain Foundry', 'Cinder Walk', 'The Furnace Heart', 'Quench Pool', 'Ash Gallery', 'Brimstone Stair', 'Hellforge', 'Molten Channel', 'Soot Chapel', 'Hammer Hall', 'Branding Room'],
  },
  {
    name: 'Halls of Flesh', tier: 8, mult: 6.4, dark: 0.55, fx: 'eyes', bg: 'tile', gate: 'crimson_key', tint: 'rgba(140,0,30,0.2)', pulse: true, scribbles: true,
    theme: { wall: ['brick_blood', 'wall_red', 'brick_blood'], cap: 'plat_curtain', oneway: 'plat_curtain', bg: 'wall_red', shade: 0.55 },
    decor: { wall: ['tapestry', 'window_broken'], floor: ['coffin_alcove', 'statue_alcove', 'statue'], hang: ['curtain_torn', 'curtain', 'chains'] },
    foes: [['minotaur', 'flesh'], ['zombie', 'flesh'], ['banshee', 'flesh'], ['slime', 'flesh'], ['wolf', 'flesh'], ['troll', 'flesh']],
    rooms: ['The Breathing Hall', 'Sinew Gallery', 'Heart Chamber', 'Vein Corridor', 'The Womb', 'Teeth Stair', 'Hall of Mouths', 'Marrow Walk', 'Gut Chapel', 'Skin Library', 'The Pulse', 'Nerve Bridge', 'Eye Gallery', 'Bone Cradle', 'Blood Font', 'The Swallowing Room'],
  },
  {
    name: 'The Inverted Abyss', tier: 9, mult: 7.6, dark: 0.5, fx: 'void', bg: 'void', gate: 'abyss_key', tint: 'rgba(60,0,110,0.18)', wobble: 1, scribbles: true,
    theme: { wall: ['floor_dark', 'wall_4', 'floor_dark'], cap: 'plat_iron', oneway: 'plat_iron', bg: 'floor_dark', shade: 0.7 },
    decor: { wall: ['window_broken'], floor: ['statue', 'gargoyle_head', 'coffin_alcove'], hang: ['chains'] },
    foes: [['evil_knight', 'void'], ['lich', 'void'], ['demon', 'void'], ['wraith', 'void'], ['minotaur', 'void'], ['harpy', 'void']],
    rooms: ['Where Up Was', 'The Unlit Stair', 'Hall of Nothing', 'Reversed Chapel', 'The Starless Walk', 'Hollow Throne Room', 'Echo of the Gate', 'Fractured Nave', 'The Last Corridor', 'Void Gallery', 'Upside Cathedral', 'The Throne of Night'],
  },
];

// Things written faintly on the walls in the deepest halls.
export const SCRIBBLES = [
  'IT SEES YOU', 'turn back', 'we were knights once', 'THE CASTLE IS HUNGRY', 'no dawn here', 'he wears our faces',
  'count the doors', 'I forgot my name', 'DOWN IS UP', 'the walls breathe', 'do not look at the moon', 'stay',
];
