// Unified input state. Keyboard and touch both feed "sources"; the game reads
// `held`, `pressed` (went down this step) and `released` (went up this step).

export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'magic', 'pause'];

export class Input {
  constructor() {
    this.sources = new Map(); // name -> Set of held actions
    this.held = {};
    this.pressed = {};
    this.released = {};
    this.prev = {};
    // Presses latched between steps so a tap shorter than one frame isn't lost.
    this.latched = new Set();
    for (const a of ACTIONS) {
      this.held[a] = this.pressed[a] = this.released[a] = this.prev[a] = false;
    }
  }

  // Replace the set of actions held by one source (e.g. 'touch', 'keyboard').
  setSource(name, actions) {
    const before = this.sources.get(name) || new Set();
    for (const a of actions) if (!before.has(a)) this.latched.add(a);
    this.sources.set(name, new Set(actions));
  }

  // Call once at the start of every fixed simulation step.
  update() {
    for (const a of ACTIONS) {
      let h = false;
      for (const set of this.sources.values()) if (set.has(a)) { h = true; break; }
      this.held[a] = h;
      this.pressed[a] = (h && !this.prev[a]) || this.latched.has(a);
      this.released[a] = !h && this.prev[a];
      this.prev[a] = h;
    }
    this.latched.clear();
  }
}

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump',
  KeyX: 'attack', KeyJ: 'attack',
  KeyC: 'magic', KeyK: 'magic',
  Enter: 'pause', Escape: 'pause', KeyP: 'pause',
};

// Keyboard support for desktop testing.
export function setupKeyboard(input) {
  const down = new Set();
  const sync = () => input.setSource('keyboard', down);
  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) { down.add(a); sync(); }
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    down.delete(a); sync();
  });
  window.addEventListener('blur', () => { down.clear(); sync(); });
}
