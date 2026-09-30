// On-screen touch controls: an 8-way D-pad plus action buttons.
// Multi-touch aware; fingers can slide across the D-pad and between buttons.

const DPAD_DEADZONE = 0.18; // fraction of the D-pad radius

export function setupTouchControls(root, input) {
  const dpad = root.querySelector('#dpad');
  const buttons = [...root.querySelectorAll('[data-action]')];
  const touches = new Map(); // touch id -> { kind: 'dpad' | 'button', x, y, action }

  const inRect = (r, x, y, pad = 0) =>
    x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;

  function dpadDirections(x, y) {
    const r = dpad.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < (r.width / 2) * DPAD_DEADZONE) return [];
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0 = right, 90 = down
    const dirs = [];
    if (Math.abs(deg) <= 67.5) dirs.push('right');
    if (Math.abs(deg) >= 112.5) dirs.push('left');
    if (deg >= 22.5 && deg <= 157.5) dirs.push('down');
    if (deg <= -22.5 && deg >= -157.5) dirs.push('up');
    return dirs;
  }

  function buttonAt(x, y) {
    for (const b of buttons) {
      if (inRect(b.getBoundingClientRect(), x, y, 6)) return b.dataset.action;
    }
    return null;
  }

  function sync() {
    const held = new Set();
    for (const t of touches.values()) {
      if (t.kind === 'dpad') for (const d of dpadDirections(t.x, t.y)) held.add(d);
      else if (t.action) held.add(t.action);
    }
    input.setSource('touch', held);
    for (const b of buttons) b.classList.toggle('active', held.has(b.dataset.action));
    for (const d of ['up', 'down', 'left', 'right']) dpad.classList.toggle(d, held.has(d));
  }

  function onStart(e) {
    e.preventDefault();
    const dr = dpad.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (inRect(dr, x, y, 20)) touches.set(t.identifier, { kind: 'dpad', x, y });
      else touches.set(t.identifier, { kind: 'button', x, y, action: buttonAt(x, y) });
    }
    sync();
  }

  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const entry = touches.get(t.identifier);
      if (!entry) continue;
      entry.x = t.clientX;
      entry.y = t.clientY;
      // Pause shouldn't be triggered by sliding onto it.
      if (entry.kind === 'button') {
        const a = buttonAt(entry.x, entry.y);
        entry.action = a === 'pause' && entry.action !== 'pause' ? null : a;
      }
    }
    sync();
  }

  function onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) touches.delete(t.identifier);
    sync();
  }

  const opts = { passive: false };
  root.addEventListener('touchstart', onStart, opts);
  root.addEventListener('touchmove', onMove, opts);
  root.addEventListener('touchend', onEnd, opts);
  root.addEventListener('touchcancel', onEnd, opts);

  // Mouse fallback so the on-screen pad can be clicked on desktop.
  let mouseDown = false;
  const mouseTouch = (e) => ({ changedTouches: [{ identifier: 'mouse', clientX: e.clientX, clientY: e.clientY }], preventDefault() {} });
  root.addEventListener('mousedown', (e) => { mouseDown = true; onStart(mouseTouch(e)); });
  window.addEventListener('mousemove', (e) => { if (mouseDown) onMove(mouseTouch(e)); });
  window.addEventListener('mouseup', (e) => { if (mouseDown) { mouseDown = false; onEnd(mouseTouch(e)); } });

  // Drop everything if the page loses focus mid-press.
  const reset = () => { touches.clear(); sync(); };
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
}
