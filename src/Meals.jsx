import React, { useState } from 'react';
import { MEAL_NAMES, mealKey } from './core.mjs';

export function MealPicker({ value, onChange, meals = [], required = false }) {
  const names = [...MEAL_NAMES, ...meals.filter(name => name && !MEAL_NAMES.includes(name))];
  const choices = [...new Map(names.map(name => [mealKey(name), name])).values()];
  const [custom, setCustom] = useState(Boolean(value && !choices.includes(value)));
  return <div className="meal-picker">
    <label><span>Приём пищи</span><select aria-label="Приём пищи" value={custom ? '__custom__' : value} required={required} onChange={event => {
      const next = event.target.value;
      setCustom(next === '__custom__');
      onChange(next === '__custom__' ? '' : next);
    }}>{!required && <option value="">Без группы</option>}{choices.map(name => <option key={name} value={name}>{name}</option>)}<option value="__custom__">Своё название…</option></select></label>
    {custom && <label><span>Название приёма пищи</span><input type="text" required maxLength="80" value={value} placeholder="Например, обед после тренировки" onChange={event => onChange(event.target.value)} /></label>}
  </div>;
}

export function MealNameForm({ initial, meals, onSave, onClose }) {
  const [name, setName] = useState(initial || 'Приём пищи');
  const [error, setError] = useState('');
  return <form className="form-stack" onSubmit={event => {
    event.preventDefault(); setError('');
    try {
      if (!name.trim() || name.length > 80) throw new Error('Укажите название: от 1 до 80 символов.');
      onSave(name.trim());
    } catch (error) { setError(error.message); }
  }}><MealPicker value={name} onChange={setName} meals={meals} required /><p className="hint">Продукты с одинаковым названием приёма пищи за один день объединяются.</p>{error && <p className="error" role="alert">{error}</p>}<div className="button-row"><button type="button" className="secondary" onClick={onClose}>Отмена</button><button type="submit" className="primary">Сохранить группу</button></div></form>;
}
