import { shiftDate } from './core.mjs';

export const CHART_GROUPS = [
  { id: 'weight', label: 'Вес', unit: 'кг' },
  { id: 'size', label: 'Обхваты', unit: 'см' },
  { id: 'percent', label: 'Состав тела, %', unit: '%' },
  { id: 'mass', label: 'Масса тканей, кг', unit: 'кг' },
  { id: 'visceral', label: 'Висцеральный жир', unit: 'ур.' },
  { id: 'bmr', label: 'Основной обмен', unit: 'ккал' },
];

export const dayNumber = date => Date.parse(`${date}T00:00:00Z`) / 86400000;

export function measurementSeries(records, keys, { end, days = 0 }) {
  const start = days ? shiftDate(end, 1 - days) : '';
  const dates = Object.keys(records).filter(date => date <= end && (!start || date >= start)).sort();
  return keys.map(key => ({ key, points: dates.filter(date => Number.isFinite(records[date][key])).map(date => ({ date, value: records[date][key] })) }));
}

// Use calendar days, not the last seven entries. Missing measurements are never zeroes.
export function weightAverage(records, { end, days = 0 }) {
  const all = measurementSeries(records, ['weight'], { end })[0].points;
  const start = days ? shiftDate(end, 1 - days) : '';
  return all.filter(point => !start || point.date >= start).map(point => {
    const first = shiftDate(point.date, -6);
    const window = all.filter(item => item.date >= first && item.date <= point.date);
    return { date: point.date, value: window.reduce((sum, item) => sum + item.value, 0) / window.length };
  });
}
