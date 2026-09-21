export const CATEGORIES = Object.freeze([
  { id: 'meat', label: 'Мясо и птица' },
  { id: 'fish', label: 'Рыба и морепродукты' },
  { id: 'dairy', label: 'Молочные продукты' },
  { id: 'eggs', label: 'Яйца' },
  { id: 'grains', label: 'Крупы и хлеб' },
  { id: 'vegetables', label: 'Овощи и зелень' },
  { id: 'fruits', label: 'Фрукты и ягоды' },
  { id: 'legumes', label: 'Бобовые' },
  { id: 'nuts', label: 'Орехи и семена' },
  { id: 'oils', label: 'Масла и соусы' },
  { id: 'sweets', label: 'Сладости и выпечка' },
  { id: 'drinks', label: 'Напитки' },
  { id: 'prepared', label: 'Готовые блюда' },
  { id: 'other', label: 'Другое' },
]);

export const DEFAULT_GOALS = Object.freeze({ calories: 2000, protein: 160, fat: 65, carbs: 135 });
export const DEFAULT_FOODS = Object.freeze([
  { id: '1', name: 'Куриное филе', calories: 113, protein: 23.6, fat: 1.9, carbs: 0, category: 'meat', createdAt: '' },
  { id: '2', name: 'Гречка варёная', calories: 132, protein: 4.5, fat: 1.3, carbs: 25, category: 'grains', createdAt: '' },
  { id: '3', name: 'Яйцо варёное', calories: 155, protein: 12.6, fat: 10.6, carbs: 1.1, category: 'eggs', createdAt: '' },
  { id: '4', name: 'Творог 5%', calories: 121, protein: 17, fat: 5, carbs: 1.8, category: 'dairy', createdAt: '' },
  { id: '5', name: 'Огурец', calories: 15, protein: 0.8, fat: 0.1, carbs: 2.8, category: 'vegetables', createdAt: '' },
].map(Object.freeze));

const nutrientKeys = ['calories', 'protein', 'fat', 'carbs'];
const nutrientLabels = { calories: 'калории', protein: 'белки', fat: 'жиры', carbs: 'углеводы' };
const aliases = {
  name: ['name', 'title', 'product', 'название', 'продукт'],
  calories: ['calories', 'kcal', 'ккал', 'калории', 'калорийность'],
  protein: ['protein', 'proteins', 'белки', 'белок', 'б'],
  fat: ['fat', 'fats', 'жиры', 'жир', 'ж'],
  carbs: ['carbs', 'carbohydrates', 'углеводы', 'углевод', 'у'],
};
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const labelOf = value => String(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');

export const MEASUREMENT_FIELDS = [
  { id: 'weight', label: 'Вес', unit: 'кг', group: 'main', chart: 'weight', color: '#34d399', max: 600 },
  { id: 'fatPercent', label: 'Жир', unit: '%', group: 'main', chart: 'percent', color: '#fbbf24', max: 100, zero: true },
  { id: 'musclePercent', label: 'Мышцы', unit: '%', group: 'main', chart: 'percent', color: '#a5b4fc', max: 100, zero: true },
  { id: 'muscleMass', label: 'Мышечная масса', unit: 'кг', group: 'main', chart: 'mass', color: '#a5b4fc', max: 400 },
  { id: 'waterPercent', label: 'Вода', unit: '%', group: 'main', chart: 'percent', color: '#7dd3fc', max: 100, zero: true },
  { id: 'waist', label: 'Живот на уровне пупка', short: 'Живот', unit: 'см', group: 'size', chart: 'size', color: '#34d399', max: 400 },
  { id: 'chest', label: 'Грудь', unit: 'см', group: 'size', chart: 'size', color: '#7dd3fc', max: 400 },
  { id: 'hips', label: 'Бёдра (обхват таза)', short: 'Бёдра', unit: 'см', group: 'size', chart: 'size', color: '#fbbf24', max: 400 },
  { id: 'bicepsLeft', label: 'Бицепс слева', unit: 'см', group: 'size', chart: 'size', color: '#a5b4fc', max: 150 },
  { id: 'bicepsRight', label: 'Бицепс справа', unit: 'см', group: 'size', chart: 'size', color: '#f9a8d4', max: 150 },
  { id: 'thighLeft', label: 'Бедро слева', unit: 'см', group: 'size', chart: 'size', color: '#fb923c', max: 200 },
  { id: 'thighRight', label: 'Бедро справа', unit: 'см', group: 'size', chart: 'size', color: '#c4b5fd', max: 200 },
  { id: 'neck', label: 'Шея', unit: 'см', group: 'size', chart: 'size', color: '#67e8f9', max: 150 },
  { id: 'boneMass', label: 'Костная масса', unit: 'кг', group: 'extra', chart: 'mass', color: '#fbbf24', max: 100 },
  { id: 'visceralFat', label: 'Висцеральный жир', unit: 'ур.', group: 'extra', chart: 'visceral', color: '#fb923c', max: 100 },
  { id: 'bmr', label: 'Основной обмен', unit: 'ккал', group: 'extra', chart: 'bmr', color: '#7dd3fc', max: 10000 },
];

export function normalizeMeasurement(value) {
  if (!isRecord(value)) throw new Error('Замеры должны быть объектом.');
  const result = {};
  for (const field of MEASUREMENT_FIELDS) {
    const raw = value[field.id];
    if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) continue;
    const parsed = number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || (!field.zero && parsed === 0) || parsed > field.max) {
      throw new Error(`${field.label}: укажите число ${field.zero ? 'от 0' : 'больше 0'} до ${field.max} ${field.unit}.`);
    }
    result[field.id] = parsed;
  }
  if (!Object.keys(result).length) throw new Error('Заполните хотя бы один показатель.');
  if (value.note !== undefined && value.note !== null) {
    if (typeof value.note !== 'string' || value.note.length > 500) throw new Error('Заметка: не больше 500 символов.');
    if (value.note.trim()) result.note = value.note.trim();
  }
  return result;
}

export function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const text = value.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function round(value, digits = 1) {
  const parsed = number(value);
  if (!Number.isFinite(parsed)) return NaN;
  const factor = 10 ** digits;
  return Math.round((parsed + Number.EPSILON) * factor) / factor;
}

function validNumber(value, label, { positive = false } = {}) {
  const parsed = number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (positive && parsed === 0)) {
    throw new Error(`${label}: укажите ${positive ? 'положительное' : 'неотрицательное'} число.`);
  }
  return parsed;
}

export function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function localDate(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('Некорректная дата.');
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Некорректная дата дневника.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  if (localDate(date) !== value) throw new Error(`Некорректная дата дневника: ${value}.`);
  return date;
}

export function shiftDate(date, offset) {
  if (!Number.isInteger(offset)) throw new Error('Сдвиг даты должен быть целым числом.');
  const value = parseDate(date);
  value.setDate(value.getDate() + offset);
  return localDate(value);
}

export function displayDate(date) {
  const parsed = parseDate(date);
  const today = localDate();
  if (date === today) return 'Сегодня';
  if (date === shiftDate(today, -1)) return 'Вчера';
  if (date === shiftDate(today, 1)) return 'Завтра';
  return parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) });
}

function lowerKeys(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.toLocaleLowerCase('ru'), item]));
}

function pick(value, keys) {
  for (const key of keys) {
    if (Object.hasOwn(value, key) && value[key] !== null && value[key] !== undefined && value[key] !== '') return value[key];
  }
  return undefined;
}

function inferCategory(name) {
  const text = labelOf(name);
  const rules = [
    ['prepared', /суп|борщ|плов|пицц|салат|пельмен|котлет|сэндвич|шаурм|рагу|лазан/],
    ['sweets', /торт|печень[еяю]|конфет|шоколад|морожен|пирож|булоч|круассан|варень|джем|(?:^|[^а-яa-z])мед(?:$|[^а-яa-z])/],
    ['oils', /масло|соус|майонез|кетчуп/],
    ['dairy', /творог|молоко|кефир|йогурт|ряженк|сметан|сливки|сыр/],
    ['eggs', /яйц|яич|омлет/],
    ['fish', /рыб|лосос|семг|форел|тунец|треск|минтай|скумбр|сельд|кревет|миди|кальмар|икра/],
    ['meat', /куриц|курин|индей|говядин|свинин|баранин|мясо|кролик|ветчин|колбас|сосиск|печень(?:\s|$)/],
    ['legumes', /чечевиц|фасол|горох|нут(?:\s|$)|соя|тофу/],
    ['nuts', /орех|миндал|фисташ|фундук|арахис|кешью|семеч|семена|кунжут/],
    ['grains', /греч|рис(?:\s|$)|овсян|овсян|хлопья|пшено|перлов|булгур|макарон|хлеб|круп|киноа|паста/],
    ['vegetables', /огур|помидор|томат|капуст|морков|кабач|баклаж|перец|свекл|картоф|зелень|шпинат|брокколи|лук|чеснок|гриб/],
    ['fruits', /яблок|банан|груш|апельсин|мандарин|персик|абрикос|слива|виноград|клубник|малин|черник|ягод|киви|авокад|лимон|арбуз|дыня/],
    ['drinks', /чай|кофе|сок|вода|напиток|компот|лимонад|какао/],
  ];
  return rules.find(([, regex]) => regex.test(text))?.[0] || 'other';
}

function normalizeCategory(value, name) {
  if (value === undefined || value === null || value === '') return inferCategory(name);
  if (typeof value !== 'string' || value.trim().length > 80) throw new Error('Некорректная категория продукта.');
  const category = value.trim();
  if (!category) return inferCategory(name);
  return CATEGORIES.find(item => labelOf(item.id) === labelOf(category) || labelOf(item.label) === labelOf(category))?.id || category;
}

function timestamp(value, fallback = '') {
  const raw = value === undefined || value === null || value === '' ? fallback : value;
  if (raw === '') return '';
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(raw) || !Number.isFinite(Date.parse(raw))) throw new Error('Некорректное время добавления.');
  return new Date(raw).toISOString();
}

function identifier(value, label, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${label}: отсутствует идентификатор.`);
    return makeId();
  }
  if (!['string', 'number'].includes(typeof value) || !String(value).trim() || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`${label}: некорректный идентификатор.`);
  return String(value);
}

export function normalizeFood(value, { fallbackCreatedAt = '', strict = false } = {}) {
  try {
    if (!isRecord(value)) throw new Error('Продукт должен быть объектом.');
    const item = lowerKeys(value);
    const nested = pick(item, ['per100g', 'per_100g', 'per100', 'nutrition_per_100g', 'nutrition', 'macros', 'на 100 г']);
    if (nested !== undefined && !isRecord(nested)) throw new Error('КБЖУ на 100 г должны быть объектом.');
    const source = nested ? lowerKeys(nested) : item;
    const rawName = pick(item, aliases.name) ?? pick(source, aliases.name);
    if (typeof rawName !== 'string' || !rawName.trim()) throw new Error('У продукта отсутствует название.');
    const name = rawName.trim();
    const nutrients = Object.fromEntries(nutrientKeys.map(key => [key, validNumber(pick(source, aliases[key]), `«${name}», ${nutrientLabels[key]}`)]));
    return {
      id: identifier(item.id, `«${name}»`), name, ...nutrients,
      category: normalizeCategory(pick(item, ['category', 'категория']) ?? pick(source, ['category', 'категория']), name),
      createdAt: timestamp(item.createdat, fallbackCreatedAt),
    };
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}

export function calculate(food, grams) {
  if (!isRecord(food)) throw new Error('Выберите продукт.');
  const amount = validNumber(grams, 'Вес');
  return Object.fromEntries(nutrientKeys.map(key => {
    const value = validNumber(food[key], nutrientLabels[key]) * amount / 100;
    if (!Number.isFinite(value)) throw new Error('Слишком большое значение веса или КБЖУ.');
    return [key, round(value, key === 'calories' ? 0 : 1)];
  }));
}

function normalizeLog(value, date, index) {
  const label = `Запись ${index + 1} за ${date}`;
  if (!isRecord(value)) throw new Error(`${label}: неверный формат.`);
  if (typeof value.foodName !== 'string' || !value.foodName.trim()) throw new Error(`${label}: отсутствует название продукта.`);
  const grams = validNumber(value.grams, `${label}, вес`, { positive: true });
  const nutrients = Object.fromEntries(nutrientKeys.map(key => {
    const totalKey = `total${key[0].toUpperCase()}${key.slice(1)}`;
    return [totalKey, validNumber(value[totalKey], `${label}, ${nutrientLabels[key]}`)];
  }));
  const log = {
    id: identifier(value.id, label, { required: true }),
    foodId: identifier(value.foodId, label, { required: true }),
    foodName: value.foodName.trim(), grams, ...nutrients,
    createdAt: timestamp(value.createdAt),
  };
  if (value.meal !== undefined && value.meal !== null && value.meal !== '') {
    if (typeof value.meal !== 'string' || !value.meal.trim() || value.meal.length > 80) throw new Error(`${label}: название приёма пищи должно содержать от 1 до 80 символов.`);
    log.meal = value.meal.trim();
  }
  if (value.nutritionPer100 !== undefined) {
    if (!isRecord(value.nutritionPer100)) throw new Error(`${label}: неверные КБЖУ на 100 г.`);
    log.nutritionPer100 = Object.fromEntries(nutrientKeys.map(key => [key, validNumber(value.nutritionPer100[key], `${label}, ${nutrientLabels[key]} на 100 г`)]));
  } else {
    log.nutritionPer100 = Object.fromEntries(nutrientKeys.map(key => {
      const totalKey = `total${key[0].toUpperCase()}${key.slice(1)}`;
      return [key, validNumber(nutrients[totalKey] / grams * 100, `${label}, ${nutrientLabels[key]} на 100 г`)];
    }));
  }
  return log;
}

/** Validate a complete backup before returning any replacement state. Never mutates its input. */
export function validateBackup(input) {
  let value = input;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { throw new Error('Не удалось прочитать резервную копию: некорректный JSON.'); }
  }
  if (!isRecord(value)) throw new Error('Резервная копия должна быть объектом.');
  if (!isRecord(value.goals)) throw new Error('В резервной копии отсутствуют корректные цели КБЖУ.');
  if (!Array.isArray(value.foods)) throw new Error('Список продуктов в резервной копии должен быть массивом.');
  if (!isRecord(value.dailyLogs)) throw new Error('Дневник в резервной копии должен быть объектом с датами.');
  const goals = Object.fromEntries(nutrientKeys.map(key => [key, validNumber(value.goals[key], `Цель: ${nutrientLabels[key]}`)]));
  const foodIds = new Set();
  const foods = value.foods.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Продукт ${index + 1}: неверный формат.`);
    identifier(item.id, `Продукт ${index + 1}`, { required: true });
    const food = normalizeFood(item, { strict: true });
    if (foodIds.has(food.id)) throw new Error(`Повторяющийся идентификатор продукта «${food.name}».`);
    foodIds.add(food.id);
    return food;
  });
  const dailyLogs = Object.fromEntries(Object.entries(value.dailyLogs).map(([date, rawLogs]) => {
    parseDate(date);
    if (!Array.isArray(rawLogs)) throw new Error(`Записи за ${date} должны быть массивом.`);
    const ids = new Set();
    const logs = rawLogs.map((entry, index) => {
      const log = normalizeLog(entry, date, index);
      if (ids.has(log.id)) throw new Error(`Повторяющийся идентификатор записи за ${date}.`);
      ids.add(log.id);
      return log;
    });
    return [date, logs];
  }));
  const rawFavorites = value.favorites ?? [];
  if (!Array.isArray(rawFavorites) || rawFavorites.some(id => typeof id !== 'string')) throw new Error('Некорректный список избранных продуктов.');
  const favorites = [...new Set(rawFavorites)].filter(id => foodIds.has(id));
  const rawMeasurements = value.measurements ?? {};
  if (!isRecord(rawMeasurements)) throw new Error('Замеры должны быть объектом с датами.');
  const measurements = Object.fromEntries(Object.entries(rawMeasurements).map(([date, record]) => {
    parseDate(date);
    return [date, normalizeMeasurement(record)];
  }));
  return { goals, foods, dailyLogs, favorites, measurements };
}

function unwrapProducts(value, depth = 0) {
  if (depth > 6) throw new Error('Слишком много вложенных объектов в JSON.');
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) throw new Error('JSON должен содержать продукт или список продуктов.');
  const item = lowerKeys(value);
  for (const key of ['products', 'foods', 'items', 'продукты', 'data', 'result']) {
    if (Object.hasOwn(item, key)) return unwrapProducts(item[key], depth + 1);
  }
  return [value];
}

function parseProductText(raw) {
  const text = raw.replace(/\*\*/g, '').replace(/≈/g, ' ').replace(/\u00a0/g, ' ').trim();
  const nameMatch = text.match(/(?:^|\n)\s*(?:продукт|название)\s*[:—-]\s*([^\n]+)/i);
  let name = nameMatch?.[1]?.trim();
  if (!name) {
    name = text.split(/\n/).map(line => line.replace(/^\s*[#*-]+\s*/, '').trim()).find(line => line && !/^(?:на\s+\d|ккал|калори|белк|жир|углевод|кбжу|бжу|категория)/i.test(line) && !/\d\s*(?:ккал|кдж)/i.test(line));
  }
  if (!name || name.length > 200) throw new Error('Не найдено название продукта. Укажите его первой строкой.');
  const per100 = text.match(/на\s*100\s*(?:грамм(?:ов|а)?|гр?)(?![а-яё])/i);
  let working = per100 ? text.slice(per100.index + per100[0].length) : text;
  if (per100) working = working.split(/\n\s*на\s*(?:\d+|одн|порц)/i)[0];
  else if (/на\s*(?:\d+(?:[.,]\d+)?\s*(?:г|мл|порц)|одн|порц)/i.test(text)) throw new Error('Укажите КБЖУ на 100 г, а не на порцию.');
  const decimal = '([+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+))';
  const labels = {
    calories: '(?:калорийность|калории|калорий|ккал)', protein: '(?:белки|белка|белков|белок|б)',
    fat: '(?:жиры|жира|жиров|жир|ж)', carbs: '(?:углеводы|углеводов|углевод|у)',
  };
  const nutrients = {};
  for (const key of nutrientKeys) {
    const prefix = '(?:^|[^а-яёa-z])';
    const unit = key === 'calories' ? '(?:ккал)?' : '(?:граммов|грамма|грамм|гр|г)?';
    // Keep a number and its label on the same line: «Белки: 23 г\nЖиры»
    // must not also be interpreted as «23 г Жиры».
    const after = new RegExp(`${prefix}${labels[key]}[ \\t]*(?:[|:=—][ \\t]*|[-][ \\t]+)?${decimal}[ \\t]*${unit}(?![\\d.,а-яёa-z])`, 'ig');
    const before = new RegExp(`${prefix}${decimal}[ \\t]*(?:${key === 'calories' ? '' : '(?:гр|г)[ \\t]*'})${labels[key]}(?![а-яёa-z])`, 'ig');
    const values = [...working.matchAll(after), ...working.matchAll(before)].map(match => number(match[1]));
    const unique = [...new Set(values)];
    if (unique.length !== 1 || !Number.isFinite(unique[0]) || unique[0] < 0) throw new Error(`Не удалось однозначно определить ${nutrientLabels[key]}. Укажите все четыре значения с подписями: ккал, белки, жиры, углеводы.`);
    nutrients[key] = unique[0];
  }
  const category = text.match(/(?:^|\n)\s*категория\s*[:—-]\s*([^\n]+)/i)?.[1]?.trim();
  return normalizeFood({ name, ...nutrients, category }, { strict: true });
}

/** Parse all products, or throw; partial imports are never silently accepted. */
export function parseProducts(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Вставьте текст или JSON с продуктами.');
  const raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || raw).trim();
  const first = /^[\[{]/.test(candidate) ? 0 : candidate.search(/\{\s*"|\[\s*(?:\{|\])/);
  if (first !== -1) {
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    let parsed;
    try { parsed = JSON.parse(candidate.slice(first, end + 1)); } catch { throw new Error('Не удалось прочитать JSON. Проверьте скобки, кавычки и запятые.'); }
    const list = unwrapProducts(parsed);
    if (!list.length) throw new Error('В JSON нет продуктов.');
    return list.map((item, index) => {
      try { return normalizeFood(item, { strict: true }); } catch (error) { throw new Error(`Продукт ${index + 1}: ${error.message}`); }
    });
  }
  return [parseProductText(candidate)];
}

export function productUsage(dailyLogs) {
  const usage = Object.create(null);
  if (!isRecord(dailyLogs)) return usage;
  for (const [date, entries] of Object.entries(dailyLogs)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || entry.foodId === undefined || entry.foodId === null) continue;
      const id = String(entry.foodId);
      const current = usage[id] || { count: 0, lastUsed: '' };
      const created = typeof entry.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt)) ? new Date(entry.createdAt).toISOString() : '';
      // The diary date is authoritative when a meal was entered later or in advance.
      const time = `${date}T${created ? created.slice(11) : '00:00:00.000Z'}`;
      usage[id] = { count: current.count + 1, lastUsed: current.lastUsed > time ? current.lastUsed : time };
    }
  }
  return usage;
}

export const MEAL_NAMES = ['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Приём пищи'];
export const mealKey = name => labelOf(name || '').trim();

export function groupMeals(logs) {
  const groups = new Map();
  for (const log of logs) {
    const key = mealKey(log.meal);
    if (!groups.has(key)) groups.set(key, { key, name: log.meal || 'Без группы', meal: log.meal || '', logs: [], totals: Object.fromEntries(nutrientKeys.map(key => [key, 0])) });
    const group = groups.get(key);
    group.logs.push(log);
    for (const key of nutrientKeys) group.totals[key] += log[`total${key[0].toUpperCase()}${key.slice(1)}`];
  }
  return [...groups.values()];
}

export function rankFoods(foods, dailyLogs, { query = '', category = 'all', mode = 'all', limit } = {}) {
  const usage = productUsage(dailyLogs);
  const terms = labelOf(query.trim()).split(/\s+/).filter(Boolean);
  const ranked = foods.map((food, index) => ({ food, index })).filter(({ food }) =>
    (category === 'all' || food.category === category) && terms.every(term => labelOf(food.name).includes(term)) &&
    (mode !== 'frequent' || usage[food.id]?.count > 0));
  ranked.sort((a, b) => {
    if (mode === 'recent') {
      const difference = (Date.parse(b.food.createdAt) || 0) - (Date.parse(a.food.createdAt) || 0);
      return difference || a.index - b.index;
    }
    if (mode === 'frequent') {
      const aUse = usage[a.food.id];
      const bUse = usage[b.food.id];
      return bUse.count - aUse.count || bUse.lastUsed.localeCompare(aUse.lastUsed) || a.food.name.localeCompare(b.food.name, 'ru') || a.index - b.index;
    }
    return a.food.name.localeCompare(b.food.name, 'ru') || a.index - b.index;
  });
  const result = ranked.map(item => item.food);
  return Number.isInteger(limit) && limit >= 0 ? result.slice(0, limit) : result;
}
