import React, { useEffect, useMemo, useRef, useState } from 'react';
import { rankFoods, normalizeFood, parseProducts } from './core.mjs';

const format = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

export function FavoriteButton({ food, active, onToggle }) {
  return <button type="button" className={`favorite-button ${active ? 'active' : ''}`} aria-label={`${active ? 'Убрать' : 'Добавить'} ${food.name} ${active ? 'из избранного' : 'в избранное'}`} aria-pressed={active} onClick={() => onToggle(food.id, !active)}><span aria-hidden="true">{active ? '★' : '☆'}</span></button>;
}

export function QuickFoods({ foods, dailyLogs, favorites, selected, onSelect, onFavorite, onAdd }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(() => favorites.length ? 'favorites' : 'frequent');
  const track = useRef(null);
  const searching = Boolean(query.trim());
  const result = useMemo(() => {
    if (query.trim()) return rankFoods(foods, dailyLogs, { query });
    if (mode === 'frequent') return rankFoods(foods, dailyLogs, { mode: 'frequent' });
    return favorites.map(id => foods.find(food => food.id === id)).filter(Boolean);
  }, [foods, dailyLogs, favorites, mode, query]);
  useEffect(() => { if (track.current) track.current.scrollLeft = 0; }, [query, mode]);
  return <div className="quick-foods">
    <label className="search-label"><span className="sr-only">Поиск продукта по всей базе</span><input type="search" placeholder="Быстрый поиск продукта…" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" /></label>
    <div className="quick-food-modes" role="group" aria-label="Быстрый выбор продуктов">{[['favorites', 'Избранное'], ['frequent', 'Часто используемые']].map(([id, label]) => <button type="button" key={id} className={`chip ${!searching && mode === id ? 'active' : ''}`} aria-pressed={!searching && mode === id} onClick={() => { setMode(id); setQuery(''); }}>{id === 'favorites' && <span aria-hidden="true">★ </span>}{label}</button>)}</div>
    <div className="quick-food-caption"><span>{searching ? `Найдено: ${result.length}` : mode === 'favorites' ? `Избранных: ${result.length}` : `Продуктов: ${result.length}`}</span>{result.length > 1 && <span>Листайте вбок →</span>}</div>
    {!result.length ? <div className="quick-food-empty"><p>{searching ? 'Ничего не найдено. Попробуйте другое название.' : mode === 'favorites' ? 'Найдите продукт и нажмите ☆ — он появится здесь.' : 'Здесь появятся продукты, которые вы чаще добавляете в дневник. Начните с поиска.'}</p>{(!foods.length || searching) && <button type="button" className="text-button" onClick={onAdd}>＋ Новый продукт</button>}</div> : <div ref={track} className="food-carousel" tabIndex="0" role="region" aria-label={searching ? 'Результаты поиска продуктов' : mode === 'favorites' ? 'Избранные продукты' : 'Часто используемые продукты'}>
      {result.map(food => <article className={`food-tile ${selected.includes(food.id) ? 'selected' : ''}`} key={food.id}>
        <FavoriteButton food={food} active={favorites.includes(food.id)} onToggle={onFavorite} />
        <button type="button" className="food-select" aria-label={`Выбрать ${food.name}`} aria-pressed={selected.includes(food.id)} onClick={() => onSelect(food)}>
          <span className="food-title" title={food.name}>{food.name}</span><span className="food-tile-calories">{format(food.calories)} <small>ккал / 100 г</small></span><span className="food-tile-macros">Б {format(food.protein)} · Ж {format(food.fat)} · У {format(food.carbs)}</span><span className="food-tile-action">{selected.includes(food.id) ? '✓ Выбрано' : '＋ Выбрать'}</span>
        </button>
      </article>)}
    </div>}
  </div>;
}

export function QuickProductForm({ onSave, onCancel }) {
  const [mode, setMode] = useState('manual'), [text, setText] = useState('');
  const [draft, setDraft] = useState({ name: '', calories: '', protein: '', fat: '', carbs: '' });
  const [selectAfter, setSelectAfter] = useState(true), [error, setError] = useState('');
  const clipboardRequest = useRef(0);
  useEffect(() => () => { clipboardRequest.current++; }, []);
  const preview = useMemo(() => { try { return text.trim() ? parseProducts(text) : null; } catch { return null; } }, [text]);
  return <form className="form-stack" onSubmit={event => {
    event.preventDefault(); setError('');
    try {
      const items = mode === 'manual' ? [normalizeFood(draft, { strict: true })] : parseProducts(text);
      onSave(items, selectAfter);
    } catch (error) { setError(error.message); }
  }}>
    <div className="quick-food-modes" role="group" aria-label="Способ добавления продукта">{[['manual', 'Вручную'], ['import', 'JSON или текст']].map(([id, title]) => <button type="button" key={id} className={`chip ${mode === id ? 'active' : ''}`} aria-pressed={mode === id} onClick={() => { clipboardRequest.current++; setMode(id); setError(''); }}>{title}</button>)}</div>
    {mode === 'manual' ? <><label><span>Название продукта</span><input type="text" autoFocus required maxLength="200" placeholder="Например, йогурт" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><p className="hint">КБЖУ на 100 г · категорию определим автоматически.</p><div className="macro-inputs">{[['calories', 'Ккал'], ['protein', 'Белки, г'], ['fat', 'Жиры, г'], ['carbs', 'Углеводы, г']].map(([key, label]) => <label key={key}><span>{label}</span><input type="text" inputMode="decimal" required autoComplete="off" aria-label={label} value={draft[key]} placeholder="0" onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</div></> : <><label><span>Данные продукта на 100 г</span><textarea rows="5" autoFocus value={text} onChange={event => { clipboardRequest.current++; setText(event.target.value); }} placeholder={'Вставьте JSON или текст с названием и КБЖУ. Можно несколько продуктов сразу.'} /></label><button type="button" className="secondary" onClick={async () => {
      const request = ++clipboardRequest.current;
      try { if (!navigator.clipboard?.readText) throw new Error(); const value = await navigator.clipboard.readText(); if (request === clipboardRequest.current) { setText(value); setError(''); } }
      catch { if (request === clipboardRequest.current) setError('Вставьте данные вручную в поле выше.'); }
    }}>Вставить из буфера</button>{preview && <p className="hint" role="status">Распознано: {preview.map(food => food.name).join(', ')}</p>}</>}
    <label className="check-label"><input type="checkbox" checked={selectAfter} onChange={event => setSelectAfter(event.target.checked)} /><span>Сразу выбрать для дневника</span></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="secondary" onClick={onCancel}>Отмена</button><button type="submit" className="primary">{mode === 'import' && preview?.length > 1 ? 'Добавить продукты' : 'Добавить продукт'}</button></div>
  </form>;
}
