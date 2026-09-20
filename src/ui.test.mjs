import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { DEFAULT_GOALS } from './core.mjs';
import { BASE_KEY, EVENT_PREFIX, createStore } from './storage.mjs';

// These tests execute the real React application. JSDOM does not provide layout
// or a native dialog top layer, so they verify behavior rather than appearance.
const bundle = await build({
  entryPoints: [new URL('./App.jsx', import.meta.url).pathname],
  bundle: true, write: false, format: 'iife', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const source = bundle.outputFiles[0].text;
const pause = () => new Promise(resolve => setTimeout(resolve, 12));
const food = (id, name, changes = {}) => ({
  id, name, category: 'other', calories: 100, protein: 10, fat: 2, carbs: 4,
  createdAt: '', ...changes,
});
const meal = (id, product, changes = {}) => ({
  id, foodId: product.id, foodName: product.name, grams: 100,
  totalCalories: product.calories, totalProtein: product.protein,
  totalFat: product.fat, totalCarbs: product.carbs,
  createdAt: '2026-09-20T12:00:00.000Z', ...changes,
});
const data = (foods = [], dailyLogs = {}) => ({ goals: { ...DEFAULT_GOALS }, foods, dailyLogs });

async function mount(t, { initial = data(), storageEntries } = {}) {
  const failures = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => failures.push(error.message));
  virtualConsole.on('error', (...args) => failures.push(args.join(' ')));
  const dom = new JSDOM('<!doctype html><html lang="ru"><body><div id="root"></div></body></html>', {
    url: 'https://nutrition.test/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole,
  });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  if (storageEntries) {
    for (const [key, value] of storageEntries) window.localStorage.setItem(key, value);
  } else {
    window.localStorage.setItem(BASE_KEY, JSON.stringify(initial));
  }
  t.after(() => {
    dom.window.close();
    assert.deepEqual(failures, [], 'Application must not emit runtime errors');
  });
  window.eval(source);
  await pause();
  const document = window.document;
  const query = (selector, scope = document) => {
    const element = scope.querySelector(selector);
    assert.ok(element, `Element not found: ${selector}`);
    return element;
  };
  const button = (label, scope = document) => {
    const candidates = [...scope.querySelectorAll('button')];
    const element = candidates.find(candidate => {
      const name = candidate.getAttribute('aria-label') || candidate.textContent.trim();
      return typeof label === 'string' ? name === label : label.test(name);
    });
    assert.ok(element, `Button not found: ${label}`);
    return element;
  };
  const click = async element => { element.click(); await pause(); };
  const input = async (element, value) => {
    const prototype = element instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype
      : element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    await pause();
  };
  const submit = async form => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await pause();
  };
  const topDialog = () => [...document.querySelectorAll('dialog[open]')].at(-1);
  const state = () => createStore(window.localStorage).read();
  const rows = (scope = document.querySelector('main')) => [...scope.querySelectorAll('.food-title')].map(node => node.textContent);
  return { window, document, query, button, click, input, submit, topDialog, state, rows };
}

test('the application exposes only the diary and settings, with four daily nutrients', async t => {
  const ui = await mount(t);
  assert.equal(ui.query('h1').textContent, 'Дневник');
  assert.equal(ui.document.querySelectorAll('.macro-card').length, 4);
  assert.equal(ui.document.querySelectorAll('nav, [role="tablist"]').length, 0);
  for (const title of ['Дела', 'Намаз', 'Тренировки', 'База']) {
    assert.ok(![...ui.document.querySelectorAll('button, h1, h2, h3')].some(node => node.textContent.trim() === title));
  }
  await ui.click(ui.button(/Настройки/));
  const modal = ui.topDialog();
  assert.equal(modal.querySelector('h2').textContent, 'Настройки');
  assert.deepEqual([...modal.querySelectorAll('h3')].map(node => node.textContent), ['Дневные цели', 'Мои продукты', 'Резервная копия']);
});

test('product CRUD, decimal meals and date navigation preserve saved diary snapshots', async t => {
  const ui = await mount(t);
  await ui.click(ui.button(/Настройки/));
  await ui.click(ui.button(/Управлять продуктами/, ui.topDialog()));
  await ui.click(ui.button(/Новый продукт/, ui.topDialog()));
  await ui.input(ui.query('input[placeholder="Например, творог 5%"]', ui.topDialog()), 'Йогурт домашний');
  await ui.input(ui.query('select', ui.topDialog()), 'dairy');
  for (const [key, value] of Object.entries({ calories: '88,5', protein: '5,2', fat: '3,4', carbs: '7,1' })) {
    await ui.input(ui.query(`#food-${key}`), value);
  }
  await ui.submit(ui.query('form', ui.topDialog()));
  let product = ui.state().foods[0];
  assert.equal(product.name, 'Йогурт домашний');
  assert.equal(product.protein, 5.2);
  assert.equal(product.category, 'dairy');
  const originalId = product.id, createdAt = product.createdAt;

  await ui.click(ui.button('Редактировать Йогурт домашний', ui.topDialog()));
  await ui.input(ui.query('input[placeholder="Например, творог 5%"]', ui.topDialog()), 'Йогурт натуральный');
  await ui.input(ui.query('#food-calories'), '92,5');
  await ui.submit(ui.query('form', ui.topDialog()));
  product = ui.state().foods[0];
  assert.equal(product.name, 'Йогурт натуральный');
  assert.equal(product.id, originalId);
  assert.equal(product.createdAt, createdAt);
  assert.equal(ui.state().foods.length, 1);
  await ui.click(ui.button('Закрыть', ui.topDialog()));

  await ui.click(ui.query('.product-picker-toggle'));
  await ui.click(ui.query('.food-select'));
  await ui.input(ui.query('.portion-form input'), '150,5');
  assert.match(ui.query('.portion-preview').textContent, /139 ккал/);
  await ui.submit(ui.query('.portion-form'));
  const day = ui.query('input[type="date"]').value;
  const saved = ui.state().dailyLogs[day][0];
  assert.equal(saved.grams, 150.5);
  assert.equal(saved.totalCalories, 139);
  assert.equal(saved.totalProtein, 7.8);
  assert.equal(saved.totalFat, 5.1);
  assert.equal(saved.totalCarbs, 10.7);
  assert.equal(saved.nutritionPer100.calories, 92.5);
  assert.match(ui.query('.diary-row').textContent, /150,5 г/);
  await ui.click(ui.button('Предыдущий день'));
  assert.equal(ui.document.querySelectorAll('.diary-row').length, 0);
  await ui.click(ui.button('Следующий день'));
  assert.equal(ui.query('input[type="date"]').value, day);
  assert.equal(ui.document.querySelectorAll('.diary-row').length, 1);

  await ui.click(ui.button(/Настройки/));
  await ui.click(ui.button(/Управлять продуктами/, ui.topDialog()));
  await ui.click(ui.button('Редактировать Йогурт натуральный', ui.topDialog()));
  await ui.input(ui.query('#food-calories'), '250');
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.equal(ui.state().dailyLogs[day][0].totalCalories, 139);
  await ui.click(ui.button('Удалить Йогурт натуральный', ui.topDialog()));
  const dialogs = [...ui.document.querySelectorAll('dialog[open]')];
  assert.equal(dialogs.length, 2);
  const headings = dialogs.map(dialog => dialog.getAttribute('aria-labelledby'));
  assert.equal(new Set(headings).size, 2, 'Each open modal has its own accessible heading');
  for (const dialog of dialogs) {
    assert.ok(dialog.contains(ui.document.getElementById(dialog.getAttribute('aria-labelledby'))));
  }
  assert.equal(ui.topDialog().querySelector('h2').textContent, 'Удалить продукт?');
  await ui.click(ui.button('Удалить', ui.topDialog()));
  assert.equal(ui.state().foods.length, 0);
  assert.deepEqual(ui.state().dailyLogs[day][0], saved);
  await ui.click(ui.button('Закрыть', ui.topDialog()));
  assert.equal(ui.document.querySelectorAll('.diary-row').length, 1);
  const stored = Array.from({ length: ui.window.localStorage.length }, (_, index) => {
    const key = ui.window.localStorage.key(index);
    return [key, ui.window.localStorage.getItem(key)];
  });
  const reloaded = await mount(t, { storageEntries: stored });
  assert.equal(reloaded.state().foods.length, 0, 'Deleted last product must stay deleted after reload');
  assert.deepEqual(reloaded.state().dailyLogs[day][0], saved);
  assert.equal(reloaded.document.querySelectorAll('.diary-row').length, 1);
});

test('search, category, recent and frequent filters work together in the diary and settings', async t => {
  const apple = food('apple', 'Яблоко', { category: 'fruits', createdAt: '2026-09-01T10:00:00.000Z' });
  const chicken = food('chicken', 'Куриное филе', { category: 'meat', createdAt: '2026-09-20T10:00:00.000Z' });
  const grain = food('grain', 'Гречка варёная', { category: 'grains', createdAt: '2026-09-15T10:00:00.000Z' });
  const ui = await mount(t, { initial: data([apple, chicken, grain], {
    '2026-09-19': [meal('1', chicken), meal('2', apple)],
    '2026-09-20': [meal('3', chicken)],
  }) });
  const main = ui.query('main');
  await ui.click(ui.query('.product-picker-toggle'));
  await ui.input(ui.query('input[type="search"]', main), 'ВАРЕНАЯ греч');
  assert.deepEqual(ui.rows(), ['Гречка варёная']);
  await ui.input(ui.query('.category-row select', main), 'meat');
  assert.deepEqual(ui.rows(), []);
  await ui.input(ui.query('input[type="search"]', main), '');
  assert.deepEqual(ui.rows(), ['Куриное филе']);
  await ui.input(ui.query('.category-row select', main), 'all');
  await ui.click(ui.button('Недавно добавленные', main));
  assert.deepEqual(ui.rows(), ['Куриное филе', 'Гречка варёная', 'Яблоко']);
  await ui.click(ui.button('Часто используемые', main));
  assert.deepEqual(ui.rows(), ['Куриное филе', 'Яблоко']);
  assert.match(ui.query('.food-meta', main).textContent, /2 записей/);
  await ui.input(ui.query('.category-row select', main), 'fruits');
  assert.deepEqual(ui.rows(), ['Яблоко']);
  await ui.click(ui.button('Мои продукты', main));
  const settings = ui.topDialog();
  await ui.click(ui.button('Часто используемые', settings));
  assert.deepEqual(ui.rows(settings), ['Куриное филе', 'Яблоко']);
  await ui.input(ui.query('input[type="search"]', settings), 'ябл');
  assert.deepEqual(ui.rows(settings), ['Яблоко']);
});

test('a collapsed picker adds multiple portions across searches in one saved action', async t => {
  const cucumber = food('cucumber', 'Огурец', { calories: 15, protein: 0.8, fat: 0.1, carbs: 2.5 });
  const egg = food('egg', 'Яйцо', { calories: 143, protein: 12.6, fat: 9.5, carbs: 0.7 });
  const fish = food('fish', 'Минтай', { calories: 72, protein: 15.9, fat: 0.9, carbs: 0 });
  const ui = await mount(t, { initial: data([cucumber, egg, fish]) });
  const toggle = ui.query('.product-picker-toggle');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.query('#food-picker').hidden, true);
  assert.equal(ui.document.querySelector('main .food-select'), null);
  await ui.click(toggle);
  await ui.click(ui.button('Выбрать Огурец'));
  await ui.input(ui.query('input[aria-label="Вес Огурец, г"]'), '150,5');
  await ui.input(ui.query('input[type="search"]'), 'Яйцо');
  await ui.click(ui.button('Выбрать Яйцо'));
  await ui.input(ui.query('input[type="search"]'), 'Минтай');
  await ui.click(ui.button('Выбрать Минтай'));
  assert.equal(ui.document.querySelectorAll('.selected-portion').length, 3);
  assert.equal(ui.query('input[aria-label="Вес Огурец, г"]').value, '150,5');
  await ui.click(ui.button('Готово · выбрано 3'));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.document.activeElement, ui.query('input[aria-label="Вес Огурец, г"]'));
  await ui.input(ui.query('input[aria-label="Вес Минтай, г"]'), '200');
  assert.match(ui.query('.portion-preview').textContent, /310 ккал/);
  assert.match(ui.query('.portion-preview').textContent, /Б 45,6/);
  const beforeKeys = ui.window.localStorage.length;
  await ui.submit(ui.query('.portion-form'));
  const day = ui.query('input[type="date"]').value;
  const logs = ui.state().dailyLogs[day];
  assert.deepEqual(logs.map(item => [item.foodId, item.grams]), [['cucumber', 150.5], ['egg', 100], ['fish', 200]]);
  assert.equal(ui.window.localStorage.length, beforeKeys + 1, 'All portions must be persisted in one journal entry');
  assert.equal(ui.document.querySelectorAll('.diary-row').length, 3);
  assert.equal(ui.document.querySelector('.portion-form'), null);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  const stored = Array.from({ length: ui.window.localStorage.length }, (_, index) => {
    const key = ui.window.localStorage.key(index);
    return [key, ui.window.localStorage.getItem(key)];
  });
  const reloaded = await mount(t, { storageEntries: stored });
  assert.deepEqual(reloaded.state().dailyLogs[day], logs);
  await reloaded.click(reloaded.button('Редактировать запись Минтай'));
  await reloaded.input(reloaded.query('input', reloaded.topDialog()), '250');
  await reloaded.submit(reloaded.query('form', reloaded.topDialog()));
  assert.equal(reloaded.state().dailyLogs[day].find(item => item.foodId === 'fish').grams, 250);
  assert.equal(reloaded.state().dailyLogs[day].length, 3);
});

test('invalid weights or products removed in another tab never save a partial meal', async t => {
  const first = food('first', 'Огурец'), second = food('second', 'Яйцо');
  const ui = await mount(t, { initial: data([first, second]) });
  await ui.click(ui.query('.product-picker-toggle'));
  await ui.click(ui.button('Выбрать Огурец'));
  await ui.click(ui.button('Выбрать Яйцо'));
  await ui.input(ui.query('input[aria-label="Вес Яйцо, г"]'), '-5');
  const before = ui.state();
  await ui.submit(ui.query('.portion-form'));
  assert.match(ui.query('[role="alert"]').textContent, /Яйцо.*вес больше нуля/);
  assert.deepEqual(ui.state(), before);
  assert.equal(ui.document.querySelectorAll('.selected-portion').length, 2);
  await ui.input(ui.query('input[aria-label="Вес Яйцо, г"]'), '60');
  createStore(ui.window.localStorage).commit('deleteFood', { id: 'second' });
  await ui.submit(ui.query('.portion-form'));
  assert.match(ui.query('[role="alert"]').textContent, /Яйцо.*удалён из базы/);
  assert.deepEqual(ui.state().dailyLogs, {});
  await ui.click(ui.button('Убрать Яйцо из выбранных'));
  await ui.submit(ui.query('.portion-form'));
  assert.equal(Object.values(ui.state().dailyLogs).flat().length, 1);
});

test('product imports validate before saving and support both JSON and labelled text', async t => {
  const ui = await mount(t);
  await ui.click(ui.button(/Настройки/));
  await ui.click(ui.button(/Управлять продуктами/, ui.topDialog()));
  await ui.click(ui.button('Импорт', ui.topDialog()));
  await ui.input(ui.query('textarea', ui.topDialog()), JSON.stringify([
    { name: 'Кефир', calories: 50, protein: '3,1', fat: 2, carbs: 4 },
    { name: 'Неполный продукт', calories: 100 },
  ]));
  await ui.click(ui.button('Проверить', ui.topDialog()));
  assert.equal(ui.state().foods.length, 0);
  assert.match(ui.query('[role="alert"]', ui.topDialog()).textContent, /Продукт 2/);
  await ui.input(ui.query('textarea', ui.topDialog()), JSON.stringify([
    { name: 'Кефир', calories: 50, protein: '3,1', fat: 2, carbs: 4 },
    { name: 'Яблоко', calories: 52, protein: 0.3, fat: 0.2, carbs: 14 },
  ]));
  await ui.click(ui.button('Проверить', ui.topDialog()));
  assert.equal(ui.state().foods.length, 0, 'Preview must not change the stored catalog');
  assert.equal(ui.topDialog().querySelectorAll('.import-preview > div').length, 2);
  await ui.click(ui.button('Добавить в базу', ui.topDialog()));
  assert.equal(ui.state().foods.length, 2);
  assert.equal(ui.state().foods.find(item => item.name === 'Кефир').category, 'dairy');
  assert.equal(ui.state().foods.find(item => item.name === 'Кефир').protein, 3.1);
  await ui.click(ui.button('Импорт', ui.topDialog()));
  await ui.input(ui.query('textarea', ui.topDialog()), 'Творог 5%\nКалории: 121\nБелки: 17\nЖиры: 5\nУглеводы: 1,8');
  await ui.click(ui.button('Проверить', ui.topDialog()));
  await ui.click(ui.button('Добавить в базу', ui.topDialog()));
  assert.equal(ui.state().foods.length, 3);
  assert.equal(ui.state().foods.find(item => item.name === 'Творог 5%').carbs, 1.8);
});

test('an unrelated change from another tab keeps the unfinished goal form', async t => {
  const ui = await mount(t);
  await ui.click(ui.button(/Настройки/));
  await ui.input(ui.query('#goal-protein'), '133,5');
  const otherTab = createStore(ui.window.localStorage);
  otherTab.commit('foods', [food('external', 'Новый продукт из другой вкладки')]);
  const eventKey = [...Array(ui.window.localStorage.length)].map((_, index) => ui.window.localStorage.key(index)).find(key => key.startsWith(EVENT_PREFIX));
  ui.window.dispatchEvent(new ui.window.StorageEvent('storage', { key: eventKey, storageArea: ui.window.localStorage }));
  await pause();
  assert.equal(ui.query('#goal-protein').value, '133,5');
  assert.equal(ui.state().foods.length, 1);
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.equal(ui.state().goals.protein, 133.5);
});

test('backup previews discard invalid files, stale asynchronous reads and reads completed after closing', async t => {
  const ui = await mount(t, { initial: data([food('original', 'Исходный продукт')]) });
  await ui.click(ui.button(/Настройки/));
  async function chooseFile(name, text) {
    const input = ui.query('input[type="file"]', ui.topDialog());
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name, size: 100, text: typeof text === 'function' ? text : () => Promise.resolve(text) }],
    });
    input.dispatchEvent(new ui.window.Event('change', { bubbles: true }));
    await pause();
  }
  await chooseFile('valid-first.json', JSON.stringify(data([food('first', 'Первая копия')])));
  assert.match(ui.query('.backup-preview', ui.topDialog()).textContent, /valid-first\.json/);
  assert.equal(ui.state().foods[0].id, 'original', 'Checking a backup must not replace stored data');
  await chooseFile('invalid.json', '{bad json');
  assert.equal(ui.topDialog().querySelector('.backup-preview'), null);
  assert.match(ui.topDialog().textContent, /некорректный JSON/);
  assert.equal(ui.state().foods[0].id, 'original');

  let finishSlow;
  await chooseFile('slow.json', () => new Promise(resolve => { finishSlow = resolve; }));
  assert.equal(ui.topDialog().querySelector('.backup-preview'), null);
  await chooseFile('latest.json', JSON.stringify(data([food('latest', 'Последняя копия')])));
  finishSlow(JSON.stringify(data([food('slow', 'Устаревшая копия')])));
  await pause();
  assert.match(ui.query('.backup-preview', ui.topDialog()).textContent, /latest\.json/);
  assert.doesNotMatch(ui.query('.backup-preview', ui.topDialog()).textContent, /slow\.json/);
  await ui.click(ui.button('Восстановить', ui.topDialog()));
  assert.equal(ui.state().foods[0].id, 'latest');

  let finishAfterClose;
  await chooseFile('closed.json', () => new Promise(resolve => { finishAfterClose = resolve; }));
  await ui.click(ui.button('Закрыть', ui.topDialog()));
  finishAfterClose(JSON.stringify(data([food('closed', 'Закрытая копия')])));
  await pause();
  await ui.click(ui.button(/Настройки/));
  assert.equal(ui.topDialog().querySelector('.backup-preview'), null);
  assert.equal(ui.state().foods[0].id, 'latest');
});
