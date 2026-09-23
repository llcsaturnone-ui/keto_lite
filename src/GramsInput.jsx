import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateWeight, displayExpression, displayWeight } from './calculator.mjs';

function WeightCalculator({ initial, firstKey, title, onApply, onClose }) {
  const dialog = useRef(null), expressionEl = useRef(null);
  const heading = useId(), description = useId();
  const [expression, setExpression] = useState(() => {
    const value = String(initial).replace('.', ',');
    if (!firstKey) return value;
    if (/^[\d.,]$/.test(firstKey)) return firstKey.replace('.', ',');
    return firstKey === 'Backspace' ? value.slice(0, -1) : value + firstKey;
  });
  const [replaceOnType, setReplaceOnType] = useState(!firstKey && Boolean(initial));
  const result = calculateWeight(expression);
  const error = result.status === 'error' ? result.message : result.status === 'ok' && result.value <= 0 ? 'Вес должен быть больше нуля' : '';
  const valid = result.status === 'empty' || (result.status === 'ok' && !error);

  useEffect(() => {
    const previous = document.activeElement, element = dialog.current;
    element.showModal();
    expressionEl.current?.focus({ preventScroll: true });
    function cancel(event) { event.preventDefault(); onClose(); }
    element.addEventListener('cancel', cancel);
    return () => { element.removeEventListener('cancel', cancel); element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const element = expressionEl.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [expression]);

  function apply() {
    if (valid) onApply(result.status === 'empty' ? '' : displayWeight(result.value));
  }
  function press(key) {
    if (key === 'done') { apply(); return; }
    if (key === '=') {
      if (result.status === 'ok') { setExpression(displayWeight(result.value)); setReplaceOnType(true); }
      return;
    }
    if (key === 'back') { setExpression(value => value.slice(0, -1)); setReplaceOnType(false); return; }
    const decimalKey = key === '.' ? ',' : key;
    setExpression(value => replaceOnType && /^[\d,]$/.test(decimalKey) ? decimalKey : value.length < 200 ? value + decimalKey : value);
    setReplaceOnType(false);
  }
  return <dialog ref={dialog} className="weight-calculator" aria-labelledby={heading} aria-describedby={description} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }} onKeyDown={event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let key = event.key;
    if (key === 'Enter') key = 'done';
    else if (key === 'Backspace' || key === 'Delete') key = 'back';
    else if (!/^[\d.,+*/−×÷=-]$/.test(key)) return;
    event.preventDefault(); event.stopPropagation(); press(key);
  }} onPaste={event => {
    const value = event.clipboardData.getData('text');
    if (value.length > 200) return;
    event.preventDefault(); setExpression(value); setReplaceOnType(false);
  }}>
    <div className="weight-sheet-handle" aria-hidden="true" />
    <div className="weight-calc-header"><div><h2 id={heading}>Вес, г</h2><p id={description}>{title}</p></div><button type="button" className="icon-button" aria-label="Отменить ввод веса" onClick={onClose}>×</button></div>
    <div className="weight-expression" ref={expressionEl} tabIndex="0" aria-label="Выражение веса" aria-live="polite"><span className={replaceOnType ? 'weight-replace' : ''}>{displayExpression(expression) || '0'}</span>{result.status === 'ok' && result.expression && <span className="weight-live-result"> = {displayWeight(result.value)}</span>}<span className="weight-caret" aria-hidden="true" /></div>
    <div className="weight-calc-meta"><button type="button" onClick={() => { setExpression(''); setReplaceOnType(false); }}>Очистить</button><span className={error ? 'weight-calc-error' : ''} role={error ? 'alert' : undefined}>{error || (result.status === 'pending' ? result.message : 'Вес в граммах')}</span></div>
    <div className="weight-operators">{['+', '−', '×', '÷', '='].map(key => <button type="button" key={key} aria-label={key === '=' ? 'Вычислить вес' : key} disabled={key === '=' && result.status !== 'ok'} onClick={() => press(key)}>{key}</button>)}<button type="button" className="weight-done" aria-label="Применить вес" disabled={!valid} onClick={apply}>✓</button></div>
    <div className="weight-number-pad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'].map(key => <button type="button" key={key} aria-label={key === 'back' ? 'Удалить символ' : key} onClick={() => press(key)}>{key === 'back' ? <svg viewBox="0 0 28 24" width="28" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 3h15v18H10L2 12z" /><path d="m13 8 8 8m0-8-8 8" /></svg> : key}</button>)}</div>
  </dialog>;
}

export function GramsInput({ value, onChange, label = 'Вес, г', productName = '', id, required = true, placeholder = '100' }) {
  const [editing, setEditing] = useState(null);
  return <><input id={id} type="text" inputMode="none" readOnly required={required} autoComplete="off" className="grams-input" aria-label={label} aria-haspopup="dialog" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} onClick={event => { event.currentTarget.focus({ preventScroll: true }); setEditing({ firstKey: '' }); }} onKeyDown={event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' || event.key === ' ' || /^[\d.,+*/−×÷=-]$/.test(event.key) || event.key === 'Backspace') {
      event.preventDefault(); event.stopPropagation(); setEditing({ firstKey: ['Enter', ' ', '='].includes(event.key) ? '' : event.key });
    }
  }} />{editing && createPortal(<WeightCalculator initial={value} firstKey={editing.firstKey} title={productName || label} onApply={next => { onChange(next); setEditing(null); }} onClose={() => setEditing(null)} />, document.body)}</>;
}
