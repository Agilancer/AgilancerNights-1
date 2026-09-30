// Pause menu: Equip / Items / Relics / Map tabs.
import { ITEMS, SLOTS, RELICS, PASSIVE_COUNT, TYPE_LABEL, getIcon, xpToNext, spellDamage, rarityColor, describeBonus } from './items.js';
import { ROOMS } from './rooms.js';
import { ZONES } from './zones.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const iconURL = {};
function iconImg(id) {
  if (!iconURL[id]) iconURL[id] = getIcon(id).toDataURL();
  const img = el('img', 'icon');
  img.src = iconURL[id];
  img.alt = '';
  return img;
}
const ACCEPTS = Object.fromEntries(SLOTS.map((s) => [s.id, s.accepts]));
const ZONE_COLORS = ['#6a6a90', '#8a88c8', '#6aa0d8', '#b89a60', '#9a8a70', '#8aa0b0', '#4aa0a0', '#e06a30', '#d04a6a', '#8a50e0'];

export class Menu {
  constructor(root, world) {
    this.root = root;
    this.world = world;
    this.isOpen = false;
    this.tab = 'equip';
    this.selSlot = 'rightHand';
    this.selItem = null;
    this.filter = 'all';
    this.map = { zoom: 0.7, ox: 0, oy: 0 };
    this.q = (s) => root.querySelector(s);
    this.q('#menu-close').addEventListener('click', () => this.close());
    for (const b of root.querySelectorAll('.tab')) b.addEventListener('click', () => { this.tab = b.dataset.tab; this.selItem = null; this.render(); });
    this.onQuit = null;
    world.onChange = () => { if (this.isOpen) this.render(); };
    this.setupMap();
  }

  open() {
    this.isOpen = true;
    this.selItem = null;
    this.centerMap();
    this.render();
    this.root.classList.remove('hidden');
  }
  close() { this.isOpen = false; this.root.classList.add('hidden'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }

  render() {
    for (const b of this.root.querySelectorAll('.tab')) b.classList.toggle('on', b.dataset.tab === this.tab);
    for (const p of this.root.querySelectorAll('.page')) p.classList.toggle('hidden', p.dataset.page !== this.tab);
    this.renderStats();
    if (this.tab === 'equip') this.renderEquip();
    if (this.tab === 'items') this.renderItems();
    if (this.tab === 'relics') this.renderRelics();
    if (this.tab === 'map') this.drawMap();
  }

  renderStats() {
    const p = this.world.player, st = this.world.state;
    const stats = this.q('.menu-stats');
    stats.replaceChildren();
    const rows = [['LV', p.level], ['HP', `${Math.ceil(p.hp)}/${p.maxHp}`], ['MP', `${Math.floor(p.mp)}/${p.maxMp}`],
      ['ATK', p.atk], ['DEF', p.mods.def], ['NEXT', `${xpToNext(p.level) - p.xp}`], ['ROOMS', `${Object.keys(st.visited).length}/${Object.keys(ROOMS).length}`]];
    for (const [k, v] of rows) {
      const s = el('div', 'stat');
      s.append(el('span', 'stat-k', k), el('span', 'stat-v', String(v)));
      stats.append(s);
    }
  }

  // A short power line for an item: ATK / DEF / DMG and how it compares.
  power(it, slot) {
    const p = this.world.player;
    if (it.type === 'weapon') {
      const now = slot ? ITEMS[this.world.state.equip[slot]] : p.weapon;
      const a = p.weaponDamage(it), b = p.weaponDamage(now);
      return { text: `ATK ${a}`, diff: a - b };
    }
    if (it.type === 'head' || it.type === 'body') {
      const cur = ITEMS[this.world.state.equip[it.type]];
      const a = it.bonus?.def || 0, b = cur?.bonus?.def || 0;
      return { text: `DEF ${a}`, diff: a - b };
    }
    if (it.type === 'spell') return { text: `${spellDamage(it, p.level, p.mods.spell)} dmg · ${it.mp} MP`, diff: 0 };
    return { text: '', diff: 0 };
  }

  itemRow(id, onClick, opts = {}) {
    const it = ITEMS[id];
    const b = el('button', 'item');
    b.type = 'button';
    if (this.selItem === id) b.classList.add('selected');
    const name = el('span', 'item-name', it.name);
    name.style.color = rarityColor(it);
    b.append(iconImg(id), name);
    const n = this.world.count(id);
    if (n > 1) b.append(el('span', 'item-count', `x${n}`));
    const pw = this.power(it, opts.slot);
    if (pw.text) {
      const s = el('span', 'item-pow', pw.text);
      if (pw.diff) { const d = el('span', pw.diff > 0 ? 'up' : 'down', ` ${pw.diff > 0 ? '▲' : '▼'}${Math.abs(pw.diff)}`); s.append(d); }
      b.append(s);
    }
    const eq = Object.entries(this.world.state.equip).filter(([, v]) => v === id).map(([k]) => SLOTS.find((s) => s.id === k).label);
    if (eq.length) b.append(el('span', 'item-eq', eq.join(' / ')));
    b.addEventListener('click', onClick);
    return b;
  }

  detail(id, actions) {
    const d = this.q(`.page[data-page="${this.tab}"] .menu-detail`);
    d.replaceChildren();
    if (!id) { d.append(el('div', 'detail-hint', this.tab === 'equip' ? 'Choose a slot, then an item from the list.' : 'Tap an item to read about it.')); return; }
    const it = ITEMS[id];
    const t = el('div', 'detail-title', it.name);
    t.style.color = rarityColor(it);
    d.append(t);
    const extra = [];
    if (it.type === 'weapon') {
      extra.push(`ATK ${this.world.player.weaponDamage(it)}`);
      if (it.element) extra.push(`${it.element[0].toUpperCase()}${it.element.slice(1)} element`);
    }
    if (it.bonus) extra.push(describeBonus(it.bonus).replace(/\.$/, ''));
    d.append(el('div', 'detail-sub', `${TYPE_LABEL[it.type] || ''}${extra.length ? ' · ' + extra.join(' · ') : ''}`));
    d.append(el('div', 'detail-text', it.type === 'weapon' || !it.bonus ? it.desc : ''));
    const row = el('div', 'detail-actions');
    for (const [label, fn, cls] of actions || []) {
      const b = el('button', `detail-btn ${cls || ''}`, label);
      b.type = 'button';
      b.addEventListener('click', fn);
      row.append(b);
    }
    d.append(row);
  }

  renderEquip() {
    const st = this.world.state;
    const slots = this.q('.menu-slots');
    slots.replaceChildren();
    for (const s of SLOTS) {
      const b = el('button', 'slot');
      b.type = 'button';
      if (this.selSlot === s.id) b.classList.add('selected');
      b.append(el('span', 'slot-label', s.label));
      const v = el('span', 'slot-item');
      const id = st.equip[s.id];
      if (id) { const n = el('span', '', ITEMS[id].name); n.style.color = rarityColor(ITEMS[id]); v.append(iconImg(id), n); }
      else { v.textContent = '—'; b.classList.add('empty'); }
      b.append(v);
      b.addEventListener('click', () => { this.selSlot = s.id; this.selItem = null; this.render(); });
      slots.append(b);
    }
    const accepts = ACCEPTS[this.selSlot];
    const list = this.q('.equip-list');
    list.replaceChildren();
    const ids = Object.keys(st.inventory).filter((id) => ITEMS[id]?.type === accepts)
      .sort((a, b) => (ITEMS[b].tier - ITEMS[a].tier) || ITEMS[a].name.localeCompare(ITEMS[b].name));
    this.q('.equip-title').textContent = `${SLOTS.find((s) => s.id === this.selSlot).label} — ${TYPE_LABEL[accepts]}s (${ids.length})`;
    if (!ids.length) list.append(el('li', 'none', 'Nothing that fits here yet.'));
    for (const id of ids) {
      const li = el('li');
      li.append(this.itemRow(id, () => { this.selItem = id; this.render(); }, { slot: this.selSlot }));
      list.append(li);
    }
    const cur = st.equip[this.selSlot];
    const acts = [];
    if (this.selItem && cur !== this.selItem) acts.push(['Equip', () => { this.world.equip(this.selSlot, this.selItem); this.selItem = null; this.render(); }, 'go']);
    if (cur) acts.push(['Remove', () => { this.world.equip(this.selSlot, null); this.render(); }]);
    this.detail(this.selItem || cur, acts);
  }

  renderItems() {
    const st = this.world.state;
    const chips = this.q('.item-filters');
    chips.replaceChildren();
    const cats = [['all', 'All'], ['weapon', 'Weapons'], ['head', 'Head'], ['body', 'Body'], ['charm', 'Charms'], ['spell', 'Spells'], ['key', 'Keys']];
    for (const [k, label] of cats) {
      const n = Object.keys(st.inventory).filter((id) => k === 'all' || ITEMS[id]?.type === k).length;
      const b = el('button', `chip${this.filter === k ? ' on' : ''}`, `${label} ${n}`);
      b.type = 'button';
      b.addEventListener('click', () => { this.filter = k; this.render(); });
      chips.append(b);
    }
    const list = this.q('.item-list');
    list.replaceChildren();
    const ids = Object.keys(st.inventory).filter((id) => ITEMS[id] && (this.filter === 'all' || ITEMS[id].type === this.filter))
      .sort((a, b) => ITEMS[a].type.localeCompare(ITEMS[b].type) || (ITEMS[b].tier - ITEMS[a].tier));
    if (!ids.length) list.append(el('li', 'none', 'No items yet.'));
    for (const id of ids) {
      const li = el('li');
      li.append(this.itemRow(id, () => { this.selItem = id; this.render(); }));
      list.append(li);
    }
    const it = ITEMS[this.selItem];
    const acts = [];
    if (it) {
      const slot = SLOTS.find((s) => s.accepts === it.type && !st.equip[s.id]) || SLOTS.find((s) => s.accepts === it.type);
      if (slot) acts.push([`Equip (${slot.label})`, () => { this.world.equip(slot.id, this.selItem); this.render(); }, 'go']);
    }
    this.detail(this.selItem, acts);
    const found = Object.keys(st.inventory).length;
    this.q('.item-count-total').textContent = `${found} kinds of item found · ${Object.keys(ITEMS).length} exist`;
  }

  renderRelics() {
    const st = this.world.state;
    const grid = this.q('.relic-grid');
    grid.replaceChildren();
    for (let i = 0; i < PASSIVE_COUNT; i++) {
      const id = st.relics[i];
      const cell = el('div', `relic${id ? '' : ' empty'}`);
      if (id) {
        const it = ITEMS[id];
        cell.append(iconImg(id), el('div', 'relic-name', it.name), el('div', 'relic-desc', it.desc));
      } else {
        cell.append(el('div', 'relic-q', '?'), el('div', 'relic-name', `Passive ${i + 1}`), el('div', 'relic-desc', 'Not yet found.'));
      }
      grid.append(cell);
    }
    this.q('.relic-count').textContent = `${st.relics.length} of ${RELICS.length} relics found. Relics are always active once found.`;
  }

  // ---------- map ----------
  setupMap() {
    const c = this.q('#map-canvas');
    let drag = null;
    const down = (x, y) => { drag = { x, y, ox: this.map.ox, oy: this.map.oy }; };
    const move = (x, y) => { if (!drag) return; this.map.ox = drag.ox + (x - drag.x); this.map.oy = drag.oy + (y - drag.y); this.drawMap(); };
    c.addEventListener('touchstart', (e) => { const t = e.touches[0]; down(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
    c.addEventListener('touchmove', (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
    c.addEventListener('touchend', () => { drag = null; });
    c.addEventListener('mousedown', (e) => down(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => { drag = null; });
    this.q('#map-in').addEventListener('click', () => { this.zoomMap(1.4); });
    this.q('#map-out').addEventListener('click', () => { this.zoomMap(1 / 1.4); });
    this.q('#map-here').addEventListener('click', () => { this.centerMap(); this.drawMap(); });
  }

  zoomMap(f) {
    const z0 = this.map.zoom, z1 = Math.max(0.2, Math.min(3, z0 * f));
    this.map.ox *= z1 / z0; this.map.oy *= z1 / z0; this.map.zoom = z1;
    this.drawMap();
  }

  centerMap() {
    const r = ROOMS[this.world.room.id];
    this.map.cx = r.x + r.map[0].length / 2;
    this.map.cy = r.y + r.map.length / 2;
    this.map.ox = 0; this.map.oy = 0;
  }

  drawMap() {
    const c = this.q('#map-canvas');
    const box = c.getBoundingClientRect();
    if (!box.width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(box.width * dpr); c.height = Math.round(box.height * dpr);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#07040e'; x.fillRect(0, 0, box.width, box.height);
    const st = this.world.state;
    const seer = st.relics.includes('seer_eye');
    const z = this.map.zoom;
    const tx = (wx) => box.width / 2 + this.map.ox + (wx - this.map.cx) * z;
    const ty = (wy) => box.height / 2 + this.map.oy + (wy - this.map.cy) * z;
    const now = performance.now() / 1000;
    for (const [id, r] of Object.entries(ROOMS)) {
      const seen = st.visited[id];
      if (!seen && !seer) continue;
      const w = r.map[0].length, h = r.map.length;
      const X = tx(r.x), Y = ty(r.y), Wd = w * z, Hd = h * z;
      if (X > box.width || Y > box.height || X + Wd < 0 || Y + Hd < 0) continue;
      const col = ZONE_COLORS[r.zone || 0];
      x.fillStyle = seen ? col : 'rgba(80,80,110,0.35)';
      x.globalAlpha = seen ? 0.85 : 1;
      x.fillRect(X + 0.5, Y + 0.5, Wd - 1, Hd - 1);
      x.globalAlpha = 1;
      x.strokeStyle = seen ? '#e8e0ff' : 'rgba(160,160,200,0.4)';
      x.lineWidth = 1;
      x.strokeRect(X + 0.5, Y + 0.5, Wd - 1, Hd - 1);
      if (r.boss && !st.flags[`boss_${r.boss.id}`] && (seen || seer)) {
        x.fillStyle = '#ff3040'; x.beginPath(); x.arc(X + Wd / 2, Y + Hd / 2, Math.max(2, z * 2.5), 0, Math.PI * 2); x.fill();
      }
      if (seer || seen) {
        for (const ch of r.chests || []) {
          if (st.collected[ch.id]) continue;
          if (!seer && !seen) continue;
          x.fillStyle = ch.rare ? '#e070ff' : '#ffd050';
          x.fillRect(X + ch.x * z - 1.5, Y + ch.y * z - 2, 3, 3);
        }
      }
      if (id === this.world.room.id) {
        const p = this.world.player;
        x.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(now * 6)})`;
        x.lineWidth = 2;
        x.strokeRect(X - 1, Y - 1, Wd + 2, Hd + 2);
        x.fillStyle = '#ffffff';
        x.beginPath(); x.arc(X + (p.x + p.w / 2) / 32 * z, Y + (p.y + p.h / 2) / 32 * z, Math.max(2, z * 1.6), 0, Math.PI * 2); x.fill();
      }
    }
    x.fillStyle = '#c9a24a';
    x.font = '12px Georgia, serif';
    const zn = ZONES[this.world.room.zone];
    x.fillText(`${zn.name}${this.world.room.zone ? '' : ''} — ${this.world.room.name}`, 10, 18);
    if (!seer) { x.fillStyle = '#7a6a9a'; x.fillText("Unexplored rooms stay dark. (The Seer's Eye reveals them.)", 10, box.height - 10); }
    if (this.isOpen && this.tab === 'map') requestAnimationFrame(() => { if (this.isOpen && this.tab === 'map') this.drawMap(); });
  }
}
