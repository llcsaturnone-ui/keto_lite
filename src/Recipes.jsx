import React, { useId, useState } from 'react';
import { calculate, makeId, normalizeRecipe } from './core.mjs';
import { QuickFoods, QuickProductForm } from './QuickFoods.jsx';

const format = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

export function RecipeForm({ initial, foods, favorites, onFavorite, onAddFoods, onSave, onCancel, onDelete }) {
  const formId = useId();
  const [name, setName] = useState(initial.name || '');
  const [ingredients, setIngredients] = useState(() => initial.ingredients.map(item => ({ ...item, grams: String(item.grams) })));
  const [pickerOpen, setPickerOpen] = useState(!initial.ingredients.length);
  const [newProduct, setNewProduct] = useState(false), [error, setError] = useState('');
  let totals = null;
  try {
    if (ingredients.length) totals = ingredients.map(item => calculate(foods.find(food => food.id === item.foodId), item.grams))
      .reduce((sum, item) => Object.fromEntries(Object.keys(item).map(key => [key, (sum[key] || 0) + item[key]])), {});
  } catch {}

  function toggle(food) {
    setIngredients(current => current.some(item => item.foodId === food.id) ? current.filter(item => item.foodId !== food.id)
      : [...current, { foodId: food.id, foodName: food.name, grams: '100' }]);
    setError('');
  }
  return <div className="form-stack recipe-form">
    <form id={formId} className="form-stack" onSubmit={event => {
      event.preventDefault(); setError('');
      try {
        const recipe = normalizeRecipe({ id: initial.id || makeId(), createdAt: initial.createdAt || new Date().toISOString(), name, ingredients: ingredients.map(item => {
          const food = foods.find(food => food.id === item.foodId);
          if (!food) throw new Error(`«${item.foodName}» удалён из базы. Уберите или замените этот ингредиент.`);
          return { ...item, foodName: food.name };
        }) });
        onSave(recipe);
      } catch (error) { setError(error.message); }
    }}>
      <label><span>Название блюда</span><input autoFocus required maxLength="100" placeholder="Например, протеиновый коктейль" value={name} onChange={event => setName(event.target.value)} /></label>
      <p className="hint">Сохраните обычный состав. Перед добавлением в дневник можно менять ингредиенты и их вес.</p>
      {ingredients.length > 0 && <><div className="portion-list-heading"><span>Ингредиенты</span><span>Вес, г</span></div><div className="selected-portions">{ingredients.map((item, index) => {
        const food = foods.find(food => food.id === item.foodId);
        return <div className="selected-portion" key={item.foodId}>
          <label className="portion-name" htmlFor={`${formId}-${index}`}>{food?.name || item.foodName}{!food && <small className="danger-text">Удалён из базы</small>}</label>
          <input id={`${formId}-${index}`} type="text" inputMode="decimal" required autoComplete="off" aria-label={`Вес ингредиента ${food?.name || item.foodName}, г`} value={item.grams} onChange={event => setIngredients(current => current.map(value => value.foodId === item.foodId ? { ...value, grams: event.target.value } : value))} onFocus={event => event.target.select()} />
          <button type="button" className="icon-button" aria-label={`Убрать ингредиент ${food?.name || item.foodName}`} onClick={() => setIngredients(current => current.filter(value => value.foodId !== item.foodId))}>×</button>
        </div>;
      })}</div></>}
      {totals && <p className="portion-preview"><span>Всё блюдо:</span><b>{format(totals.calories)} ккал</b><span>Б {format(totals.protein)}</span><span>Ж {format(totals.fat)}</span><span>У {format(totals.carbs)}</span></p>}
    </form>
    <button type="button" className="secondary full" aria-expanded={pickerOpen} onClick={() => setPickerOpen(current => !current)}>{pickerOpen ? 'Свернуть выбор ингредиентов' : '＋ Добавить ингредиенты'}</button>
    {pickerOpen && <div className="recipe-picker">{newProduct ? <QuickProductForm onCancel={() => setNewProduct(false)} onSave={(items, selectAfter) => {
      const added = onAddFoods(items);
      if (selectAfter) setIngredients(current => [...current, ...added.map(food => ({ foodId: food.id, foodName: food.name, grams: '100' }))]);
      setNewProduct(false);
    }} /> : <><QuickFoods foods={foods} favorites={favorites} selected={ingredients.map(item => item.foodId)} onSelect={toggle} onFavorite={onFavorite} onAdd={() => setNewProduct(true)} /><button type="button" className="text-button" onClick={() => setNewProduct(true)}>＋ Новый продукт</button></>}</div>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="secondary" onClick={onCancel}>Отмена</button><button type="submit" form={formId} className="primary">Сохранить блюдо</button></div>
    {initial.id && <button type="button" className="text-button danger-text" onClick={onDelete}>Удалить блюдо</button>}
  </div>;
}
