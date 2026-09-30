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
| Drop through wooden platform | Down + JUMP | Down + Space |

Tap the game screen to toggle the debug read-out.

## Layout

```
index.html            page + on-screen controls markup
css/style.css         portrait layout, controls styling
src/main.js           boot, fixed 60 Hz loop, rendering, pause
src/config.js         resolution + all movement tuning values
src/input.js          unified input state (held / pressed / released) + keyboard
src/touchControls.js  multi-touch D-pad and buttons
src/room.js           tile map (text grid) and room drawing
src/player.js         player physics & collision (hit box 21x32 in a 32x32 sprite)
src/camera.js         camera follow, clamped to room bounds
```

Rooms are text grids in `src/room.js`: `#` solid, `=` one-way platform,
`.` empty, `P` player spawn. Tiles are 16x16; the game renders at 320x240 and
is scaled up to fit the screen width.
