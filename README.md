# Agilancer Nights

A Castlevania: Symphony of the Night–style action RPG for iOS Safari, played in
**landscape** with see-through touch controls over the game.

## Running

The game uses ES modules, so serve it over HTTP:

```sh
python3 -m http.server 8000
# then open http://<your-computer-ip>:8000 in Safari
```

Any static host works (e.g. GitHub Pages). "Add to Home Screen" gives a full-screen view.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move / crouch | D-pad | Arrows / WASD |
| Jump (again in mid-air with the Leap Boots) | JUMP | Space / Z |
| Attack (tap again during a swing for your left-hand weapon) | ATK | X / J |
| Cast the equipped spell | MAGIC | C / K |
| Sprint (Gale Greaves) | double-tap left / right | double-tap |
| Super jump (Gravity Crown) | hold up + JUMP | Up + Space |
| Slide / drop through a platform (hold down to keep falling) | down + JUMP | Down + Space |
| Pause · Menu | ❚❚ · MENU | Enter · I / M / Tab |

## The castle

150 rooms in 10 areas, each deeper, darker and stranger than the last:

| Area | Rooms | Gate to enter | Bosses |
| --- | --- | --- | --- |
| Castle Gate | 7 | — | (Evil Knight guards the sword) |
| Marble Gallery | 17 | — | Bone Colossus |
| Outer Ramparts | 15 | double jump | Harpy Queen |
| Royal Library | 16 | sprint | The Grand Lich, The Grimoire Wraith |
| Catacombs | 17 | Mist Veil (iron grates) | Spider Matriarch, The Troll King |
| Clockwork Spire | 15 | spike immunity | Minotaur Lord |
| Drowned Cistern | 15 | super jump | The Drowned Siren |
| Infernal Forge | 16 | lava immunity | The Demon Smith, Orc Warlord |
| Halls of Flesh | 17 | Crimson Key | The Flesh Abomination, Fenrir |
| The Inverted Abyss | 15 | Abyss Key | The Void Knight, **The Nightlord** |

Each boss drops the relic or key that opens the next area, so you backtrack
through old areas to reach new ones, and to reach treasure you could see but not
touch before. Deeper areas bring darkness (the Spirit Lantern pushes it back),
rain and lightning, dripping water and blood, watching eyes, writing on the walls,
a breathing red tint and a rippling void.

Boss arenas seal until the boss falls. Bosses are scaled-up, palette-swapped
monsters with aura, special attacks (quakes, projectile rains, novas, charges,
summons, teleports, beams) and an enraged second phase.

Cracked walls hide 18 secret rooms: attack them to break through. 124 treasure
chests hold equipment, spells, Life / Mana Vessels and legendary weapons. The
rarest are in secret rooms and ability-locked pockets. Enemies drop gear, and
HP / MP orbs.

## Equipment

- **202 weapons** in 16 classes (daggers, swords, longswords, greatswords, rapiers,
  katanas, axes, maces, warhammers, spears, lances, scythes, claws, flails,
  staves, whips) across 10 materials. Each one's swing is built from its own mix
  of motion (slash, rising, two-strike, overhead, thrust + lunge, flurry, spin,
  ground smash + shockwave, reap, whip lash), arc, speed, reach, blade shape,
  colours and elemental trail. Twelve named whips include the **Thorn Whip** and
  **Flame Whip**. Eighteen legendaries fire beams (crescents, fireballs, shards,
  holy crosses...). The **Requiem of Agilancer**, hidden in the deepest secret
  room, sweeps a colossal energy blade across the whole screen.
- **Elements**: fire, ice, lightning, poison, holy, dark and blood. They inflict
  burn, freeze, shock, poison, curse or bleed. Each enemy family has weaknesses
  and immunities (holy destroys the undead; demons laugh at fire).
- **40 armor pieces** (20 head, 20 body) with DEF and resistances.
- **264 charms** (3 slots): attack, defense, HP, MP, regeneration, luck, XP,
  critical hits, speed, jump, life steal, spell power, thorns, resistances...
- **8 spells**: Spirit Bolt, Hellfire Orb, Ice Lance, Holy Cross, Thunder Call,
  Soul Drain, Bat Swarm, Starfall.
- **10 relics** fill the passive slots and are always active: Leap Boots (double
  jump), Gale Greaves (sprint), Spirit Lantern, Mist Veil, Saint's Soles, Gravity
  Crown, Salamander Scale, Vampire Fang, Seer's Eye (reveals the map), Echo Heart
  (survive one killing blow per room).
- **Levels** add weapon / spell damage, max HP and max MP.

The **menu** has Equip (slots + everything that fits, with ▲/▼ comparisons),
Items (by category), Relics, and a **Map** (drag to pan, +/− to zoom).

## Code layout

```
src/main.js          boot, title, loop, rendering, lighting, atmosphere, HUD
src/title.js         animated title screen
src/world.js         rooms, transitions, combat, loot, spells, bosses, saving
src/room.js          tiles, themes, backgrounds, chests, breakables, seals
src/player.js        movement, abilities, weapon swings
src/weaponFx.js      weapon poses, drawing and hit boxes
src/enemies.js       enemy types, AI, status effects, projectile patterns
src/boss.js          the 14 bosses
src/palette.js       runtime palette swaps for sprites
src/zones.js         areas: themes, darkness, effects, enemy rosters
src/items.js         item registry, icons       src/data/*  item tables
src/stats.js         equipment bonuses          src/loot.js  drop tables
src/menu.js          Equip / Items / Relics / Map
src/rooms.js         the 7 hand-built rooms (+ the generated castle)
src/castle.js        generated: the other 143 rooms
tools/               asset builders, castle generator, checkers
```

## Tools

```sh
node tools/gen_castle.mjs [--seed N]   # rebuild src/castle.js (~8 min); every room is
                                       # proven playable with the real physics
node tools/check_castle.mjs            # doors line up, no overlaps, all rooms connected
node tools/lint_rooms.mjs              # props on floors, hanging props under ceilings
node tools/check_rooms.mjs             # routes through the hand-built rooms
node tools/bot_gallery.mjs             # plays the moving-platform room both ways
python3 tools/build_tiles.py           # tile atlases from assets/source
python3 tools/build_player_sprites.py  # player atlas
python3 tools/build_enemy_sprites.py   # enemy atlas
```

The generator lays rooms out on a grid of 20×10-tile cells. It carves floors,
doorways, platform stacks, pits, blocks, ledges, gates, pockets and secret walls,
then uses `tools/solver.mjs` to run the actual player physics through run, jump,
double-jump, sprint and super-jump manoeuvres. It checks that every door can be
reached from every other door with the abilities you have in that area, that
gates can't be bypassed without their ability, and that locked pockets really
need theirs. Any room that fails is rebuilt.
