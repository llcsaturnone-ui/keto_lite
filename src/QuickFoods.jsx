import React, { useEffect, useMemo, useRef, useState } from 'react';
import { rankFoods, normalizeFood, parseProducts } from './core.mjs';

const format = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

export function FavoriteButton({ food, active, onToggle }) {
  return <button type="button" className={`favorite-button ${active ? 'active' : ''}`} aria-label={`${active ? 'Убрать' : 'Добавить'} ${food.name} ${active ? 'из избранного' : 'в избранное'}`} aria-pressed={active} onClick={() => onToggle(food.id, !active)}><span aria-hidden="true">{active ? '★' : '☆'}</span></button>;
}

export function SearchField({ value, onChange, label = 'Поиск продукта по всей базе', placeholder = 'Быстрый поиск продукта…' }) {
  const ref = useRef(null);
  return <div className="search-label"><label><span className="sr-only">{label}</span><input ref={ref} type="search" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} autoComplete="off" /></label>{value !== '' && <button type="button" className="search-clear" aria-label="Очистить поиск" onClick={() => { onChange(''); ref.current?.focus(); }}>×</button>}</div>;
}

export function QuickFoods({ foods, favorites, selected = [], onSelect, onFavorite, onAdd, recipes = [], onRecipe, onEditRecipe, onCreateRecipe }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(() => favorites.length ? 'favorites' : 'all');
  const [page, setPage] = useState(0);
  const touch = useRef(null);
  const ready = mode === 'recipes';
  const result = useMemo(() => {
    if (mode === 'recipes') {
      const terms = query.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
      return [...recipes].filter(recipe => {
        const text = [recipe.name, ...recipe.ingredients.map(item => foods.find(food => food.id === item.foodId)?.name || item.foodName)].join(' ').toLocaleLowerCase('ru').replace(/ё/g, 'е');
        return terms.every(term => text.includes(term));
      }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
    }
    return rankFoods(foods, {}, { query, mode: 'recent' }).filter(food => mode !== 'favorites' || favorites.includes(food.id));
  }, [foods, favorites, recipes, mode, query]);
  const pages = Math.max(1, Math.ceil(result.length / 6));
  const currentPage = Math.min(page, pages - 1);
  useEffect(() => setPage(0), [query, mode]);
  useEffect(() => setPage(current => Math.min(current, pages - 1)), [pages]);
  const modes = [['favorites', 'Избранное'], ...(onCreateRecipe ? [['recipes', 'Готовые']] : [])];
  function changeQuery(value) { setQuery(value); if (mode !== 'recipes' && value) setMode('all'); }
  function movePage(direction) { setPage(Math.max(0, Math.min(pages - 1, currentPage + direction))); }
  return <div className="quick-foods">
    <SearchField value={query} onChange={changeQuery} label={ready ? 'Поиск готового блюда' : 'Поиск продукта по всей базе'} placeholder={ready ? 'Найти готовое блюдо…' : 'Быстрый поиск продукта…'} />
    <div className="quick-food-modes" role="group" aria-label="Быстрый выбор продуктов">{modes.map(([id, label]) => <button type="button" key={id} className={`chip ${mode === id ? 'active' : ''}`} aria-pressed={mode === id} onClick={() => { setMode(current => current === id ? 'all' : id); setQuery(''); }}>{id === 'favorites' && <span aria-hidden="true">★ </span>}{label}</button>)}</div>
    <div className="quick-food-caption"><span>{query.trim() ? `Найдено: ${result.length}` : ready ? `Блюд: ${result.length}` : mode === 'favorites' ? `Избранных: ${result.length}` : `Все продукты: ${result.length}`}</span>{ready ? <button type="button" className="text-button" onClick={onCreateRecipe}>＋ Создать блюдо</button> : <span>Новые сверху · на 100 г</span>}</div>
    {!result.length ? <div className="quick-food-empty"><p>{query.trim() ? 'Ничего не найдено. Попробуйте другое название.' : ready ? 'Сохраните состав блюда, чтобы выбирать все ингредиенты сразу.' : mode === 'favorites' ? 'Найдите продукт и нажмите ☆ — он появится здесь.' : 'Добавьте первый продукт в базу.'}</p>{!ready && (!foods.length || query.trim()) && onAdd && <button type="button" className="text-button" onClick={onAdd}>＋ Новый продукт</button>}</div> : <div className="food-carousel" role="region" aria-label={ready ? 'Готовые блюда' : mode === 'favorites' ? 'Избранные продукты' : 'Все продукты'} onTouchStart={event => {
      if (event.touches.length === 1) touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      else touch.current = null;
    }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => {
      const start = touch.current; touch.current = null;
      if (!start || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) movePage(dx < 0 ? 1 : -1);
    }}>
      {result.slice(currentPage * 6, currentPage * 6 + 6).map(item => <article className={`food-tile ${!ready && selected.includes(item.id) ? 'selected' : ''}`} key={item.id}>
        <button type="button" className="food-select" aria-label={`Выбрать ${ready ? 'блюдо ' : ''}${item.name}`} aria-pressed={ready ? undefined : selected.includes(item.id)} onClick={() => ready ? onRecipe(item) : onSelect(item)}>
          <span className="food-title" title={item.name}>{item.name}</span><span className="food-tile-calories">{ready ? <small>Состав: {item.ingredients.length}</small> : <>{format(item.calories)} <small>ккал</small></>}</span>
        </button>
        {ready ? <button type="button" className="tile-edit" aria-label={`Редактировать блюдо ${item.name}`} onClick={() => onEditRecipe(item)}>✎</button> : <FavoriteButton food={item} active={favorites.includes(item.id)} onToggle={onFavorite} />}
      </article>)}
    </div>}
    {pages > 1 && <nav className="food-pagination" aria-label={ready ? 'Страницы готовых блюд' : 'Страницы продуктов'}><button type="button" className="icon-button" aria-label="Предыдущие 6" disabled={currentPage === 0} onClick={() => movePage(-1)}>‹</button><span aria-live="polite">{currentPage * 6 + 1}–{Math.min((currentPage + 1) * 6, result.length)} из {result.length}</span><button type="button" className="icon-button" aria-label="Следующие 6" disabled={currentPage === pages - 1} onClick={() => movePage(1)}>›</button></nav>}
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
