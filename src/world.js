import { TILE } from './config.js';
import { ROOMS, START } from './rooms.js';
import { Room, SOLID, ONE_WAY } from './room.js';
import { ITEMS, ALL_SLOTS } from './items.js';

const SAVE_KEY = 'agilancer-nights-save-v1';
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function newState() {
  return {
    room: START.room,
    // Bottom-centre of the player, in room pixels.
    x: START.x * TILE + TILE / 2,
    y: START.y * TILE,
    inventory: [],   // item ids, in the order they were found
    equip: {},       // slot id -> item id
    flags: {},       // e.g. opened doors
    collected: {},   // pickup id -> true
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && ROOMS[s.room]) return { ...newState(), ...s };
  } catch (e) { /* no storage (private mode) or bad data */ }
  return null;
}

// Owns the current room, moves the player between rooms and tracks progress.
export class World {
  constructor(player, camera) {
    this.player = player;
    this.camera = camera;
    this.state = loadState() || newState();
    this.messages = [];
    this.fade = 1;          // 1 = black, fades to 0
    this.respawnTimer = 0;
    this.doorNagTimer = 0;
    this.banner = null;     // { text, t } room-name caption
    this.onChange = null;   // called when inventory/equipment changes
    this.applyEquipment();
    this.enter(this.state.room, this.state.x, this.state.y);
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.state = newState();
    this.applyEquipment();
    this.enter(this.state.room, this.state.x, this.state.y);
    this.onChange?.();
  }

  // Load a room and stand the player at (bx, by) = bottom-centre in room px.
  enter(id, bx, by) {
    this.room = new Room(id, ROOMS[id], this.state);
    this.player.spawnAt(bx, by);
    this.player.onMover = null;
    this.entry = { x: bx, y: by };
    this.lastSafe = null;
    this.state.room = id;
    this.state.x = bx;
    this.state.y = by;
    this.camera.follow(this.player, this.room, true);
    this.fade = Math.max(this.fade, 0.6);
    this.banner = { text: this.room.name, t: 0 };
  }

  message(text, time = 2.5) {
    this.messages = [{ text, t: 0, time }];
  }

  has(itemId) {
    return this.state.inventory.includes(itemId);
  }

  giveItem(itemId) {
    if (!this.has(itemId)) this.state.inventory.push(itemId);
    this.onChange?.();
  }

  removeItem(itemId) {
    this.state.inventory = this.state.inventory.filter((i) => i !== itemId);
    for (const k of Object.keys(this.state.equip)) if (this.state.equip[k] === itemId) delete this.state.equip[k];
    this.applyEquipment();
    this.onChange?.();
  }

  // Put an item in a slot (or null to empty it). An item lives in one slot at a time.
  equip(slotId, itemId) {
    const eq = this.state.equip;
    if (itemId) {
      const slot = ALL_SLOTS.find((s) => s.id === slotId);
      if (!slot || ITEMS[itemId]?.type !== slot.accepts) return false;
      for (const k of Object.keys(eq)) if (eq[k] === itemId) delete eq[k];
      eq[slotId] = itemId;
    } else {
      delete eq[slotId];
    }
    this.applyEquipment();
    this.save();
    this.onChange?.();
    return true;
  }

  applyEquipment() {
    const eq = this.state.equip;
    const w = eq.rightHand || eq.leftHand;
    this.player.weapon = w ? ITEMS[w] : null;
  }

  update(dt, input) {
    const p = this.player;
    const room = this.room;
    this.fade = Math.max(0, this.fade - dt * 3);
    this.doorNagTimer = Math.max(0, this.doorNagTimer - dt);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.time);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 2.5) this.banner = null;
    }
    room.update(dt);

    // Hurt by a hazard: fade out, then return to the last safe footing.
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      this.fade = Math.min(1, this.fade + dt * 8);
      if (this.respawnTimer <= 0) {
        const spot = this.lastSafe || this.entry;
        p.spawnAt(spot.x, spot.y);
        p.setState('idle');
        this.camera.follow(p, room, true);
      }
      return;
    }

    p.ride(room);
    p.update(dt, input, room);

    if (room.touchesHazard(p.x, p.y, p.w, p.h)) {
      this.respawnTimer = 0.35;
      return;
    }

    this.trackSafeGround();
    this.checkPickups();
    this.checkDoor();
    this.checkExits();
  }

  // Remember solid footing well away from hazards, for respawning.
  trackSafeGround() {
    const p = this.player, room = this.room;
    if (!p.onGround || p.onMover) return;
    const row = Math.floor((p.y + p.h) / TILE);
    const l = Math.floor(p.x / TILE), r = Math.floor((p.x + p.w - 0.001) / TILE);
    for (let tx = l; tx <= r; tx++) {
      const c = room.get(tx, row);
      if (c !== SOLID && c !== ONE_WAY) return;
    }
    if (room.touchesHazard(p.x - TILE, p.y - 4, p.w + TILE * 2, p.h + TILE)) return;
    this.lastSafe = { x: p.x + p.w / 2, y: p.y + p.h };
  }

  checkPickups() {
    const p = this.player, room = this.room;
    for (const it of room.items) {
      const box = { x: it.px + 4, y: it.py - TILE * 2, w: TILE - 8, h: TILE * 2 };
      if (!overlap(p, box)) continue;
      room.items = room.items.filter((i) => i !== it);
      this.state.collected[it.id] = true;
      this.giveItem(it.item);
      const def = ITEMS[it.item];
      this.message(def.type === 'weapon'
        ? `Obtained ${def.name}!  Equip it from the MENU.`
        : `Obtained ${def.name}!`, 3.5);
      this.save();
    }
  }

  checkDoor() {
    const p = this.player, d = this.room.door;
    if (!d || d.open) return;
    const box = { x: d.tx * TILE - 3, y: d.ty * TILE, w: TILE + 6, h: d.h * TILE };
    if (!overlap(p, box)) return;
    if (this.has(d.key)) {
      this.room.openDoor();
      this.state.flags[d.flag] = true;
      this.removeItem(d.key);
      this.message(`The ${ITEMS[d.key].name} turns in the lock...`, 3);
      this.save();
    } else if (this.doorNagTimer <= 0) {
      this.message('The door is locked.', 2);
      this.doorNagTimer = 3;
    }
  }

  // Leaving the room's rectangle moves us into whichever room is there.
  checkExits() {
    const p = this.player, room = this.room;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    if (cx >= 0 && cx < room.width && cy >= 0 && cy < room.height) return;
    const wx = room.wx * TILE + cx, wy = room.wy * TILE + cy;
    for (const [id, def] of Object.entries(ROOMS)) {
      if (id === room.id) continue;
      const w = def.map[0].length * TILE, h = def.map.length * TILE;
      const rx = wx - def.x * TILE, ry = wy - def.y * TILE;
      if (rx < 0 || ry < 0 || rx >= w || ry >= h) continue;
      const { vx, vy, state, jumping, facing } = p;
      this.enter(id, rx, ry + p.h / 2);
      Object.assign(p, { vx, vy, jumping, facing });
      if (state === 'air') p.setState('air');
      this.save();
      return;
    }
    // Nowhere to go: stay inside.
    p.x = Math.max(0, Math.min(p.x, room.width - p.w));
    p.y = Math.max(0, Math.min(p.y, room.height - p.h));
  }
}
