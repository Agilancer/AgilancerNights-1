import { ITEMS, SLOTS, PASSIVE_SLOTS, ALL_SLOTS, BASE_ATK, getIcon } from './items.js';

const TYPE_LABEL = {
  weapon: 'Weapon', spell: 'Spell', head: 'Head armor', body: 'Chest armor',
  charm: 'Charm', passive: 'Passive', key: 'Key item',
};

const iconURL = {};
function iconImg(name) {
  if (!iconURL[name]) iconURL[name] = getIcon(name).toDataURL();
  const img = document.createElement('img');
  img.className = 'icon';
  img.src = iconURL[name];
  img.alt = '';
  return img;
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// Equipment / inventory screen. Tap a slot then an item (or an item then a
// slot) to equip; the detail box offers "Remove" for a filled slot.
export class Menu {
  constructor(root, world) {
    this.root = root;
    this.world = world;
    this.isOpen = false;
    this.selSlot = null;
    this.selItem = null;
    this.q = (s) => root.querySelector(s);
    this.q('#menu-close').addEventListener('click', () => this.close());
    this.q('#menu-reset').addEventListener('click', () => {
      if (confirm('Start a new game? Your progress will be lost.')) {
        this.world.reset();
        this.close();
      }
    });
    world.onChange = () => { if (this.isOpen) this.render(); };
  }

  open() {
    this.isOpen = true;
    this.selSlot = this.selItem = null;
    this.render();
    this.root.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) this.close(); else this.open();
  }

  fits(itemId, slotId) {
    const slot = ALL_SLOTS.find((s) => s.id === slotId);
    return !!slot && ITEMS[itemId]?.type === slot.accepts;
  }

  pickSlot(id) {
    if (this.selItem && this.fits(this.selItem, id)) {
      this.world.equip(id, this.selItem);
      this.selItem = this.selSlot = null;
    } else {
      this.selSlot = this.selSlot === id ? null : id;
      this.selItem = null;
    }
    this.render();
  }

  pickItem(id) {
    if (this.selSlot && this.fits(id, this.selSlot)) {
      this.world.equip(this.selSlot, id);
      this.selItem = this.selSlot = null;
    } else {
      this.selItem = this.selItem === id ? null : id;
      this.selSlot = null;
    }
    this.render();
  }

  slotButton(slot, small) {
    const st = this.world.state;
    const itemId = st.equip[slot.id];
    const b = el('button', small ? 'slot small' : 'slot');
    b.type = 'button';
    if (this.selSlot === slot.id) b.classList.add('selected');
    if (this.selItem && this.fits(this.selItem, slot.id)) b.classList.add('target');
    b.append(el('span', 'slot-label', slot.label));
    const v = el('span', 'slot-item');
    if (itemId) {
      v.append(iconImg(ITEMS[itemId].icon), document.createTextNode(ITEMS[itemId].name));
    } else {
      v.textContent = '—';
      b.classList.add('empty');
    }
    b.append(v);
    b.addEventListener('click', () => this.pickSlot(slot.id));
    return b;
  }

  render() {
    const st = this.world.state;
    const eq = st.equip;

    // Stats.
    const stats = this.q('.menu-stats');
    stats.replaceChildren();
    const handAtk = (id) => BASE_ATK + (eq[id] ? ITEMS[eq[id]].atk || 0 : 0);
    for (const [k, v] of [['ATK', this.world.player.atk], ['R', handAtk('rightHand')], ['L', handAtk('leftHand')], ['DEF', 0]]) {
      const s = el('div', 'stat');
      s.append(el('span', 'stat-k', k), el('span', 'stat-v', String(v)));
      stats.append(s);
    }

    // Main slots and passives.
    const slots = this.q('.menu-slots');
    slots.replaceChildren(...SLOTS.map((s) => this.slotButton(s)));
    const pas = this.q('.menu-passives');
    pas.replaceChildren(...PASSIVE_SLOTS.map((s) => this.slotButton(s, true)));

    // Inventory.
    const inv = this.q('.menu-inventory');
    inv.replaceChildren();
    if (!st.inventory.length) inv.append(el('li', 'none', 'No items yet.'));
    for (const id of st.inventory) {
      const def = ITEMS[id];
      const li = el('li');
      const b = el('button', 'item');
      b.type = 'button';
      if (this.selItem === id) b.classList.add('selected');
      if (this.selSlot && !this.fits(id, this.selSlot)) b.classList.add('dim');
      const where = Object.keys(eq).find((k) => eq[k] === id);
      b.append(iconImg(def.icon), el('span', 'item-name', def.name), el('span', 'item-type', TYPE_LABEL[def.type] || ''));
      if (where) b.append(el('span', 'item-eq', ALL_SLOTS.find((s) => s.id === where).label));
      b.addEventListener('click', () => this.pickItem(id));
      li.append(b);
      inv.append(li);
    }

    // Detail / help box.
    const d = this.q('.menu-detail');
    d.replaceChildren();
    if (this.selItem) {
      const def = ITEMS[this.selItem];
      d.append(el('div', 'detail-title', def.name), el('div', 'detail-text', def.desc));
      const can = ALL_SLOTS.some((s) => this.fits(this.selItem, s.id));
      d.append(el('div', 'detail-hint', can ? 'Now tap a highlighted slot to equip it.' : 'This item cannot be equipped.'));
    } else if (this.selSlot) {
      const slot = ALL_SLOTS.find((s) => s.id === this.selSlot);
      const cur = eq[slot.id];
      d.append(el('div', 'detail-title', `${slot.label}${cur ? ': ' + ITEMS[cur].name : ''}`));
      d.append(el('div', 'detail-text', cur ? ITEMS[cur].desc : `Empty. Accepts: ${TYPE_LABEL[slot.accepts]}.`));
      const has = st.inventory.some((i) => this.fits(i, slot.id));
      d.append(el('div', 'detail-hint', has ? 'Tap an item below to put it here.' : 'You have nothing that fits here yet.'));
      if (cur) {
        const rm = el('button', 'detail-btn', 'Remove');
        rm.type = 'button';
        rm.addEventListener('click', () => { this.world.equip(slot.id, null); this.selSlot = null; this.render(); });
        d.append(rm);
      }
    } else {
      d.append(el('div', 'detail-hint', 'Tap a slot or an item.'));
    }
  }
}
