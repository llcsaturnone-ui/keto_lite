import React, { useMemo, useState } from 'react';
import { MEASUREMENT_FIELDS, normalizeMeasurement, displayDate } from './core.mjs';
import { CHART_GROUPS, dayNumber, measurementSeries, weightAverage } from './progress.mjs';

const format = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const shortDate = date => `${date.slice(8)}.${date.slice(5, 7)}`;
const fullDate = date => `${shortDate(date)}.${date.slice(0, 4)}`;

export function MeasurementForm({ date, initial = {}, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [changed, setChanged] = useState([]);
  const [error, setError] = useState('');
  function change(key, value) {
    setDraft(current => ({ ...current, [key]: value }));
    setChanged(current => current.includes(key) ? current : [...current, key]);
  }
  const inputs = group => <div className="measurement-inputs">{MEASUREMENT_FIELDS.filter(field => field.group === group).map(field => <label key={field.id}>
    <span>{field.label}, {field.unit}</span><input type="text" inputMode="decimal" autoComplete="off" aria-label={`${field.label}, ${field.unit}`} value={draft[field.id] ?? ''} placeholder="—" onChange={event => change(field.id, event.target.value)} />
  </label>)}</div>;
  return <form className="form-stack measurement-form" onSubmit={event => {
    event.preventDefault(); setError('');
    try {
      const normalized = normalizeMeasurement(draft);
      if (!changed.length) { onCancel(); return; }
      onSave(Object.fromEntries(changed.map(key => [key, normalized[key] ?? null])));
    } catch (error) { setError(error.message); }
  }}>
    <p className="hint">{fullDate(date)} · Заполните только то, что измерили. Пустые поля можно пропустить.</p>
    <div><h3>Вес и состав тела</h3>{inputs('main')}</div>
    <details className="measurement-details" open><summary>Обхваты тела</summary>{inputs('size')}</details>
    <details className="measurement-details"><summary>Дополнительно с весов</summary>{inputs('extra')}</details>
    <label><span>Заметка · необязательно</span><textarea rows="2" maxLength="500" value={draft.note ?? ''} placeholder="Например, взвешивание после завтрака" onChange={event => change('note', event.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="button-row"><button className="secondary" type="button" onClick={onCancel}>Отмена</button><button className="primary" type="submit">Сохранить замеры</button></div>
  </form>;
}

function LineChart({ series, unit, activeDate, onSelectDate }) {
  const points = series.flatMap(item => item.points);
  if (!points.length) return <div className="empty-state chart-empty"><span aria-hidden="true">↗</span><p>Пока нет данных для этого графика</p><small>Добавьте замер, выберите другой показатель или период.</small></div>;
  const dates = [...new Set(points.map(point => point.date))].sort();
  const values = points.map(point => point.value);
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, 0.5);
  const low = Math.max(0, min - padding), high = max + padding;
  const firstDay = dayNumber(dates[0]), lastDay = dayNumber(dates.at(-1));
  const x = date => firstDay === lastDay ? 196 : 46 + (dayNumber(date) - firstDay) / (lastDay - firstDay) * 298;
  const y = value => 184 - (value - low) / (high - low) * 162;
  const ticks = [0, 1, 2, 3].map(index => low + (high - low) * index / 3);
  const current = dates.includes(activeDate) ? activeDate : dates.at(-1);
  return <>
    <svg className="line-chart" viewBox="0 0 360 222" role="img" aria-label={`График, ${unit}, с ${fullDate(dates[0])} по ${fullDate(dates.at(-1))}`} onPointerDown={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width) return;
      const targetX = (event.clientX - rect.left) / rect.width * 360;
      onSelectDate(dates.reduce((nearest, date) => Math.abs(x(date) - targetX) < Math.abs(x(nearest) - targetX) ? date : nearest));
    }}>
      <title>Изменения по датам. {unit}. Точные значения доступны под графиком.</title>
      {ticks.map((tick, index) => <g key={index}><line x1="46" x2="344" y1={y(tick)} y2={y(tick)} stroke="#34343d" strokeDasharray="3 5" /><text x="38" y={y(tick) + 4} textAnchor="end">{format(tick)}</text></g>)}
      <text x="46" y="12">{unit}</text>
      <line x1={x(current)} x2={x(current)} y1="18" y2="188" stroke="#71717a" strokeDasharray="3 5" />
      {series.map(item => <g key={item.key}>
        {item.points.length > 1 && <polyline data-series={item.key} points={item.points.map(point => `${x(point.date)},${y(point.value)}`).join(' ')} fill="none" stroke={item.color} strokeWidth={item.average ? '2' : '2.5'} strokeDasharray={item.average ? '6 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />}
        {item.points.filter(point => !item.average || item.points.length === 1).map(point => <circle key={point.date} data-date={point.date} cx={x(point.date)} cy={y(point.value)} r={point.date === current ? 4.5 : 3} fill={item.color} stroke="#18181b" strokeWidth="1.5"><title>{fullDate(point.date)} · {item.label}: {format(point.value)} {unit}</title></circle>)}
      </g>)}
      <text x={dates.length === 1 ? '196' : '46'} y="208" textAnchor={dates.length === 1 ? 'middle' : 'start'}>{shortDate(dates[0])}</text>
      {dates.length > 1 && <text x="344" y="208" textAnchor="end">{shortDate(dates.at(-1))}</text>}
    </svg>
    {dates.length === 1 && <p className="hint chart-hint">Первая точка сохранена. Линия появится после следующего замера.</p>}
    <div className="chart-readout"><label className="chart-date"><span>Значения за</span><select aria-label="Дата на графике" value={current} onChange={event => onSelectDate(event.target.value)}>{dates.map(date => <option key={date} value={date}>{fullDate(date)}</option>)}</select></label>
      <div className="chart-values">{series.map(item => {
        const point = item.points.find(point => point.date === current);
        return <div key={item.key}><span><i style={{ background: item.color }} />{item.label}</span><strong>{point ? `${format(point.value)} ${unit}` : 'Нет замера'}</strong></div>;
      })}</div>
    </div>
  </>;
}

export function Progress({ records, date, onEdit, onDelete }) {
  const [groupId, setGroupId] = useState('weight'), [period, setPeriod] = useState(30);
  const [hiddenFields, setHiddenFields] = useState([]), [average, setAverage] = useState(true);
  const [activeDate, setActiveDate] = useState(''), [historyLimit, setHistoryLimit] = useState(5);
  const group = CHART_GROUPS.find(item => item.id === groupId);
  const fields = MEASUREMENT_FIELDS.filter(field => field.chart === groupId);
  const series = useMemo(() => {
    const raw = measurementSeries(records, fields.filter(field => !hiddenFields.includes(field.id)).map(field => field.id), { end: date, days: period });
    const result = raw.map(item => ({ ...item, ...fields.find(field => field.id === item.key), label: fields.find(field => field.id === item.key).short || fields.find(field => field.id === item.key).label }));
    if (groupId === 'weight' && average) result.push({ key: 'average', label: 'Среднее за 7 дней', color: '#d4d4d8', average: true, points: weightAverage(records, { end: date, days: period }) });
    return result;
  }, [records, groupId, hiddenFields, average, date, period]);
  const dates = Object.keys(records).sort().reverse();
  const weightDates = dates.filter(day => day <= date && Number.isFinite(records[day].weight));
  const lastWeight = weightDates[0] ? records[weightDates[0]].weight : null;
  const firstWeight = weightDates.length ? records[weightDates.at(-1)].weight : null;
  const difference = lastWeight !== null ? lastWeight - firstWeight : null;
  const selectedDay = records[date];
  return <div className="progress-page">
    <section className="card progress-overview" aria-labelledby="progress-summary-title"><div className="section-header"><h2 id="progress-summary-title">Мои замеры</h2><span className="count-badge">{dates.length} дн.</span></div>
      <div className="weight-summary"><div><span className="hint">Последний вес{weightDates[0] ? ` · ${shortDate(weightDates[0])}` : ''}</span><p>{lastWeight === null ? '—' : format(lastWeight)} <small>кг</small></p></div><div className="weight-change"><span className="hint">С первого замера</span><strong>{weightDates.length < 2 ? '—' : `${difference > 0 ? '+' : ''}${format(difference)} кг`}</strong></div></div>
      <button type="button" className="primary full" onClick={() => onEdit(date)}>{selectedDay ? 'Изменить замеры за этот день' : '＋ Добавить замеры'}</button>
      <p className="hint progress-day-status">{selectedDay ? `За ${fullDate(date)} сохранено показателей: ${Object.keys(selectedDay).filter(key => key !== 'note').length}` : `${displayDate(date)} · замеров пока нет`}</p>
    </section>
    <section className="card chart-card" aria-labelledby="chart-title"><div className="section-header"><h2 id="chart-title">Динамика</h2><span className="hint">до {shortDate(date)}</span></div>
      <label className="chart-group"><span className="sr-only">Показатели графика</span><select aria-label="Показатели графика" value={groupId} onChange={event => { setGroupId(event.target.value); setActiveDate(''); }}>{CHART_GROUPS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="period-buttons" role="group" aria-label="Период графика">{[[7, '7 дней'], [30, '30 дней'], [90, '90 дней'], [0, 'Всё время']].map(([days, title]) => <button type="button" key={days} className={`chip ${period === days ? 'active' : ''}`} aria-pressed={period === days} onClick={() => { setPeriod(days); setActiveDate(''); }}>{title}</button>)}</div>
      {groupId === 'weight' ? <label className="check-label average-toggle"><input type="checkbox" checked={average} onChange={event => setAverage(event.target.checked)} /><span>Показывать среднее за 7 дней</span></label> : <div className="metric-toggles" role="group" aria-label="Линии графика">{fields.map(field => <button type="button" key={field.id} className={`chip ${hiddenFields.includes(field.id) ? '' : 'active'}`} aria-pressed={!hiddenFields.includes(field.id)} onClick={() => setHiddenFields(current => current.includes(field.id) ? current.filter(key => key !== field.id) : [...current, field.id])}><i style={{ background: field.color }} />{field.short || field.label}</button>)}</div>}
      <LineChart series={series} unit={group.unit} activeDate={activeDate} onSelectDate={setActiveDate} />
      <p className="hint chart-hint">{groupId === 'weight' ? 'Среднее считается по внесённым взвешиваниям за 7 календарных дней.' : 'Нажмите на график или выберите дату, чтобы посмотреть значения.'} Пропущенные значения не считаются нулём.</p>
    </section>
    <section className="card" aria-labelledby="measurement-history-title"><div className="section-header"><h2 id="measurement-history-title">История замеров</h2></div>
      {!dates.length && <p className="hint">Здесь будут ваши записи по датам.</p>}
      <div className="measurement-history">{dates.slice(0, historyLimit).map(day => <article key={day} className="measurement-history-row"><div className="measurement-history-header"><strong>{fullDate(day)}</strong><div className="row-actions"><button type="button" className="icon-button" aria-label={`Изменить замеры ${fullDate(day)}`} onClick={() => onEdit(day)}>✎</button><button type="button" className="icon-button danger-text" aria-label={`Удалить замеры ${fullDate(day)}`} onClick={() => onDelete(day)}>×</button></div></div>
        <div className="measurement-history-values">{MEASUREMENT_FIELDS.filter(field => records[day][field.id] !== undefined).map(field => <span key={field.id}>{field.short || field.label}: <b>{format(records[day][field.id])} {field.unit}</b></span>)}</div>
        {records[day].note && <p className="hint measurement-note">{records[day].note}</p>}
      </article>)}</div>
      {dates.length > historyLimit && <button type="button" className="secondary full more-button" onClick={() => setHistoryLimit(historyLimit + 10)}>Показать ещё</button>}
    </section>
  </div>;
}
