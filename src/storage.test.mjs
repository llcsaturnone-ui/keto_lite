import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, BASE_KEY, EVENT_PREFIX } from './storage.mjs';
function memory() {
  const values = new Map();
  return { get length() { return values.size; }, key: i => [...values.keys()][i], getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
}
const food = id => ({ id, name: id, category: 'other', calories: 100, protein: 10, fat: 2, carbs: 4, createdAt: '2026-09-20T10:00:00.000Z' });
test('two tabs add products without losing either change', () => {
  const storage = memory(), a = createStore(storage), b = createStore(storage);
  a.read(); b.read();
  a.commit('foods', [food('A')]); b.commit('foods', [food('B')]);
  assert.ok(a.read().foods.some(f => f.id === 'A'));
  assert.ok(a.read().foods.some(f => f.id === 'B'));
});
test('migration keeps legacy bytes and valid empty product list', () => {
  const storage = memory(); storage.setItem('diet_foods_v2', '[]');
  const store = createStore(storage); assert.deepEqual(store.read().foods, []);
  store.commit('goals', { calories: 1900, protein: 100, fat: 60, carbs: 200 });
  assert.equal(storage.getItem('diet_foods_v2'), '[]');
  assert.ok(storage.getItem(BASE_KEY));
});
test('invalid imported backup leaves stored history unchanged', () => {
  const storage = memory(), store = createStore(storage);
  store.commit('foods', [food('A')]); const before = store.read(); const keys = storage.length;
  assert.throws(() => store.commit('replace', { ...before, dailyLogs: [] }));
  assert.deepEqual(store.read(), before); assert.equal(storage.length, keys);
});
test('invalid legacy JSON is never silently overwritten', () => {
  const storage = memory(); storage.setItem('diet_logs_v2', '{bad');
  assert.throws(() => createStore(storage).read());
  assert.equal(storage.getItem('diet_logs_v2'), '{bad'); assert.equal(storage.getItem(BASE_KEY), null);
});
test('quota failure does not pretend an edit was saved', () => {
  const storage = memory(), store = createStore(storage); const original = storage.setItem;
  storage.setItem = (k, v) => { if (k.startsWith(EVENT_PREFIX)) throw new Error('quota'); original(k, v); };
  assert.throws(() => store.commit('foods', [food('A')]), /не применено/);
  assert.ok(!store.read().foods.some(f => f.id === 'A'));
});
