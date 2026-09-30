# Agilancer Nights

A Symphony of the Night–style side-scrolling action RPG for iOS Safari, played in **landscape** with see-through touch controls over the game.

## Running

The game uses ES modules, so it has to be served over HTTP (opening `index.html`
directly as a file won't work):

```sh
python3 -m http.server 8000
# then open http://<your-computer-ip>:8000 in Safari on the iPhone
```

Any static host works too (e.g. GitHub Pages pointed at this repo's root).
Tip: "Add to Home Screen" in Safari gives a full-screen, no-browser-chrome view.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | D-pad | Arrows / WASD |
| Jump | JUMP | Space / Z |
| Attack | ATK | X / J |
| Magic | MAGIC | C / K |
| Pause | ❚❚ | Enter / Esc / P |
| Equipment menu | MENU | I / M / Tab |
| Crouch | Down | Down |
| Slide (on stone floor) | Down + JUMP | Down + Space |
| Drop through wooden platform | Down + JUMP | Down + Space |

Tap the HP/MP bars (or press `) to cycle the debug view: off → read-out → read-out + hit boxes.

## The castle (so far)

Seven rooms laid out on one world grid; walk (or jump / drop) through a gap in
a room's outer wall to enter whichever room is on the other side.

```
                         [4 Lava Gallery]──[5 Ruined Chapel]
               [3 Clock Tower]                    │
[1 Entrance]──[2 Great Corridor]──🔒──[7 Sword    [6 Crypt Vault]
                                        Sanctum]      (Iron Key)
```

The Great Corridor's far door is locked. Climb the tower, cross the lava on
the moving platforms, descend the chapel to find the **Iron Key** in the
vault, then backtrack to open the door and claim the **Short Sword**. Spikes and
lava send you back to your last safe footing. Progress is saved automatically
in the browser (MENU → New Game to start over).

## Combat and stats

- **HP / MP / XP** bars sit top-left with your level. You start with 100 HP and 100 MP; MP refills slowly.
- **Weapons:** a **Knife** waits on a pedestal next to where you start; equip it from MENU. The
  Short Sword is behind the locked door. Your weapon's hit box only exists during the swing.
- **Magic:** you begin with the **Spirit Bolt** spell equipped (8 MP, fires straight ahead).
- **Enemies** (20 types in `src/enemies.js`) walk, attack and die with their own animations.
  Melee enemies hurt you only when their weapon connects (plus a little for bumping into them);
  ranged enemies fire fixed patterns in the direction they face — arcing arrows and webs,
  wavy orbs, 3-way spreads, bouncing fireballs, radial rings — never aimed straight at you.
  Enemies respawn when you re-enter a room.
- **XP and levels:** kills give XP. Each level adds 15% weapon damage (10% spell), +12 max HP and
  +6 max MP, and refills both.
- Spikes and lava hurt and return you to safe footing. At 0 HP you revive at the last doorway
  you came through, fully healed, keeping your XP and items.

## Equipment menu

## Layout

```
index.html            page, on-screen controls, menu markup
css/style.css         portrait layout, controls and menu styling
src/main.js           boot, fixed 60 Hz loop, rendering, overlays
src/config.js         resolution, tile size, movement tuning
src/input.js          unified input state (held / pressed / released) + keyboard
src/touchControls.js  multi-touch D-pad and buttons
src/world.js          current room, room transitions, hazards, pickups, doors, save
src/rooms.js          the castle: room maps, decorations, items, moving platforms
src/room.js           tile collision, themes, drawing, moving platforms
src/player.js         player physics, collision, animation, stats, sword swing
src/enemies.js        enemy types, AI, weapon hit boxes, projectile patterns
src/enemySprites.js   generated: enemy frame data
src/tileTypes.js      collision constants
src/items.js          item database, equipment slots, pixel icons
src/menu.js           equipment / inventory screen
src/assets.js         tile atlas loading + drawing
src/tileIndex.js      generated: tile name -> atlas index
src/playerSprites.js  generated: player frame data
assets/               generated atlases (+ source/ originals)
tools/                asset build scripts and level checkers
```

## Editing rooms

Rooms live in `src/rooms.js` as text grids of 32x32 tiles: `#` wall, `=` one-way
platform, `^` spikes, `L` lava, `C` crate, `D` locked door, `.` empty. Each room
has a world position (`x`, `y` in tiles); rooms that touch line up their wall
gaps. Decorations use tile names from `src/tileIndex.js`.

Physics limits to design around: a full jump rises ~2.6 tiles (so ledges up to
2 tiles higher are reachable) and clears about 3-4 tiles of gap.

After editing, check every route is still possible:

```sh
node tools/check_rooms.mjs          # all rooms (add a room id and --map to see reachable spots)
node tools/bot_gallery.mjs          # plays the moving-platform room both ways
node tools/lint_rooms.mjs           # floor props on floors, hanging props under ceilings, enemies on ground
```

Free-standing one-way platforms (not built into a wall) are drawn hanging from
chains up to the ceiling automatically.

## Tiles

`tools/build_tiles.py` cuts the two 50-tile sheets in `assets/source/` into
`assets/tiles.png` (32px) and `assets/tiles_big.png` (64px, for 2x2 props), and
makes the dark backdrop of prop tiles (banners, candles, platforms...)
transparent.

## Player sprites

`tools/build_player_sprites.py` reads `assets/source/player_sheet.png`, cuts
out each frame (the sheet has a transparent background), scales it to game
size (`SCALE` in the script) and writes `assets/player.png` +
`src/playerSprites.js`. Frames face right and are mirrored in-game for left.

```sh
pip install pillow numpy scipy
python3 tools/build_player_sprites.py
python3 tools/build_tiles.py
python3 tools/build_enemy_sprites.py   # --debug writes frame boxes over the sheets
```
