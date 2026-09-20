import { DEFAULT_FOODS, DEFAULT_GOALS, makeId, validateBackup } from './core.mjs';

export const BASE_KEY = 'diet_nutrition_v3_base';
export const EVENT_PREFIX = 'diet_nutrition_v3_event:';
const LEGACY = { goals: 'diet_goals_v2', foods: 'diet_foods_v2', dailyLogs: 'diet_logs_v2' };

function decode(raw, label) {
  try { return JSON.parse(raw); }
  catch { throw new Error(`Не удалось прочитать ${label}. Исходные данные сохранены; восстановите резервную копию.`); }
}

export function applyEvent(state, event) {
  const p = event.payload;
  switch (event.type) {
    case 'replace': return validateBackup(p);
    case 'goals': return { ...state, goals: p };
    case 'foods': {
      const changes = new Map(p.map(food => [food.id, food]));
      return { ...state, foods: [
        ...p.filter(food => !state.foods.some(old => old.id === food.id)),
        ...state.foods.map(food => changes.get(food.id) || food)
      ] };
    }
    case 'deleteFood': return { ...state, foods: state.foods.filter(food => food.id !== p.id) };
    case 'log': {
      const logs = state.dailyLogs[p.date] || [];
      return { ...state, dailyLogs: { ...state.dailyLogs, [p.date]: logs.some(log => log.id === p.log.id)
        ? logs.map(log => log.id === p.log.id ? p.log : log) : [...logs, p.log] } };
    }
    case 'deleteLog': return { ...state, dailyLogs: {
      ...state.dailyLogs, [p.date]: (state.dailyLogs[p.date] || []).filter(log => log.id !== p.id)
    } };
    default: throw new Error('Неизвестный формат сохранённых изменений. Обновите приложение.');
  }
}

// Each committed action has its own key: another tab cannot overwrite a whole diary.
// Legacy keys are never changed. The journal also keeps pre-import data recoverable.
export function createStore(storage) {
  function base() {
    const saved = storage.getItem(BASE_KEY);
    if (saved !== null) return validateBackup(decode(saved, 'дневник'));
    const data = { goals: DEFAULT_GOALS, foods: DEFAULT_FOODS, dailyLogs: {} };
    for (const [field, key] of Object.entries(LEGACY)) {
      const raw = storage.getItem(key);
      if (raw !== null) data[field] = decode(raw, 'прежний дневник');
    }
    return validateBackup(data);
  }
  function events() {
    const result = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(EVENT_PREFIX)) continue;
      const event = decode(storage.getItem(key), 'изменения дневника');
      if (!event || typeof event.id !== 'string' || !Number.isFinite(event.at)) {
        throw new Error('Повреждена запись изменений. Исходные данные не перезаписаны.');
      }
      result.push(event);
    }
    return result.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  }
  function read() {
    return validateBackup(events().reduce(applyEvent, base()));
  }
  function commit(type, payload) {
    const currentEvents = events();
    const original = base();
    const current = currentEvents.reduce(applyEvent, original);
    const event = { id: makeId(), at: Math.max(Date.now(), (currentEvents.at(-1)?.at || 0) + 1), type, payload };
    validateBackup(applyEvent(current, event));
    try {
      if (storage.getItem(BASE_KEY) === null) storage.setItem(BASE_KEY, JSON.stringify(original));
      storage.setItem(EVENT_PREFIX + event.id, JSON.stringify(event));
    } catch {
      throw new Error('Не удалось сохранить изменение в браузере. Оно не применено. Скачайте резервную копию и проверьте свободное место.');
    }
    return read();
  }
  function rawBackup() {
    const result = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === BASE_KEY || key?.startsWith(EVENT_PREFIX) || Object.values(LEGACY).includes(key)) result[key] = storage.getItem(key);
    }
    return result;
  }
  function recover(input) {
    const data = validateBackup(input);
    // Preserve the original bytes before replacing an unreadable store.
    storage.setItem(`diet_nutrition_recovery:${makeId()}`, JSON.stringify(rawBackup()));
    const keys = [];
    for (let i = 0; i < storage.length; i++) if (storage.key(i)?.startsWith(EVENT_PREFIX)) keys.push(storage.key(i));
    storage.setItem(BASE_KEY, JSON.stringify(data));
    keys.forEach(key => storage.removeItem(key));
    return read();
  }
  return { read, commit, rawBackup, recover };
}
