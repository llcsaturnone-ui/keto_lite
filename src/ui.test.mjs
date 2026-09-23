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
  const rows = (scope = document.querySelector('main')) => [...scope.querySelectorAll('.food-title')].filter(node => node.closest('.food-page')?.getAttribute('aria-hidden') !== 'true').map(node => node.textContent);
  return { window, document, query, button, click, input, submit, topDialog, state, rows };
}

test('diary and progress navigation keeps four daily nutrients and existing settings', async t => {
  const ui = await mount(t);
  assert.equal(ui.query('h1').textContent, 'Дневник');
  assert.equal(ui.document.querySelectorAll('.macro-card').length, 4);
  assert.equal(ui.document.querySelectorAll('.app-tabs button').length, 2);
  await ui.click(ui.button('↗ Прогресс'));
  assert.equal(ui.query('h1').textContent, 'Прогресс');
  await ui.click(ui.button('Дневник'));
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

  await ui.input(ui.query('main input[type="search"]'), 'Йогурт');
  await ui.click(ui.query('main .food-select'));
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

test('global search, favorite toggles and management filters stay independent', async t => {
  const apple = food('apple', 'Яблоко', { category: 'fruits' });
  const chicken = food('chicken', 'Куриное филе', { category: 'meat' });
  const grain = food('grain', 'Гречка варёная', { category: 'grains' });
  const ui = await mount(t, { initial: data([apple, chicken, grain], {
    '2026-09-19': [meal('1', chicken), meal('2', apple)],
    '2026-09-20': [meal('3', chicken)],
  }) });
  const main = ui.query('main');
  assert.deepEqual(ui.rows(), ['Яблоко', 'Куриное филе', 'Гречка варёная']);
  assert.equal(main.querySelector('.food-results'), null);
  await ui.click(ui.button('★ Избранное', main));
  assert.deepEqual(ui.rows(), []);
  await ui.input(ui.query('input[type="search"]', main), 'ВАРЕНАЯ греч');
  assert.deepEqual(ui.rows(), ['Гречка варёная'], 'Search includes products outside favorites and history');
  await ui.click(ui.button('Добавить Гречка варёная в избранное', main));
  assert.deepEqual(ui.state().favorites, ['grain']);
  assert.equal(ui.document.querySelector('.portion-form'), null, 'Starring must not select a meal');
  await ui.click(ui.button('★ Избранное', main));
  assert.deepEqual(ui.rows(), ['Гречка варёная']);
  await ui.click(ui.button('Выбрать Гречка варёная', main));
  await ui.click(ui.button('Убрать Гречка варёная из избранного', main));
  assert.deepEqual(ui.rows(), []);
  assert.equal(ui.document.querySelectorAll('.selected-portion').length, 1);
  await ui.click(ui.button('★ Избранное', main));
  assert.deepEqual(ui.rows(), ['Яблоко', 'Куриное филе', 'Гречка варёная']);
  await ui.click(ui.button(/Настройки/));
  await ui.click(ui.button(/Управлять продуктами/, ui.topDialog()));
  const settings = ui.topDialog();
  assert.deepEqual(ui.rows(settings), ['Яблоко', 'Куриное филе', 'Гречка варёная']);
  await ui.input(ui.query('.category-row select', settings), 'fruits');
  assert.deepEqual(ui.rows(settings), ['Яблоко']);
  await ui.click(ui.button('Добавить Яблоко в избранное', settings));
  assert.deepEqual(ui.state().favorites, ['apple']);
  await ui.click(ui.button('Закрыть', settings));
  await ui.click(ui.button('★ Избранное', main));
  assert.deepEqual(ui.rows(), ['Яблоко']);
});

test('quick search adds multiple portions across searches and tabs in one saved action', async t => {
  const cucumber = food('cucumber', 'Огурец', { calories: 15, protein: 0.8, fat: 0.1, carbs: 2.5 });
  const egg = food('egg', 'Яйцо', { calories: 143, protein: 12.6, fat: 9.5, carbs: 0.7 });
  const fish = food('fish', 'Минтай', { calories: 72, protein: 15.9, fat: 0.9, carbs: 0 });
  const ui = await mount(t, { initial: data([cucumber, egg, fish]) });
  assert.equal(ui.document.querySelectorAll('main .food-select').length, 3);
  await ui.input(ui.query('main input[type="search"]'), 'Огурец');
  await ui.click(ui.button('Выбрать Огурец'));
  await ui.input(ui.query('input[aria-label="Вес Огурец, г"]'), '150,5');
  await ui.input(ui.query('input[type="search"]'), 'Яйцо');
  await ui.click(ui.button('Выбрать Яйцо'));
  await ui.input(ui.query('input[type="search"]'), 'Минтай');
  await ui.click(ui.button('Выбрать Минтай'));
  assert.equal(ui.document.querySelectorAll('.selected-portion').length, 3);
  assert.equal(ui.query('input[aria-label="Вес Огурец, г"]').value, '150,5');
  await ui.click(ui.button('↗ Прогресс'));
  await ui.click(ui.button('Дневник'));
  assert.equal(ui.query('input[aria-label="Вес Огурец, г"]').value, '150,5');
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
  await ui.input(ui.query('main input[type="search"]'), 'Огурец');
  await ui.click(ui.button('Выбрать Огурец'));
  await ui.input(ui.query('main input[type="search"]'), 'Яйцо');
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

test('progress saves partial daily records, draws dated lines, edits and deletes without touching the diary', async t => {
  const apple = food('apple', 'Яблоко');
  const ui = await mount(t, { initial: data([apple], { '2026-09-21': [meal('meal-1', apple)] }) });
  await ui.input(ui.query('input[type="date"]'), '2026-09-21');
  const originalLogs = ui.state().dailyLogs;
  await ui.click(ui.button('↗ Прогресс'));
  await ui.click(ui.button('＋ Добавить замеры'));
  await ui.input(ui.query('input[aria-label="Вес, кг"]', ui.topDialog()), '93,1');
  await ui.input(ui.query('input[aria-label="Жир, %"]', ui.topDialog()), '28,6');
  await ui.input(ui.query('input[aria-label="Живот на уровне пупка, см"]', ui.topDialog()), '105');
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.deepEqual(ui.state().measurements['2026-09-21'], { weight: 93.1, fatPercent: 28.6, waist: 105 });
  assert.match(ui.query('.progress-page').textContent, /Линия появится после следующего замера/);
  await ui.click(ui.button('Предыдущий день'));
  await ui.click(ui.button('＋ Добавить замеры'));
  await ui.input(ui.query('input[aria-label="Вес, кг"]', ui.topDialog()), '93,4');
  await ui.submit(ui.query('form', ui.topDialog()));
  await ui.click(ui.button('Следующий день'));
  assert.ok(ui.query('polyline[data-series="weight"]'));
  await ui.input(ui.query('select[aria-label="Дата на графике"]'), '2026-09-20');
  assert.match(ui.query('.chart-values').textContent, /93,4 кг/);
  await ui.input(ui.query('select[aria-label="Показатели графика"]'), 'percent');
  assert.match(ui.query('.chart-values').textContent, /28,6 %/);
  assert.match(ui.query('.chart-values').textContent, /Нет замера/);
  await ui.click(ui.button('Изменить замеры за этот день'));
  await ui.input(ui.query('input[aria-label="Вес, кг"]', ui.topDialog()), '92,9');
  await ui.input(ui.query('input[aria-label="Живот на уровне пупка, см"]', ui.topDialog()), '');
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.deepEqual(ui.state().measurements['2026-09-21'], { weight: 92.9, fatPercent: 28.6 });
  await ui.click(ui.button('Удалить замеры 20.09.2026'));
  await ui.click(ui.button('Удалить', ui.topDialog()));
  assert.equal(Object.keys(ui.state().measurements).length, 1);
  assert.deepEqual(ui.state().dailyLogs, originalLogs);
  const stored = Array.from({ length: ui.window.localStorage.length }, (_, index) => {
    const key = ui.window.localStorage.key(index); return [key, ui.window.localStorage.getItem(key)];
  });
  const reloaded = await mount(t, { storageEntries: stored });
  assert.deepEqual(reloaded.state().measurements, ui.state().measurements);
});

test('invalid percentages and storage failures keep measurement drafts and previous data', async t => {
  const ui = await mount(t, { initial: { ...data(), measurements: { '2026-09-21': { weight: 93.1, waist: 105 } } } });
  await ui.input(ui.query('input[type="date"]'), '2026-09-21');
  await ui.click(ui.button('↗ Прогресс'));
  await ui.click(ui.button('Изменить замеры за этот день'));
  await ui.input(ui.query('input[aria-label="Вес, кг"]', ui.topDialog()), '92,9');
  await ui.input(ui.query('input[aria-label="Мышцы, %"]', ui.topDialog()), '120');
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.match(ui.query('[role="alert"]', ui.topDialog()).textContent, /Мышцы/);
  assert.equal(ui.state().measurements['2026-09-21'].weight, 93.1);
  await ui.input(ui.query('input[aria-label="Мышцы, %"]', ui.topDialog()), '67,6');
  const original = ui.window.Storage.prototype.setItem;
  ui.window.Storage.prototype.setItem = function (key, value) { if (key.startsWith(EVENT_PREFIX)) throw new Error('quota'); original.call(this, key, value); };
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.match(ui.query('[role="alert"]', ui.topDialog()).textContent, /не применено/);
  assert.equal(ui.query('input[aria-label="Вес, кг"]', ui.topDialog()).value, '92,9');
  ui.window.Storage.prototype.setItem = original;
  createStore(ui.window.localStorage).commit('measurement', { date: '2026-09-21', patch: { waist: 104 } });
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.deepEqual(ui.state().measurements['2026-09-21'], { weight: 92.9, musclePercent: 67.6, waist: 104 });
});

test('backup preview and restore include measurements and favorites', async t => {
  const ui = await mount(t);
  const saved = { version: 12, ...data([food('egg', 'Яйцо')]), favorites: ['egg'], measurements: { '2026-09-21': { weight: 93.1, bicepsLeft: 36, musclePercent: 67.6 } } };
  await ui.click(ui.button(/Настройки/));
  const input = ui.query('input[type="file"]', ui.topDialog());
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'full-backup.json', size: 100, text: () => Promise.resolve(JSON.stringify(saved)) }] });
  input.dispatchEvent(new ui.window.Event('change', { bubbles: true }));
  await pause();
  assert.match(ui.query('.backup-preview').textContent, /1 дней замеров · 1 избранных/);
  await ui.click(ui.button('Восстановить', ui.topDialog()));
  assert.deepEqual(ui.state().measurements, saved.measurements);
  assert.deepEqual(ui.state().favorites, ['egg']);
  await ui.click(ui.button('Закрыть', ui.topDialog()));
  await ui.click(ui.button('★ Избранное'));
  assert.deepEqual(ui.rows(), ['Яйцо']);
});

test('separate additions join the same lunch, individual foods move groups and group totals stay exact', async t => {
  const apple = food('apple', 'Яблоко', { calories: 52, protein: 0.3, fat: 0.2, carbs: 14 });
  const egg = food('egg', 'Яйцо', { calories: 143, protein: 12.6, fat: 9.5, carbs: 0.7 });
  const ui = await mount(t, { initial: data([apple, egg]) });
  const search = ui.query('main input[type="search"]');
  await ui.input(search, 'Яблоко');
  await ui.click(ui.button('Выбрать Яблоко'));
  await ui.input(ui.query('.portion-form select[aria-label="Приём пищи"]'), 'Обед');
  await ui.submit(ui.query('.portion-form'));
  await ui.input(search, 'Яйцо');
  await ui.click(ui.button('Выбрать Яйцо'));
  await ui.submit(ui.query('.portion-form'));
  assert.equal(ui.document.querySelectorAll('.meal-group').length, 1);
  assert.equal(ui.document.querySelectorAll('.diary-row').length, 2);
  assert.match(ui.query('.meal-totals').textContent, /195 ккал/);
  assert.match(ui.query('.meal-totals').textContent, /Б 12,9/);
  await ui.click(ui.button('Редактировать запись Яйцо'));
  await ui.input(ui.query('select[aria-label="Приём пищи"]', ui.topDialog()), 'Завтрак');
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.equal(ui.document.querySelectorAll('.meal-group').length, 2);
  await ui.click(ui.button('Изменить группу Завтрак'));
  await ui.input(ui.query('select[aria-label="Приём пищи"]', ui.topDialog()), 'Обед');
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.equal(ui.document.querySelectorAll('.meal-group').length, 1);
  assert.match(ui.query('.meal-totals').textContent, /195 ккал/);
  const day = ui.query('input[type="date"]').value;
  assert.deepEqual(ui.state().dailyLogs[day].map(log => log.meal), ['Обед', 'Обед']);
});

test('new products can be added directly from the diary manually or as JSON without an import wizard', async t => {
  const ui = await mount(t);
  await ui.click(ui.button('＋ Продукт'));
  await ui.input(ui.query('input[placeholder="Например, йогурт"]', ui.topDialog()), 'Йогурт 2%');
  for (const [label, value] of [['Ккал', '70'], ['Белки, г', '8,5'], ['Жиры, г', '2'], ['Углеводы, г', '4,5']]) await ui.input(ui.query(`input[aria-label="${label}"]`, ui.topDialog()), value);
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.equal(ui.topDialog(), undefined);
  assert.equal(ui.state().foods[0].category, 'dairy');
  assert.equal(ui.state().foods[0].protein, 8.5);
  assert.equal(ui.document.querySelectorAll('.selected-portion').length, 1);
  assert.deepEqual(ui.state().dailyLogs, {}, 'Adding a product must not log unconfirmed grams');
  await ui.click(ui.button('＋ Продукт'));
  await ui.click(ui.button('JSON или текст', ui.topDialog()));
  await ui.input(ui.query('textarea', ui.topDialog()), JSON.stringify([{ name: 'Минтай', calories: 72, protein: 16, fat: 1, carbs: 0 }, { name: 'Помидор', calories: 20, protein: 1, fat: 0.2, carbs: 3.5 }]));
  assert.match(ui.topDialog().textContent, /Распознано: Минтай, Помидор/);
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.equal(ui.state().foods.length, 3);
  assert.equal(ui.document.querySelectorAll('.selected-portion').length, 3);
  await ui.click(ui.button('＋ Продукт'));
  await ui.click(ui.button('JSON или текст', ui.topDialog()));
  await ui.input(ui.query('textarea', ui.topDialog()), JSON.stringify([{ name: 'Новый', calories: 72, protein: 16, fat: 1, carbs: 0 }, { name: 'Минтай', calories: 70, protein: 16, fat: 1, carbs: 0 }]));
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.match(ui.query('[role="alert"]', ui.topDialog()).textContent, /уже есть/);
  assert.equal(ui.state().foods.length, 3, 'Duplicate JSON never imports a partial batch');
});

test('compact picker pages six newest foods, toggles both filters off and clears search', async t => {
  const foods = Array.from({ length: 13 }, (_, index) => food(`f${index}`, `Продукт ${index}`, { createdAt: new Date(2026, 8, index + 1).toISOString() }));
  const ui = await mount(t, { initial: { ...data(foods), favorites: ['f1', 'f7'] } });
  assert.deepEqual(ui.rows(), ['Продукт 7', 'Продукт 1']);
  await ui.click(ui.button('★ Избранное'));
  assert.equal(ui.button('★ Избранное').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(ui.rows(), [12, 11, 10, 9, 8, 7].map(index => `Продукт ${index}`));
  assert.equal(ui.button('Предыдущие 6').disabled, true);
  await ui.click(ui.button('Выбрать Продукт 12'));
  await ui.click(ui.button('Следующие 6'));
  assert.deepEqual(ui.rows(), [6, 5, 4, 3, 2, 1].map(index => `Продукт ${index}`));
  const search = ui.query('main input[type="search"]');
  await ui.input(search, 'Продукт 11');
  assert.deepEqual(ui.rows(), ['Продукт 11']);
  await ui.click(ui.button('Очистить поиск'));
  assert.equal(search.value, '');
  assert.equal(ui.document.activeElement === search, true);
  assert.equal(ui.rows().length, 6);
  assert.equal(ui.button('Выбрать Продукт 12').getAttribute('aria-pressed'), 'true');
  await ui.click(ui.button('Готовые'));
  assert.equal(ui.rows().length, 0);
  await ui.click(ui.button('Готовые'));
  assert.equal(ui.button('Готовые').getAttribute('aria-pressed'), 'false');
  assert.equal(ui.rows().length, 6);
  assert.equal(ui.document.body.textContent.includes('Часто используемые'), false);
});

test('saved shakes allow per-meal ingredient changes without changing the template, then edit and delete', async t => {
  const powder = food('powder', 'Протеин', { calories: 400, protein: 80, fat: 5, carbs: 8 });
  const water = food('water', 'Вода', { calories: 0, protein: 0, fat: 0, carbs: 0 });
  const chia = food('chia', 'Семена чиа', { calories: 480, protein: 16, fat: 30, carbs: 8 });
  const ui = await mount(t, { initial: data([powder, water, chia]) });
  for (const [name, grams] of [['Протеин', '30'], ['Вода', '250'], ['Семена чиа', '10']]) {
    await ui.click(ui.button(`Выбрать ${name}`));
    await ui.input(ui.query(`input[aria-label="Вес ${name}, г"]`), grams);
  }
  await ui.click(ui.button('Сохранить состав как блюдо'));
  await ui.input(ui.query('input', ui.topDialog()), 'Протеиновый коктейль');
  await ui.submit(ui.query('form', ui.topDialog()));
  assert.equal(ui.state().recipes.length, 1);
  const template = ui.state().recipes[0];
  assert.deepEqual(template.ingredients.map(item => item.grams), [30, 250, 10]);
  assert.deepEqual(ui.state().dailyLogs, {});
  assert.equal(ui.document.querySelectorAll('.selected-portion').length, 3, 'Saving a recipe preserves current portions');
  await ui.submit(ui.query('.portion-form'));
  await ui.click(ui.button('Готовые'));
  await ui.click(ui.button('Выбрать блюдо Протеиновый коктейль'));
  await ui.input(ui.query('input[aria-label="Вес Протеин, г"]'), '60');
  await ui.click(ui.button('Убрать Семена чиа из выбранных'));
  assert.match(ui.query('.portion-preview').textContent, /240 ккал/);
  await ui.submit(ui.query('.portion-form'));
  assert.deepEqual(ui.state().recipes[0], template);
  const day = ui.query('input[type="date"]').value;
  assert.deepEqual(ui.state().dailyLogs[day].slice(-2).map(log => [log.foodId, log.grams, log.totalCalories]), [['powder', 60, 240], ['water', 250, 0]]);
  const stored = Array.from({ length: ui.window.localStorage.length }, (_, index) => {
    const key = ui.window.localStorage.key(index); return [key, ui.window.localStorage.getItem(key)];
  });
  const reload = await mount(t, { storageEntries: stored });
  await reload.click(reload.button('Готовые'));
  await reload.click(reload.button('Выбрать блюдо Протеиновый коктейль'));
  assert.equal(reload.query('input[aria-label="Вес Протеин, г"]').value, '30');
  assert.equal(reload.document.querySelectorAll('.selected-portion').length, 3);
  await reload.click(reload.button('Редактировать блюдо Протеиновый коктейль'));
  await reload.input(reload.query('input[aria-label="Вес ингредиента Протеин, г"]', reload.topDialog()), '45,5');
  await reload.submit(reload.query('form', reload.topDialog()));
  assert.equal(reload.state().recipes[0].ingredients[0].grams, 45.5);
  assert.equal(reload.query('input[aria-label="Вес Протеин, г"]').value, '30', 'Template editing does not overwrite an already selected portion');
  const logs = reload.state().dailyLogs;
  await reload.click(reload.button('Редактировать блюдо Протеиновый коктейль'));
  await reload.click(reload.button('Удалить блюдо', reload.topDialog()));
  await reload.click(reload.button('Удалить', reload.topDialog()));
  assert.equal(reload.state().recipes.length, 0);
  assert.deepEqual(reload.state().dailyLogs, logs);
});

test('new recipe constructor adds ingredients including a new zero-calorie product and rejects invalid weights', async t => {
  const powder = food('powder', 'Протеин');
  const ui = await mount(t, { initial: data([powder]) });
  await ui.click(ui.button('Готовые'));
  await ui.click(ui.button('＋ Создать блюдо'));
  let dialog = ui.topDialog();
  await ui.input(ui.query('form input', dialog), 'Коктейль с водой');
  await ui.submit(ui.query('form', dialog));
  assert.match(dialog.textContent, /хотя бы один ингредиент/);
  await ui.click(ui.button('Выбрать Протеин', dialog));
  await ui.input(ui.query('input[aria-label="Вес ингредиента Протеин, г"]', dialog), '0');
  await ui.submit(ui.query('form', dialog));
  assert.equal(ui.state().recipes.length, 0);
  await ui.input(ui.query('input[aria-label="Вес ингредиента Протеин, г"]', dialog), '30');
  await ui.click(ui.button('＋ Новый продукт', dialog));
  const form = ui.query('.recipe-picker form', dialog);
  await ui.input(ui.query('input[type="text"]', form), 'Вода');
  for (const input of form.querySelectorAll('.macro-inputs input')) await ui.input(input, '0');
  await ui.submit(form);
  await ui.input(ui.query('input[aria-label="Вес ингредиента Вода, г"]', dialog), '250');
  await ui.submit(ui.query('form', dialog));
  assert.equal(ui.state().recipes.length, 1);
  assert.deepEqual(ui.state().recipes[0].ingredients.map(item => [item.foodName, item.grams]), [['Протеин', 30], ['Вода', 250]]);
  assert.deepEqual(ui.state().dailyLogs, {});
  assert.equal(ui.document.querySelector('.portion-form') === null, true);
});

test('missing recipe ingredients cannot silently disappear or save a partial selection', async t => {
  const powder = food('powder', 'Протеин');
  const recipe = { id: 'shake', name: 'Коктейль', ingredients: [{ foodId: 'powder', foodName: 'Протеин', grams: 30 }, { foodId: 'missing', foodName: 'Семена чиа', grams: 10 }] };
  const ui = await mount(t, { initial: { ...data([powder]), recipes: [recipe] } });
  await ui.click(ui.button('Готовые'));
  await ui.click(ui.button('Выбрать блюдо Коктейль'));
  assert.equal(ui.document.querySelector('.portion-form') === null, true);
  const dialog = ui.topDialog();
  assert.match(dialog.textContent, /Удалён из базы/);
  await ui.submit(ui.query('form', dialog));
  assert.equal(ui.state().recipes[0].ingredients.length, 2);
  await ui.click(ui.button('Убрать ингредиент Семена чиа', dialog));
  await ui.submit(ui.query('form', dialog));
  await ui.click(ui.button('Выбрать блюдо Коктейль'));
  assert.equal(ui.query('input[aria-label="Вес Протеин, г"]').value, '30');
});

test('weight keypad shows an automatic live total and applies only on confirmation', async t => {
  const ui = await mount(t, { initial: data([food('rice', 'Рис')]) });
  await ui.click(ui.button('Выбрать Рис'));
  const weight = ui.query('input[aria-label="Вес Рис, г"]');
  assert.equal(weight.inputMode, 'none');
  assert.equal(weight.readOnly, true);
  await ui.click(weight);
  let calc = ui.topDialog();
  await ui.click(ui.button('Очистить', calc));
  for (const digit of '584') await ui.click(ui.button(digit, calc));
  await ui.click(ui.button('+', calc));
  assert.equal(calc.querySelector('.weight-live-result'), null);
  assert.equal(ui.button('Применить вес', calc).disabled, true);
  await ui.click(ui.button('5', calc));
  assert.equal(ui.query('.weight-live-result', calc).textContent, ' = 589');
  await ui.click(ui.button('8', calc));
  assert.equal(ui.query('.weight-live-result', calc).textContent, ' = 642');
  await ui.click(ui.button('4', calc));
  assert.equal(ui.query('.weight-live-result', calc).textContent, ' = 1168');
  assert.equal(weight.value, '100', 'Calculator draft must not change a portion before confirmation');
  await ui.click(ui.button('Применить вес', calc));
  assert.equal(weight.value, '1168');
  assert.equal(ui.document.activeElement === weight, true);
  await ui.click(weight);
  calc = ui.topDialog();
  await ui.click(ui.button('6', calc));
  await ui.click(ui.button('0', calc));
  assert.match(ui.query('.weight-expression', calc).textContent, /^60$/);
  await ui.click(ui.button('Отменить ввод веса', calc));
  assert.equal(weight.value, '1168');
  await ui.click(weight);
  calc = ui.topDialog();
  await ui.click(ui.button('−', calc));
  for (const digit of '250') await ui.click(ui.button(digit, calc));
  assert.equal(ui.query('.weight-live-result', calc).textContent, ' = 918');
  await ui.click(ui.button('Применить вес', calc));
  await ui.submit(ui.query('.portion-form'));
  const date = ui.query('input[type="date"]').value;
  assert.equal(ui.state().dailyLogs[date][0].grams, 918);
  assert.equal(ui.state().dailyLogs[date][0].totalCalories, 918);
});

test('weight keypad clears drafts, guards invalid weights and works inside recipe and diary dialogs', async t => {
  const recipe = { id: 'shake', name: 'Коктейль', ingredients: [{ foodId: 'protein', foodName: 'Протеин', grams: 30 }] };
  const ui = await mount(t, { initial: { ...data([food('protein', 'Протеин')]), recipes: [recipe] } });
  await ui.click(ui.button('Готовые'));
  await ui.click(ui.button('Редактировать блюдо Коктейль'));
  const recipeDialog = ui.topDialog();
  const weight = ui.query('input[aria-label="Вес ингредиента Протеин, г"]', recipeDialog);
  await ui.click(weight);
  let calc = ui.topDialog();
  await ui.click(ui.button('÷', calc));
  await ui.click(ui.button('0', calc));
  assert.match(calc.textContent, /На ноль делить нельзя/);
  assert.equal(ui.button('Применить вес', calc).disabled, true);
  await ui.click(ui.button('Отменить ввод веса', calc));
  assert.equal(ui.topDialog() === recipeDialog, true);
  assert.equal(weight.value, '30');
  await ui.click(weight);
  calc = ui.topDialog();
  await ui.click(ui.button('Очистить', calc));
  await ui.click(ui.button('Применить вес', calc));
  assert.equal(weight.value, '');
  await ui.submit(ui.query('form', recipeDialog));
  assert.equal(ui.state().recipes[0].ingredients[0].grams, 30);
  await ui.click(weight);
  calc = ui.topDialog();
  for (const key of ['6', '0', '−', '1', '4', ',', '5']) await ui.click(ui.button(key, calc));
  assert.equal(ui.query('.weight-live-result', calc).textContent, ' = 45,5');
  await ui.click(ui.button('Применить вес', calc));
  await ui.submit(ui.query('form', recipeDialog));
  assert.equal(ui.state().recipes[0].ingredients[0].grams, 45.5);
  await ui.click(ui.button('Выбрать блюдо Коктейль'));
  await ui.submit(ui.query('.portion-form'));
  await ui.click(ui.button('Редактировать запись Протеин'));
  const diaryDialog = ui.topDialog();
  await ui.click(ui.query('input[aria-label="Вес, г"]', diaryDialog));
  calc = ui.topDialog();
  for (const key of ['+', '4', ',', '5']) await ui.click(ui.button(key, calc));
  await ui.click(ui.button('Применить вес', calc));
  await ui.submit(ui.query('form', diaryDialog));
  const date = ui.query('input[type="date"]').value;
  assert.equal(ui.state().dailyLogs[date][0].grams, 50);
  assert.equal(ui.state().recipes[0].ingredients[0].grams, 45.5);
});
