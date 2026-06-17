import { OFFLINE_KEY } from "./constants";

export function saveOfflineCache(userId, fests, notes, checks, slots, dirtyIds, sharedDirty) {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify({
      userId, fests, notes, checks, slots, dirty: [...dirtyIds], sharedDirty: !!sharedDirty, ts: Date.now(),
    }));
  } catch { /* cuota llena u otro error: ignorar */ }
}

export function loadOfflineCache(userId) {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c.userId !== userId) return null;
    return c;
  } catch { return null; }
}
