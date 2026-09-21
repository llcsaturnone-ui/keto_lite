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

test('a meal is atomic on validation and storage failure and survives later edits', () => {
  const storage = memory(), store = createStore(storage), date = '2026-09-20';
  const log = id => ({ id, foodId: id, foodName: id, grams: 100,
    totalCalories: 100, totalProtein: 10, totalFat: 2, totalCarbs: 4,
    nutritionPer100: { calories: 100, protein: 10, fat: 2, carbs: 4 } });
  const before = store.read();
  assert.throws(() => store.commit('logs', { date, logs: [log('A'), { ...log('B'), grams: 0 }] }));
  assert.deepEqual(store.read(), before);
  const original = storage.setItem;
  storage.setItem = (key, value) => { if (key.startsWith(EVENT_PREFIX)) throw new Error('quota'); original(key, value); };
  assert.throws(() => store.commit('logs', { date, logs: [log('A'), log('B')] }), /не применено/);
  assert.deepEqual(store.read(), before);
  storage.setItem = original;
  store.commit('logs', { date, logs: [log('A'), log('B')] });
  const anotherTab = createStore(storage);
  anotherTab.commit('log', { date, log: { ...log('A'), grams: 150, totalCalories: 150, totalProtein: 15, totalFat: 3, totalCarbs: 6 } });
  assert.deepEqual(store.read().dailyLogs[date].map(item => [item.id, item.grams]), [['A', 150], ['B', 100]]);
  anotherTab.commit('deleteLog', { date, id: 'B' });
  assert.equal(store.read().dailyLogs[date].length, 1);
});

test('measurement patches from different tabs and days preserve untouched metrics, foods and goals', () => {
  const storage = memory(), a = createStore(storage), b = createStore(storage);
  const original = a.read();
  a.commit('measurement', { date: '2026-09-21', patch: { weight: 93.1, waist: 105 } });
  b.commit('measurement', { date: '2026-09-21', patch: { muscleMass: 62.9 } });
  a.commit('measurement', { date: '2026-09-21', patch: { weight: 93, waist: null } });
  b.commit('measurement', { date: '2026-09-20', patch: { weight: 93.4 } });
  assert.deepEqual(a.read().measurements, { '2026-09-21': { weight: 93, muscleMass: 62.9 }, '2026-09-20': { weight: 93.4 } });
  assert.deepEqual(a.read().foods, original.foods);
  assert.deepEqual(a.read().goals, original.goals);
  a.commit('deleteMeasurement', { date: '2026-09-21' });
  assert.deepEqual(b.read().measurements, { '2026-09-20': { weight: 93.4 } });
});

test('favorites survive product edits and reload, and deletion cleans favorites without changing meals', () => {
  const storage = memory(), store = createStore(storage);
  store.commit('foods', [food('A')]);
  store.commit('favorite', { id: 'A', enabled: true });
  store.commit('foods', [{ ...food('A'), name: 'Новое название' }]);
  assert.deepEqual(createStore(storage).read().favorites, ['A']);
  store.commit('deleteFood', { id: 'A' });
  assert.deepEqual(store.read().favorites, []);
  assert.throws(() => store.commit('favorite', { id: 'A', enabled: true }));
});

test('invalid and failed measurement saves leave all previous records intact', () => {
  const storage = memory(), store = createStore(storage);
  store.commit('measurement', { date: '2026-09-21', patch: { weight: 93.1 } });
  const before = store.read(), count = storage.length;
  assert.throws(() => store.commit('measurement', { date: '2026-09-21', patch: { weight: 92, fatPercent: 101 } }));
  assert.throws(() => store.commit('measurement', { date: '2026-02-30', patch: { weight: 92 } }));
  assert.equal(storage.length, count);
  assert.deepEqual(store.read(), before);
  const original = storage.setItem;
  storage.setItem = (key, value) => { if (key.startsWith(EVENT_PREFIX)) throw new Error('quota'); original(key, value); };
  assert.throws(() => store.commit('measurement', { date: '2026-09-21', patch: { weight: 92 } }), /не применено/);
  assert.deepEqual(store.read(), before);
});
