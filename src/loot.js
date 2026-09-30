// Loot tables: what enemies drop and what chests hold, by tier (0-10).
import { ITEMS } from './items.js';

const DROPPABLE = new Set(['weapon', 'head', 'body', 'charm']);
const byTier = [];
for (const it of Object.values(ITEMS)) {
  if (!DROPPABLE.has(it.type) || it.legendary || it.tier >= 10) continue;
  (byTier[it.tier] ||= []).push(it.id);
}

// A random droppable item around `tier`: mostly that tier, sometimes one below
// or above. `rand` is a 0..1 function (Math.random at runtime, seeded in tools).
export function rollItem(tier, rand = Math.random) {
  const r = rand();
  const t = Math.max(0, Math.min(9, tier + (r < 0.2 ? -1 : r > 0.9 ? 1 : 0)));
  const pool = byTier[t] || byTier[0];
  return pool[Math.floor(rand() * pool.length)];
}
