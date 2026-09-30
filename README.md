# Agilancer Nights

A Symphony of the Night–style side-scrolling action RPG for iOS Safari (portrait).

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
| Crouch | Down | Down |
| Slide (on stone floor) | Down + JUMP | Down + Space |
| Drop through wooden platform | Down + JUMP | Down + Space |

Tap the game screen to cycle the debug view: read-out → read-out + hit box → off.

## Layout

```
index.html            page + on-screen controls markup
css/style.css         portrait layout, controls styling
src/main.js           boot, fixed 60 Hz loop, rendering, pause
src/config.js         resolution + all movement tuning values
src/input.js          unified input state (held / pressed / released) + keyboard
src/touchControls.js  multi-touch D-pad and buttons
src/room.js           tile map (text grid) and room drawing
src/player.js         player physics, collision (21x32 hit box) and animation states
src/playerSprites.js  generated frame data for assets/player.png
assets/player.png     generated player atlas (game resolution)
assets/source/        original, full-size sprite sheet
tools/build_player_sprites.py  cuts the source sheet into the atlas
src/camera.js         camera follow, clamped to room bounds
```

Rooms are text grids in `src/room.js`: `#` solid, `=` one-way platform,
`.` empty, `P` player spawn. Tiles are 16x16; the game renders at 320x240 and
is scaled up to fit the screen width.

## Player sprites

`tools/build_player_sprites.py` reads `assets/source/player_sheet.png`, cuts
out each frame (the sheet has a transparent background), scales it to game
size (`SCALE` in the script) and writes `assets/player.png` +
`src/playerSprites.js`. Frames face right and are mirrored in-game for left.

```sh
pip install pillow numpy scipy
python3 tools/build_player_sprites.py
```
