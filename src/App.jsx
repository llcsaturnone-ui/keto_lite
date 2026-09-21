import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CATEGORIES, localDate, shiftDate, displayDate, makeId, number, round,
  calculate, normalizeFood, validateBackup, parseProducts, rankFoods, productUsage, groupMeals, mealKey } from './core.mjs';
import { createStore, BASE_KEY, EVENT_PREFIX } from './storage.mjs';
import { Progress, MeasurementForm } from './Progress.jsx';
import { QuickFoods, FavoriteButton, QuickProductForm } from './QuickFoods.jsx';
import { MealPicker, MealNameForm } from './Meals.jsx';

const macroFields = [['calories', 'Ккал', 'ккал'], ['protein', 'Белки', 'г'], ['fat', 'Жиры', 'г'], ['carbs', 'Углеводы', 'г']];
const format = n => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const categoryName = id => CATEGORIES.find(c => c.id === id)?.label || id || 'Другое';
const emptyFood = { name: '', category: 'other', calories: '', protein: '', fat: '', carbs: '' };

function downloadJson(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const headingId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    dialog.addEventListener('cancel', cancel);
    function cancel(event) { event.preventDefault(); onClose(); }
    return () => { dialog.removeEventListener('cancel', cancel); dialog.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'settings-modal' : ''}`} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose();
  }} aria-labelledby={headingId}>
    <div className="modal-header"><h2 id={headingId}>{title}</h2><button type="button" className="icon-button" aria-label="Закрыть" onClick={onClose}>×</button></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}

function MacroInputs({ value, onChange, prefix, required = true }) {
  return <div className="macro-inputs">{macroFields.map(([key, label, unit]) => <label key={key} htmlFor={`${prefix}-${key}`}>
    <span>{label}{unit === 'г' ? ', г' : ''}</span>
    <input id={`${prefix}-${key}`} type="text" inputMode="decimal" required={required} autoComplete="off"
      value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} placeholder="0" className={`value-${key}`} />
  </label>)}</div>;
}

function FoodForm({ initial, categories, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial || emptyFood);
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault(); setError('');
    try {
      const saved = normalizeFood({ ...draft, createdAt: initial?.createdAt || new Date().toISOString() }, { strict: true });
      onSave(saved);
    } catch (e) { setError(e.message); }
  }
  return <form className="form-stack" onSubmit={submit}>
    <label><span>Название продукта</span><input autoFocus type="text" required maxLength="200" placeholder="Например, творог 5%" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <label><span>Категория</span><select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
      {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select></label>
    <p className="hint">Пищевая ценность на 100 г</p>
    <MacroInputs value={draft} onChange={setDraft} prefix="food" />
    {error && <p className="error" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="secondary" onClick={onCancel}>Отмена</button><button className="primary" type="submit">{initial ? 'Сохранить' : 'Добавить продукт'}</button></div>
  </form>;
}

function FoodBrowser({ foods, dailyLogs, categories, favorites = [], onFavorite, selected = [], onSelect, management = false, onEdit, onDelete, onAdd }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [mode, setMode] = useState('all');
  const [limit, setLimit] = useState(8);
  const used = useMemo(() => productUsage(dailyLogs), [dailyLogs]);
  const result = useMemo(() => rankFoods(foods, dailyLogs, { query, category, mode }), [foods, dailyLogs, query, category, mode]);
  const presentCategories = categories.filter(c => foods.some(food => food.category === c.id));
  useEffect(() => setLimit(8), [query, category, mode]);
  useEffect(() => { if (category !== 'all' && !foods.some(f => f.category === category)) setCategory('all'); }, [foods, category]);
  return <div className={`food-browser ${management ? '' : 'food-browser-picker'}`}>
    <label className="search-label"><span className="sr-only">Поиск продукта по названию</span><input type="search" placeholder="Найти продукт…" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" /></label>
    <div className="filter-modes" role="group" aria-label="Порядок продуктов">
      {[['all', 'Все'], ['recent', 'Недавно добавленные'], ['frequent', 'Часто используемые']].map(([id, title]) =>
        <button key={id} type="button" aria-pressed={mode === id} className={`chip ${mode === id ? 'active' : ''}`} onClick={() => setMode(id)}>{title}</button>)}
    </div>
    <div className="category-row"><label><span className="sr-only">Категория продуктов</span><select value={category} onChange={e => setCategory(e.target.value)}>
      <option value="all">Все категории</option>{presentCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select></label><span className="muted result-count">{result.length} продуктов</span></div>
    <div className="food-results">
      {!result.length && <div className="empty-state">
        <p>{!foods.length ? 'В базе пока нет продуктов' : mode === 'frequent' && !query && category === 'all' ? 'Здесь появятся продукты, которые вы добавляете в дневник' : 'Продукты не найдены'}</p>
        {!foods.length ? <button type="button" className="text-button" onClick={onAdd}>Добавить первый продукт</button> : <button type="button" className="text-button" onClick={() => { setQuery(''); setCategory('all'); setMode('all'); }}>Показать все продукты</button>}
      </div>}
      {result.slice(0, limit).map(food => <div className={`food-row ${selected.includes(food.id) ? 'selected' : ''}`} key={food.id}>
        <button type="button" className="food-select" onClick={() => management ? onEdit(food) : onSelect(food)} aria-pressed={management ? undefined : selected.includes(food.id)}>
          <span className="food-title">{food.name}</span>
          <span className="food-meta">{categoryName(food.category)}{mode === 'frequent' && used[food.id] ? ` · ${used[food.id].count} записей` : ''}</span>
          <span className="food-macros"><b>{format(food.calories)} ккал</b><span>Б {format(food.protein)}</span><span>Ж {format(food.fat)}</span><span>У {format(food.carbs)}</span><small>на 100 г</small></span>
        </button>
        {management ? <div className="row-actions"><FavoriteButton food={food} active={favorites.includes(food.id)} onToggle={onFavorite} /><button type="button" className="icon-button" aria-label={`Редактировать ${food.name}`} onClick={() => onEdit(food)}>✎</button><button type="button" className="icon-button danger-text" aria-label={`Удалить ${food.name}`} onClick={() => onDelete(food)}>×</button></div>
          : <button type="button" className="selection-dot" aria-label={`Выбрать ${food.name}`} aria-pressed={selected.includes(food.id)} onClick={() => onSelect(food)}>{selected.includes(food.id) ? '✓' : '+'}</button>}
      </div>)}
    </div>
    {result.length > limit && <button type="button" className="secondary more-button" onClick={() => setLimit(limit + 10)}>Показать ещё · {result.length - limit}</button>}
  </div>;
}

function Goals({ goals, onSave }) {
  const [draft, setDraft] = useState(goals), [error, setError] = useState('');
  useEffect(() => setDraft(goals), [goals.calories, goals.protein, goals.fat, goals.carbs]);
  return <form className="form-stack" onSubmit={e => {
    e.preventDefault(); setError('');
    try {
      const parsed = Object.fromEntries(macroFields.map(([k, label]) => { const n = number(draft[k]); if (!Number.isFinite(n) || n < 0) throw new Error(`${label}: укажите число от нуля.`); return [k, n]; }));
      onSave(parsed);
    } catch (e) { setError(e.message); }
  }}><MacroInputs prefix="goal" value={draft} onChange={setDraft} />
    <p className="hint">Значение 0 отключает цель для этого показателя.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <button type="submit" className="primary full">Сохранить цели</button>
  </form>;
}

function ImportProducts({ foods, onSave, onCancel }) {
  const [text, setText] = useState(''), [parsed, setParsed] = useState(null), [replace, setReplace] = useState(false), [error, setError] = useState('');
  const clipboardRequest = useRef(0);
  useEffect(() => () => { clipboardRequest.current++; }, []);
  const canonical = name => name.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const duplicates = parsed?.filter(item => foods.some(f => canonical(f.name) === canonical(item.name))).length || 0;
  function submit() {
    setError('');
    try {
      const pending = new Map();
      for (const item of parsed) {
        const key = canonical(item.name);
        if (pending.has(key)) throw new Error(`«${item.name}» повторяется в импорте. Оставьте один вариант.`);
        const old = foods.find(f => canonical(f.name) === key);
        if (old && !replace) continue;
        pending.set(key, { ...item, id: old?.id || makeId(), createdAt: old ? old.createdAt : new Date().toISOString() });
      }
      if (!pending.size) throw new Error('Все продукты уже есть в базе. Включите обновление или измените список.');
      onSave([...pending.values()]);
    } catch (e) { setError(e.message); }
  }
  return <div className="form-stack">
    <p className="hint">Вставьте один продукт с КБЖУ на 100 г или список продуктов в JSON. Категории определятся по названию; их можно изменить.</p>
    <label><span>Текст или JSON</span><textarea autoFocus rows="7" value={text} onChange={e => { clipboardRequest.current++; setText(e.target.value); setParsed(null); setError(''); }} placeholder={'Творог 5%\nКалории: 121\nБелки: 17\nЖиры: 5\nУглеводы: 1,8'} /></label>
    {!parsed && <div className="button-row"><button type="button" className="secondary" onClick={async () => {
      const request = ++clipboardRequest.current;
      try { if (!navigator.clipboard?.readText) throw new Error(); const value = await navigator.clipboard.readText(); if (request !== clipboardRequest.current) return; setText(value); setParsed(null); setError(''); }
      catch { if (request === clipboardRequest.current) setError('Вставьте текст вручную: браузер не предоставил доступ к буферу обмена.'); }
    }}>Из буфера</button><button type="button" className="primary" onClick={() => { clipboardRequest.current++; try { setParsed(parseProducts(text)); setError(''); } catch (e) { setError(e.message); } }}>Проверить</button></div>}
    {parsed && <>
      <p className="section-heading">Распознано: {parsed.length}</p>
      <div className="import-preview">{parsed.map((food, i) => <div key={i}><strong>{food.name}</strong><small>{categoryName(food.category)} · {format(food.calories)} ккал · Б {format(food.protein)} · Ж {format(food.fat)} · У {format(food.carbs)}</small></div>)}</div>
      {duplicates > 0 && <label className="check-label"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /><span>Обновить совпадения по названию ({duplicates}). Иначе они будут пропущены.</span></label>}
      <div className="button-row"><button type="button" className="secondary" onClick={onCancel}>Отмена</button><button type="button" className="primary" onClick={submit}>Добавить в базу</button></div>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </div>;
}

function EditLog({ log, foods, meals, onSave, onClose }) {
  const [grams, setGrams] = useState(String(log.grams)), [foodId, setFoodId] = useState(''), [error, setError] = useState('');
  const [meal, setMeal] = useState(log.meal || '');
  return <form className="form-stack" onSubmit={e => {
    e.preventDefault(); setError('');
    try {
      const amount = number(grams);
      if (!(amount > 0)) throw new Error('Укажите вес больше нуля.');
      const food = foodId ? foods.find(f => f.id === foodId) : null;
      if (foodId && !food) throw new Error('Этот продукт уже удалён. Выберите другой.');
      const snapshot = food || log.nutritionPer100;
      const total = calculate(snapshot, amount);
      onSave({ ...log, grams: amount, meal: meal.trim(), foodId: food?.id || log.foodId, foodName: food?.name || log.foodName,
        nutritionPer100: Object.fromEntries(macroFields.map(([k]) => [k, snapshot[k]])),
        ...Object.fromEntries(macroFields.map(([k]) => [`total${k[0].toUpperCase()}${k.slice(1)}`, total[k]])) });
    } catch (e) { setError(e.message); }
  }}>
    <label><span>Продукт</span><select value={foodId} onChange={e => setFoodId(e.target.value)}><option value="">{log.foodName} · как записано</option>{[...foods].sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(food => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label>
    <label><span>Вес, г</span><input autoFocus required type="text" inputMode="decimal" value={grams} onChange={e => setGrams(e.target.value)} /></label>
    <MealPicker value={meal} onChange={setMeal} meals={meals} />
    <p className="hint">Если меняется только вес, используются КБЖУ из сохранённой записи.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="secondary" onClick={onClose}>Отмена</button><button className="primary" type="submit">Сохранить</button></div>
  </form>;
}

function App() {
  const [store] = useState(() => { try { return createStore(window.localStorage); } catch { return null; } });
  const [initial] = useState(() => { try { if (!store) throw new Error('Браузер не разрешил сохранение данных.'); return { data: store.read(), error: '' }; } catch (e) { return { data: null, error: e.message }; } });
  const [data, setData] = useState(initial.data), [fatal, setFatal] = useState(initial.error);
  const [date, setDate] = useState(localDate), [today, setToday] = useState(localDate);
  const lastToday = useRef(localDate());
  const [settings, setSettings] = useState(false), [settingsView, setSettingsView] = useState('main');
  const [foodDraft, setFoodDraft] = useState(null), [editLog, setEditLog] = useState(null), [confirmation, setConfirmation] = useState(null);
  const [backup, setBackup] = useState(null), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [backupName, setBackupName] = useState(''), [backupLoading, setBackupLoading] = useState(false);
  const backupRequest = useRef(0);
  const [portions, setPortions] = useState([]);
  const [tab, setTab] = useState('diary'), [measurementEdit, setMeasurementEdit] = useState(null);
  const [mealName, setMealName] = useState('Приём пищи'), [mealEdit, setMealEdit] = useState(null), [quickProduct, setQuickProduct] = useState(false);
  const gramsRef = useRef(null), addRef = useRef(null);
  const noticeTimer = useRef(null);

  useEffect(() => {
    function sync() {
      const next = localDate();
      if (next !== lastToday.current) { const old = lastToday.current; lastToday.current = next; setToday(next); setDate(current => current === old ? next : current); }
    }
    const interval = setInterval(sync, 30000);
    window.addEventListener('focus', sync); document.addEventListener('visibilitychange', sync);
    return () => { clearInterval(interval); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); clearTimeout(noticeTimer.current); };
  }, []);
  useEffect(() => {
    function sync(event) {
      if (event.key && event.key !== BASE_KEY && !event.key.startsWith(EVENT_PREFIX)) return;
      try { if (store) { setData(store.read()); setFatal(''); } } catch (e) { setError(e.message); }
    }
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, [store]);
  useEffect(() => {
    function keepVisible(event) {
      if (!event.target.matches('input, textarea, select')) return;
      const target = event.target;
      setTimeout(() => { if (document.activeElement === target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 250);
    }
    document.addEventListener('focusin', keepVisible);
    return () => document.removeEventListener('focusin', keepVisible);
  }, []);
  function notify(text) { setNotice(text); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 4000); }
  function commit(type, payload) {
    const next = store.commit(type, payload); setData(next); setError(''); return next;
  }
  function doAction(type, payload, message) {
    try { commit(type, payload); if (message) notify(message); return true; }
    catch (e) { setError(e.message); return false; }
  }
  function openProducts() { setSettingsView('products'); setSettings(true); }
  function openNew() { setFoodDraft(null); setSettingsView('food'); setSettings(true); }
  async function readBackup(file) {
    if (!file) return;
    const request = ++backupRequest.current;
    setBackup(null); setBackupName(file.name); setBackupLoading(true); setError('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Резервная копия слишком большая: максимум 20 МБ.');
      const parsed = validateBackup(await file.text());
      if (request === backupRequest.current) setBackup(parsed);
    } catch (e) { if (request === backupRequest.current) setError(e.message); }
    finally { if (request === backupRequest.current) setBackupLoading(false); }
  }
  function cancelBackup() { backupRequest.current++; setBackup(null); setBackupName(''); setBackupLoading(false); }
  function saveBackup() { try { downloadJson({ version: 12, ...store.read(), exportedAt: new Date().toISOString() }, `nutrition-backup-${localDate()}.json`); } catch (e) { setError(e.message); } }
  function restore() {
    try { const next = fatal ? store.recover(backup) : store.commit('replace', backup); setData(next); setFatal(''); cancelBackup(); setPortions([]); setMeasurementEdit(null); setMealEdit(null); setError(''); notify('Резервная копия восстановлена'); }
    catch (e) { setError(e.message); }
  }
  const categories = useMemo(() => {
    const known = new Set(CATEGORIES.map(c => c.id));
    return [...CATEGORIES, ...[...new Set((data?.foods || []).map(f => f.category))].filter(c => !known.has(c)).map(c => ({ id: c, label: c }))];
  }, [data?.foods]);

  if (!data) return <main className="app recovery"><h1>Дневник питания</h1><section className="card form-stack"><h2>Не удалось открыть данные</h2><p>{fatal}</p><p className="hint">Сохранённые записи не были перезаписаны. Можно скачать исходные данные или загрузить исправную резервную копию.</p>
    <button className="secondary" onClick={() => { try { downloadJson(store.rawBackup(), 'nutrition-recovery.json'); } catch (e) { setError(e.message); } }}>Скачать исходные данные</button>
    <label className="file-button primary">Выбрать резервную копию<input type="file" accept=".json,application/json" onChange={e => { readBackup(e.target.files[0]); e.target.value = ''; }} /></label>
    {backup && <><p>Проверено: {backup.foods.length} продуктов, {Object.values(backup.dailyLogs).flat().length} записей.</p><button className="primary" onClick={restore}>Восстановить</button></>}
    {error && <p role="alert" className="error">{error}</p>}
  </section></main>;

  const { goals, foods, dailyLogs, favorites, measurements } = data;
  const toggleFavorite = (id, enabled) => doAction('favorite', { id, enabled });
  function openMeasurement(day) {
    try { setMeasurementEdit({ date: day, initial: store.read().measurements[day] || {} }); }
    catch (error) { setError(error.message); }
  }
  const logs = dailyLogs[date] || [];
  const totals = Object.fromEntries(macroFields.map(([key]) => [key, logs.reduce((sum, log) => sum + log[`total${key[0].toUpperCase()}${key.slice(1)}`], 0)]));
  const selected = portions.map(portion => ({ ...portion, food: foods.find(f => f.id === portion.id) }));
  let preview = null;
  if (selected.length && selected.every(portion => portion.food && number(portion.grams) > 0)) {
    try {
      const values = selected.map(portion => calculate(portion.food, portion.grams));
      preview = Object.fromEntries(macroFields.map(([key]) => [key, values.reduce((sum, value) => sum + value[key], 0)]));
    } catch {}
  }
  const sortedLogs = [...logs].reverse().sort((a,b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const mealGroups = groupMeals(sortedLogs);
  const mealNames = mealGroups.map(group => group.meal).filter(Boolean);

  function quickSaveFoods(items, selectAfter) {
    const fresh = store.read();
    const known = new Set(fresh.foods.map(food => mealKey(food.name)));
    const createdAt = new Date().toISOString();
    const pending = items.map(food => {
      const key = mealKey(food.name);
      if (known.has(key)) throw new Error(`«${food.name}» уже есть в базе или повторяется в списке. Найдите его через поиск.`);
      known.add(key);
      return { ...food, id: makeId(), createdAt };
    });
    commit('foods', pending);
    if (selectAfter) setPortions(current => [...current, ...pending.map(food => ({ id: food.id, name: food.name, grams: '100' }))]);
    setQuickProduct(false);
    notify(selectAfter ? 'Продукты добавлены. Укажите вес порций.' : `Добавлено продуктов: ${pending.length}`);
  }

  function saveFood(food) {
    const fresh = store.read();
    if (fresh.foods.some(f => f.id !== food.id && f.name.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е') === food.name.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е'))) throw new Error('Продукт с таким названием уже есть. Отредактируйте его или уточните название.');
    if (foodDraft && !fresh.foods.some(f => f.id === foodDraft.id)) throw new Error('Этот продукт удалён в другой вкладке. Добавьте его заново.');
    commit('foods', [{ ...food, id: foodDraft?.id || food.id, createdAt: foodDraft ? foodDraft.createdAt : food.createdAt }]);
    setSettingsView('products'); notify(foodDraft ? 'Продукт обновлён' : 'Продукт добавлен');
  }
  function toggleFood(food) {
    setPortions(current => current.some(portion => portion.id === food.id)
      ? current.filter(portion => portion.id !== food.id)
      : [...current, { id: food.id, name: food.name, grams: '100' }]);
    setError('');
  }
  function addFoods(e) {
    e.preventDefault(); setError('');
    try {
      if (!portions.length) throw new Error('Сначала выберите продукты.');
      if (!mealName.trim() || mealName.length > 80) throw new Error('Укажите название приёма пищи.');
      const freshFoods = new Map(store.read().foods.map(food => [food.id, food]));
      const createdAt = new Date().toISOString();
      const entries = portions.map(portion => {
        const food = freshFoods.get(portion.id);
        if (!food) throw new Error(`«${portion.name}» уже удалён из базы. Уберите его из выбранных продуктов.`);
        const amount = number(portion.grams);
        if (!(amount > 0)) throw new Error(`«${food.name}»: укажите вес больше нуля, например 150 или 150,5.`);
        const calc = calculate(food, amount);
        return { id: makeId(), createdAt, meal: mealName.trim(), foodId: food.id, foodName: food.name, grams: amount,
          nutritionPer100: Object.fromEntries(macroFields.map(([k]) => [k, food[k]])),
          ...Object.fromEntries(macroFields.map(([k]) => [`total${k[0].toUpperCase()}${k.slice(1)}`, calc[k]])) };
      });
      // Validate every portion first, then persist the whole meal in one action.
      commit('logs', { date, logs: entries });
      setPortions([]);
      notify(entries.length === 1 ? `Добавлено: ${entries[0].foodName}` : `Добавлено продуктов: ${entries.length}`);
    } catch (e) { setError(e.message); }
  }

  let settingTitle = settingsView === 'main' ? 'Настройки' : settingsView === 'products' ? 'Мои продукты' : settingsView === 'food' ? foodDraft ? 'Редактировать продукт' : 'Новый продукт' : 'Импорт продуктов';
  return <>
    <div className="app">
      <header className="app-header"><div><p className="eyebrow">ПИТАНИЕ КАЖДЫЙ ДЕНЬ</p><h1>{tab === 'diary' ? 'Дневник' : 'Прогресс'}</h1></div><button className="settings-button" type="button" onClick={() => { setSettingsView('main'); setSettings(true); }}><span aria-hidden="true">⚙</span> Настройки</button></header>
      <nav className="app-tabs" aria-label="Разделы приложения"><button type="button" className={tab === 'diary' ? 'active' : ''} aria-current={tab === 'diary' ? 'page' : undefined} onClick={() => setTab('diary')}>Дневник</button><button type="button" className={tab === 'progress' ? 'active' : ''} aria-current={tab === 'progress' ? 'page' : undefined} onClick={() => setTab('progress')}>↗ Прогресс</button></nav>
      <main className="main-content">
        <section className="date-nav" aria-label="Дата дневника"><button className="icon-button" aria-label="Предыдущий день" onClick={() => setDate(shiftDate(date,-1))}>‹</button><div><strong>{displayDate(date)}</strong><input type="date" aria-label="Выбрать дату дневника" value={date} onChange={e => { if (e.target.value) { try { shiftDate(e.target.value,0); setDate(e.target.value); } catch {} } }} /></div><button className="icon-button" aria-label="Следующий день" onClick={() => setDate(shiftDate(date,1))}>›</button></section>
        {date !== today && <button className="today-button" onClick={() => { setToday(localDate()); setDate(localDate()); }}>Вернуться к сегодняшнему дню</button>}
        <div hidden={tab !== 'diary'}>
        <section className="macro-cards" aria-label="КБЖУ за выбранный день">{macroFields.map(([key,label,unit]) => {
          const over = goals[key] > 0 && totals[key] > goals[key]; const pct = goals[key] ? Math.min(100, totals[key] / goals[key] * 100) : 0;
          return <div key={key} className={`macro-card macro-${key} ${over ? 'over' : ''}`}><p className="macro-label">{label}<span>{unit}</span></p><div className="macro-value">{format(round(totals[key],key === 'calories' ? 0 : 1))}<small> / {format(goals[key])}</small></div><div role="progressbar" aria-label={label} aria-valuenow={round(pct)} aria-valuemin="0" aria-valuemax="100" className="progress"><span style={{ width: `${pct}%` }} /></div><p className="macro-remaining">{goals[key] ? `${over ? 'Перебор' : 'Осталось'} ${format(round(Math.abs(goals[key] - totals[key]),key === 'calories' ? 0 : 1))} ${unit}` : 'Цель не задана'}</p></div>;
        })}</section>

        <section className="card" aria-labelledby="add-title"><div className="section-header"><h2 id="add-title">Добавить еду</h2><button className="text-button" onClick={() => setQuickProduct(true)}>＋ Продукт</button></div>
          <QuickFoods foods={foods} dailyLogs={dailyLogs} favorites={favorites} selected={portions.map(portion => portion.id)} onSelect={toggleFood} onFavorite={toggleFavorite} onAdd={() => setQuickProduct(true)} />
          {selected.length > 0 && <form ref={addRef} className="portion-form" onSubmit={addFoods}>
            <MealPicker value={mealName} onChange={setMealName} meals={mealNames} required />
            <div className="portion-list-heading"><span>Выбранные продукты</span><span>Вес, г</span></div>
            <div className="selected-portions">{selected.map((portion, index) => <div className="selected-portion" key={portion.id}>
              <label className="portion-name" htmlFor={`portion-${portion.id}`}>{portion.food?.name || portion.name}{!portion.food && <small className="danger-text">Удалён из базы</small>}</label>
              <input id={`portion-${portion.id}`} ref={index === 0 ? gramsRef : undefined} type="text" inputMode="decimal" required autoComplete="off" placeholder="100" aria-label={`Вес ${portion.food?.name || portion.name}, г`} value={portion.grams} onChange={e => setPortions(current => current.map(item => item.id === portion.id ? { ...item, grams: e.target.value } : item))} onFocus={e => e.target.select()} />
              <button type="button" className="icon-button" aria-label={`Убрать ${portion.food?.name || portion.name} из выбранных`} onClick={() => setPortions(current => current.filter(item => item.id !== portion.id))}>×</button>
            </div>)}</div>
            {preview && <p className="portion-preview"><span>Итого:</span><b>{format(preview.calories)} ккал</b><span>Б {format(preview.protein)}</span><span>Ж {format(preview.fat)}</span><span>У {format(preview.carbs)}</span></p>}
            <button className="primary full add-portions" type="submit">Добавить в дневник · {selected.length}</button>
          </form>}
        </section>

        <section className="card" aria-labelledby="eaten-title"><div className="section-header"><h2 id="eaten-title">Съедено</h2><span className="count-badge">{logs.length}</span></div>
          {!logs.length && <div className="empty-state"><p>Пока нет записей за этот день</p><small>Выберите продукты и укажите вес выше</small></div>}
          <div className="meal-groups">{mealGroups.map(group => <section className="meal-group" key={group.key} aria-label={`Приём пищи: ${group.name}`}><div className="meal-group-header"><h3>{group.name} <span>{group.logs.length}</span></h3><button type="button" className="text-button" aria-label={`Изменить группу ${group.name}`} onClick={() => setMealEdit({ date, group })}>{group.meal ? 'Изменить' : 'Объединить'}</button></div><p className="meal-totals"><strong>{format(round(group.totals.calories, 0))} ккал</strong><span>Б {format(group.totals.protein)}</span><span>Ж {format(group.totals.fat)}</span><span>У {format(group.totals.carbs)}</span></p>
            <details className="meal-products" open><summary>Продукты · {group.logs.length}</summary><div className="diary-list">{group.logs.map(log => <article className="diary-row" key={log.id}><div className="diary-product"><strong>{log.foodName}</strong><span>{format(log.grams)} г</span></div><div className="diary-nutrition"><b>{format(log.totalCalories)} <small>ккал</small></b><span>Б {format(log.totalProtein)} · Ж {format(log.totalFat)} · У {format(log.totalCarbs)}</span></div><div className="row-actions"><button className="icon-button" aria-label={`Редактировать запись ${log.foodName}`} onClick={() => setEditLog({ date, log })}>✎</button><button className="icon-button danger-text" aria-label={`Удалить запись ${log.foodName}`} onClick={() => setConfirmation({ kind: 'log', item: log, date })}>×</button></div></article>)}</div></details>
          </section>)}</div>
        </section>
        </div>
        <div hidden={tab !== 'progress'}><Progress records={measurements} date={date} onEdit={openMeasurement} onDelete={day => setConfirmation({ kind: 'measurement', date: day, item: { name: `Замеры за ${day.split('-').reverse().join('.')}` } })} /></div>
        <footer>Данные сохраняются на этом устройстве.<button className="text-button" onClick={saveBackup}>Скачать резервную копию</button><span className="app-version">Версия 12 · Прогресс и избранное</span></footer>
      </main>
    </div>
    <div className="notifications" aria-live="polite">{notice && <div className="toast">✓ {notice}</div>}{error && <div className="toast error" role="alert"><span>{error}</span><button type="button" className="icon-button" aria-label="Скрыть сообщение" onClick={() => setError('')}>×</button></div>}</div>

    {settings && <Modal title={settingTitle} wide onClose={() => { setSettings(false); cancelBackup(); }}>
      {settingsView !== 'main' && <button className="text-button back-button" onClick={() => setSettingsView(settingsView === 'food' || settingsView === 'import' ? 'products' : 'main')}>‹ {settingsView === 'food' || settingsView === 'import' ? 'К продуктам' : 'К настройкам'}</button>}
      {settingsView === 'main' && <div className="settings-sections">
        <section><h3>Дневные цели</h3><Goals goals={goals} onSave={value => { commit('goals',value); notify('Цели сохранены'); }} /></section>
        <section><div className="section-header"><h3>Мои продукты</h3><span className="count-badge">{foods.length}</span></div><p className="hint">Добавление, категории, редактирование и импорт.</p><button className="secondary full" onClick={() => setSettingsView('products')}>Управлять продуктами <span aria-hidden="true">→</span></button></section>
        <section><h3>Резервная копия</h3><p className="hint">Сохраните копию перед сменой браузера или устройства. Поддерживаются копии из прежней версии приложения.</p><div className="button-row"><button className="secondary" onClick={saveBackup}>Скачать</button><label className="file-button secondary">Загрузить<input type="file" accept=".json,application/json" onChange={e => { readBackup(e.target.files[0]); e.target.value = ''; }} /></label></div>
          {backupLoading && <p className="hint" role="status">Проверяю {backupName}…</p>}
          {backup && <div className="backup-preview"><strong>Копия проверена</strong><p className="hint">{backupName}</p><p>{backup.foods.length} продуктов · {Object.values(backup.dailyLogs).flat().length} записей · {Object.keys(backup.measurements).length} дней замеров · {backup.favorites.length} избранных</p><p className="hint">Восстановление заменит продукты, дневник, цели, замеры и избранное данными из копии. Сначала можно скачать текущую копию.</p><div className="button-row"><button className="secondary" onClick={cancelBackup}>Отмена</button><button className="primary" onClick={restore}>Восстановить</button></div></div>}
        </section>
      </div>}
      {settingsView === 'products' && <div className="form-stack"><div className="button-row"><button className="primary" onClick={openNew}>＋ Новый продукт</button><button className="secondary" onClick={() => setSettingsView('import')}>Импорт</button></div><FoodBrowser foods={foods} dailyLogs={dailyLogs} categories={categories} favorites={favorites} onFavorite={toggleFavorite} management onEdit={food => { setFoodDraft(food); setSettingsView('food'); }} onDelete={food => setConfirmation({ kind:'food', item:food })} onAdd={openNew} /></div>}
      {settingsView === 'food' && <FoodForm key={foodDraft?.id || 'new'} initial={foodDraft} categories={categories} onSave={saveFood} onCancel={() => setSettingsView('products')} />}
      {settingsView === 'import' && <ImportProducts foods={foods} onSave={items => { commit('foods',items); setSettingsView('products'); notify(`Добавлено или обновлено: ${items.length}`); }} onCancel={() => setSettingsView('products')} />}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}
    </Modal>}
    {quickProduct && <Modal title="Новый продукт" onClose={() => setQuickProduct(false)}><QuickProductForm onSave={quickSaveFoods} onCancel={() => setQuickProduct(false)} /></Modal>}
    {editLog && <Modal title="Редактировать запись" onClose={() => setEditLog(null)}><EditLog log={editLog.log} foods={foods} meals={groupMeals(dailyLogs[editLog.date] || []).map(group => group.meal)} onClose={() => setEditLog(null)} onSave={log => {
      const fresh = store.read();
      if (!(fresh.dailyLogs[editLog.date] || []).some(item => item.id === log.id)) throw new Error('Эта запись уже удалена в другой вкладке.');
      commit('log', { date:editLog.date, log }); setEditLog(null); notify('Запись обновлена');
    }} /></Modal>}
    {mealEdit && <Modal title="Группа приёма пищи" onClose={() => setMealEdit(null)}><MealNameForm initial={mealEdit.group.meal} meals={groupMeals(dailyLogs[mealEdit.date] || []).map(group => group.meal)} onClose={() => setMealEdit(null)} onSave={meal => {
      const current = store.read().dailyLogs[mealEdit.date] || [];
      const ids = current.filter(log => mealKey(log.meal) === mealEdit.group.key).map(log => log.id);
      if (!ids.length) throw new Error('Записи этой группы уже изменены. Закройте окно и выберите группу снова.');
      commit('assignMeal', { date: mealEdit.date, ids, meal }); setMealEdit(null); notify('Приём пищи обновлён');
    }} /></Modal>}
    {measurementEdit && <Modal title="Замеры тела" onClose={() => setMeasurementEdit(null)}><MeasurementForm date={measurementEdit.date} initial={measurementEdit.initial} onCancel={() => setMeasurementEdit(null)} onSave={patch => { commit('measurement', { date: measurementEdit.date, patch }); setMeasurementEdit(null); notify('Замеры сохранены'); }} /></Modal>}
    {confirmation && <Modal title={confirmation.kind === 'food' ? 'Удалить продукт?' : confirmation.kind === 'measurement' ? 'Удалить замеры?' : 'Удалить запись?'} onClose={() => setConfirmation(null)}><div className="form-stack"><p>«{confirmation.item.name || confirmation.item.foodName}»</p>{confirmation.kind === 'food' && <p className="hint">Записи об этом продукте в дневнике сохранятся.</p>}<div className="button-row"><button className="secondary" onClick={() => setConfirmation(null)}>Отмена</button><button className="danger" onClick={() => { if (doAction(confirmation.kind === 'food' ? 'deleteFood' : confirmation.kind === 'measurement' ? 'deleteMeasurement' : 'deleteLog', { id:confirmation.item.id, date:confirmation.date }, 'Удалено')) setConfirmation(null); }}>Удалить</button></div>{error && <p className="error" role="alert">{error}</p>}</div></Modal>}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
