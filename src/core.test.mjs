import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GOALS, DEFAULT_FOODS, number, calculate, localDate, shiftDate,
  normalizeFood, validateBackup, parseProducts, productUsage, rankFoods, groupMeals,
} from './core.mjs';

const nutrients = { calories: 113, protein: 23.6, fat: 1.9, carbs: 0 };
const food = (changes = {}) => ({ id: 'chicken', name: 'Куриное филе', ...nutrients, ...changes });
const log = (changes = {}) => ({
  id: 'meal-1', foodId: 'chicken', foodName: 'Куриное филе', grams: 150,
  totalCalories: 170, totalProtein: 35.4, totalFat: 2.9, totalCarbs: 0,
  createdAt: '2026-09-20T11:00:00.000Z', ...changes,
});
const backup = (changes = {}) => ({
  version: 10, goals: { ...DEFAULT_GOALS }, foods: [food()],
  dailyLogs: { '2026-09-20': [log()] },
  wellness: { days: { '2026-09-20': { steps: 3000 } } }, ...changes,
});
const macroValues = item => Object.fromEntries(Object.keys(nutrients).map(key => [key, item[key]]));

test('decimal input supports Russian commas but rejects empty, partial and nonnumeric values', () => {
  assert.equal(number(' 100,5 '), 100.5);
  assert.equal(number('0'), 0);
  for (const value of ['', ' ', null, false, [], '12г', '2,5,6', 'Infinity', Infinity]) {
    assert.ok(Number.isNaN(number(value)), String(value));
  }
});

test('fractional portions calculate all four nutrients and keep source food unchanged', () => {
  const original = food();
  assert.deepEqual(calculate(original, '100,5'), { calories: 114, protein: 23.7, fat: 1.9, carbs: 0 });
  assert.deepEqual(original, food());
  assert.throws(() => calculate(original, -1));
  assert.throws(() => calculate({ ...original, protein: undefined }, 100));
});

test('date navigation crosses month, year and leap day in local time', () => {
  assert.equal(localDate(new Date(2026, 8, 20, 0, 1)), '2026-09-20');
  assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDate('2026-09-30', 1), '2026-10-01');
  assert.throws(() => shiftDate('2026-02-29', 1));
  assert.throws(() => shiftDate('2026-09-20', 0.5));
});

test('v10 backup migrates diary totals exactly without using current food nutrition', () => {
  const input = backup({ foods: [food({ calories: 300, protein: 1, fat: 20 })] });
  const saved = structuredClone(input);
  const migrated = validateBackup(input);
  assert.deepEqual(input, saved);
  const entry = migrated.dailyLogs['2026-09-20'][0];
  for (const key of ['totalCalories', 'totalProtein', 'totalFat', 'totalCarbs', 'grams', 'createdAt', 'foodId']) {
    assert.equal(entry[key], input.dailyLogs['2026-09-20'][0][key]);
  }
  assert.equal(entry.nutritionPer100.protein, 35.4 / 150 * 100);
  assert.deepEqual(calculate(entry.nutritionPer100, entry.grams), {
    calories: entry.totalCalories, protein: entry.totalProtein, fat: entry.totalFat, carbs: entry.totalCarbs,
  });
  assert.equal(migrated.foods[0].category, 'meat');
  assert.equal(migrated.foods[0].createdAt, '');
});

test('explicit nutrition snapshots survive repeated backup export/import without drift', () => {
  const input = backup({ dailyLogs: { '2026-09-20': [log({ nutritionPer100: { ...nutrients } })] } });
  const first = validateBackup(input);
  const second = validateBackup(JSON.stringify({ version: 11, ...first }));
  assert.deepEqual(second, first);
  assert.deepEqual(second.dailyLogs['2026-09-20'][0].nutritionPer100, nutrients);
  assert.notEqual(first.dailyLogs['2026-09-20'][0].nutritionPer100, input.dailyLogs['2026-09-20'][0].nutritionPer100);
});

test('deleted products, absent legacy timestamps and empty collections remain valid history', () => {
  const entry = log({ createdAt: undefined });
  const migrated = validateBackup(backup({ foods: [], dailyLogs: { '2026-09-19': [], '2026-09-20': [entry] } }));
  assert.deepEqual(migrated.foods, []);
  assert.deepEqual(migrated.dailyLogs['2026-09-19'], []);
  assert.equal(migrated.dailyLogs['2026-09-20'][0].createdAt, '');
  assert.equal(migrated.dailyLogs['2026-09-20'][0].foodName, 'Куриное филе');
  assert.deepEqual(validateBackup(backup({ foods: [], dailyLogs: {} })).dailyLogs, {});
});

test('invalid backup shapes reject atomically without mutating original input', () => {
  const invalid = [
    { dailyLogs: [] },
    backup({ dailyLogs: [] }),
    backup({ dailyLogs: { '2026-09-20': {} } }),
    backup({ dailyLogs: { '2026-02-30': [] } }),
    backup({ foods: {} }),
    backup({ goals: { ...DEFAULT_GOALS, protein: -5 } }),
    backup({ foods: [food(), food()] }),
    backup({ foods: [food({ protein: 'unknown' })] }),
    backup({ dailyLogs: { '2026-09-20': [log(), log()] } }),
    backup({ dailyLogs: { '2026-09-20': [log({ grams: 0 })] } }),
    backup({ dailyLogs: { '2026-09-20': [log({ totalProtein: undefined })] } }),
    backup({ dailyLogs: { '2026-09-20': [log({ nutritionPer100: { ...nutrients, fat: -1 } })] } }),
  ];
  for (const input of invalid) {
    const before = structuredClone(input);
    assert.throws(() => validateBackup(input));
    assert.deepEqual(input, before);
  }
  assert.throws(() => validateBackup('{bad json'));
});

test('all shipped products pass backup validation with zero nutrient values intact', () => {
  const restored = validateBackup({ goals: DEFAULT_GOALS, foods: DEFAULT_FOODS, dailyLogs: {} });
  assert.equal(restored.foods.length, DEFAULT_FOODS.length);
  assert.equal(restored.foods[0].carbs, 0);
});

test('meal labels survive backups and group nutrients without changing saved food snapshots', () => {
  const state = validateBackup(backup({ dailyLogs: { '2026-09-20': [log({ meal: 'Обед' }), log({ id: 'second', meal: 'обед', grams: 100, totalCalories: 113, totalProtein: 23.6, totalFat: 1.9, totalCarbs: 0 }), log({ id: 'old' })] } }));
  const groups = groupMeals(state.dailyLogs['2026-09-20']);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'Обед');
  assert.equal(groups[0].logs.length, 2);
  assert.equal(groups[0].totals.calories, 283);
  assert.equal(groups[0].totals.protein, 59);
  assert.equal(groups[1].name, 'Без группы');
  assert.deepEqual(validateBackup(JSON.stringify({ version: 12, ...state })), state);
  assert.throws(() => validateBackup(backup({ dailyLogs: { '2026-09-20': [log({ meal: ['Обед'] })] } })));
});

test('category inference distinguishes liver, cookies and honey; explicit categories prevail', () => {
  for (const [name, category] of [
    ['Куриная печень', 'meat'], ['Печенье овсяное', 'sweets'], ['Мёд', 'sweets'],
    ['Гречка варёная', 'grains'], ['Лосось', 'fish'], ['Яблоко', 'fruits'], ['Кефир', 'dairy'],
  ]) assert.equal(normalizeFood(food({ name })).category, category, name);
  assert.equal(normalizeFood(food({ category: 'Готовые блюда' })).category, 'prepared');
  assert.equal(normalizeFood(food({ category: 'Домашнее' })).category, 'Домашнее');
});

test('JSON import accepts nested nutrients, Russian aliases and explanatory fences', () => {
  const input = 'Вот продукты:\n```json\n' + JSON.stringify({ products: [
    { название: 'Куриное филе', per100g: { ккал: '113', белки: '23,6', жиры: 1.9, углеводы: 0 }, категория: 'Мясо и птицы' },
    { title: 'Гречка', nutrition: { kcal: 132, proteins: 4.5, fats: 1.3, carbohydrates: 25 } },
  ] }) + '\n```';
  const result = parseProducts(input);
  assert.equal(result.length, 2);
  assert.deepEqual(macroValues(result[0]), nutrients);
  assert.equal(result[1].category, 'grains');
  assert.notEqual(result[0].id, result[1].id);
});

test('JSON product imports reject the complete batch when any item is invalid', () => {
  assert.throws(() => parseProducts(JSON.stringify([food(), food({ fat: undefined })])), /Продукт 2/);
  assert.throws(() => parseProducts('[]'), /нет продуктов/);
  assert.throws(() => parseProducts('{"foods":[]}'), /нет продуктов/);
  assert.throws(() => parseProducts('{"name":"oops",}'), /JSON/);
});

test('plain text import handles decimals and units without taking numbers from neighboring lines', () => {
  const result = parseProducts('Куриное филе\nНа 100 г\nКкал: 113\nБелки: 23,6г\nЖиры: 1,9 г\nУглеводы: 0 г');
  assert.deepEqual(macroValues(result[0]), nutrients);
  assert.equal(result[0].name, 'Куриное филе');
});

test('text imports accept compact, table and reverse label formats', () => {
  const texts = [
    'Гречка\n132 ккал / Б 4.5 / Ж 1.3 / У 25',
    'Гречка\n| Ккал | 132 |\n| Белки | 4.5 |\n| Жиры | 1.3 |\n| Углеводы | 25 |',
    'Гречка\n132 ккал\n4.5 г белка\n1.3 г жира\n25 г углеводов',
    'Гречка\nНа 100 г\nКкал: ≈132\nБелки: ≈4.5\nЖиры: ≈1.3\nУглеводы: ≈25',
  ];
  for (const text of texts) {
    assert.deepEqual(macroValues(parseProducts(text)[0]), { calories: 132, protein: 4.5, fat: 1.3, carbs: 25 });
  }
  assert.equal(parseProducts('Йогурт [бренд]\nКкал: 100\nБ: 4\nЖ: 3\nУ: 10')[0].name, 'Йогурт [бренд]');
});

test('text import isolates per-100g nutrition from portion values', () => {
  const text = 'Куриное филе\nНа 100 г\nКкал: 113\nБелки: 23.6\nЖиры: 1.9\nУглеводы: 0\nНа 200 г\nКкал: 226\nБелки: 47.2\nЖиры: 3.8\nУглеводы: 0';
  assert.deepEqual(macroValues(parseProducts(text)[0]), nutrients);
  assert.throws(() => parseProducts('Курица\nНа 200 г\nКкал: 226\nБ: 47.2\nЖ: 3.8\nУ: 0'), /на 100 г/);
  assert.throws(() => parseProducts('Курица\nКкал: 113\nБелки: 23.6\nЖиры: 1.9'), /углеводы/);
  assert.throws(() => parseProducts('Курица\nКкал: 113\nКкал: 226\nБ: 23.6\nЖ: 1.9\nУ: 0'), /калории/);
});

test('food search combines case-insensitive words, ё/е normalization and category', () => {
  const foods = [
    normalizeFood(food({ id: '1', name: 'Гречка варёная' })),
    normalizeFood(food({ id: '2', name: 'Гречка сухая' })),
    normalizeFood(food({ id: '3', name: 'Куриное филе' })),
  ];
  assert.deepEqual(rankFoods(foods, {}, { query: 'ВАРЕНАЯ греч', category: 'grains' }).map(item => item.id), ['1']);
  assert.deepEqual(rankFoods(foods, {}, { query: 'греч', category: 'meat' }), []);
});

test('recent foods use creation time and retain legacy insertion order when time is unknown', () => {
  const foods = [
    normalizeFood(food({ id: 'old-newest', name: 'Яблоко' })),
    normalizeFood(food({ id: 'new', createdAt: '2026-09-20T12:00:00.000Z' })),
    normalizeFood(food({ id: 'old-earlier', name: 'Гречка' })),
    normalizeFood(food({ id: 'middle', createdAt: '2026-09-19T12:00:00.000Z' })),
  ];
  assert.deepEqual(rankFoods(foods, {}, { mode: 'recent' }).map(item => item.id), ['new', 'middle', 'old-newest', 'old-earlier']);
  assert.deepEqual(rankFoods(foods, {}, { mode: 'recent', limit: 1 }).map(item => item.id), ['new']);
});

test('frequent foods use actual diary entries and update when a meal is removed', () => {
  const foods = ['chicken', 'rice', 'unused'].map(id => normalizeFood(food({ id, name: id })));
  const dailyLogs = {
    '2026-09-19': [log({ id: '1' }), log({ id: '2', foodId: 'rice' })],
    '2026-09-20': [log({ id: '3', foodId: 'rice' }), log({ id: '4', foodId: 'deleted' })],
  };
  assert.equal(productUsage(dailyLogs).rice.count, 2);
  assert.deepEqual(rankFoods(foods, dailyLogs, { mode: 'frequent' }).map(item => item.id), ['rice', 'chicken']);
  dailyLogs['2026-09-19'] = dailyLogs['2026-09-19'].filter(item => item.foodId !== 'rice');
  dailyLogs['2026-09-20'] = dailyLogs['2026-09-20'].filter(item => item.foodId !== 'rice');
  assert.deepEqual(rankFoods(foods, dailyLogs, { mode: 'frequent' }).map(item => item.id), ['chicken']);
});
