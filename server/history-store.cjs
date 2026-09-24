// One expiration timer per conversation, with a strict capacity across all keys.
function createHistoryStore({ max = 250, ttlMs, maxMessages, now = Date.now }) {
  const items = new Map();
  function remove(key) {
    const old = items.get(key);
    if (old) clearTimeout(old.timer);
    items.delete(key);
  }
  function get(key) {
    const item = items.get(key);
    if (!item) return [];
    if (item.expires <= now()) { remove(key); return []; }
    return item.messages;
  }
  function set(key, messages) {
    remove(key);
    for (const [id, item] of items) if (item.expires <= now()) remove(id);
    while (items.size >= max) remove(items.keys().next().value);
    const timer = setTimeout(() => remove(key), ttlMs);
    timer.unref?.();
    items.set(key, { messages: messages.slice(-maxMessages), expires: now() + ttlMs, timer });
  }
  return { get, set, delete: remove, clear: () => { for (const key of items.keys()) remove(key); } };
}
module.exports = { createHistoryStore };
