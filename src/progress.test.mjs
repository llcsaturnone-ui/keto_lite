import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GOALS, DEFAULT_FOODS, normalizeMeasurement, validateBackup } from './core.mjs';
import { measurementSeries, weightAverage, dayNumber } from './progress.mjs';

test('optional measurements accept Russian decimals and zero percentages without fabricating other fields', () => {
  assert.deepEqual(normalizeMeasurement({ weight: '93,1', waist: '105', fatPercent: 0, chest: '', muscleMass: null, note: '  утро  ' }), { weight: 93.1, fatPercent: 0, waist: 105, note: 'утро' });
  for (const value of [{ weight: 0 }, { waist: -1 }, { fatPercent: 101 }, { musclePercent: 'NaN' }, { waterPercent: true }, {}, { note: 'Нет замеров' }]) assert.throws(() => normalizeMeasurement(value));
});

test('new backups round-trip all measurements and favorites, while old copies get empty additions', () => {
  const old = { goals: DEFAULT_GOALS, foods: DEFAULT_FOODS, dailyLogs: {} };
  const migrated = validateBackup(old);
  assert.deepEqual(migrated.measurements, {});
  assert.deepEqual(migrated.favorites, []);
  const current = validateBackup({ ...old, favorites: ['1', '1', 'deleted'], measurements: { '2026-09-21': { weight: 93.1, muscleMass: 62.9, musclePercent: 67.6, waist: 105, bicepsLeft: 36.5 } } });
  assert.deepEqual(current.favorites, ['1']);
  assert.deepEqual(validateBackup(JSON.stringify({ version: 12, ...current })), current);
  for (const measurements of [[], { '2026-02-30': { weight: 90 } }, { '2026-09-21': { fatPercent: 120 } }]) assert.throws(() => validateBackup({ ...old, measurements }));
  assert.throws(() => validateBackup({ ...old, favorites: '1' }));
});

test('chart ranges use calendar dates, sort records and omit missing metrics instead of drawing zeroes', () => {
  const records = { '2026-09-21': { weight: 93 }, '2026-09-01': { weight: 94, waist: 105 }, '2026-09-19': { waist: 104 }, '2026-09-30': { weight: 92 } };
  const series = measurementSeries(records, ['weight', 'waist'], { end: '2026-09-21', days: 7 });
  assert.deepEqual(series[0].points, [{ date: '2026-09-21', value: 93 }]);
  assert.deepEqual(series[1].points, [{ date: '2026-09-19', value: 104 }]);
  assert.deepEqual(measurementSeries(records, ['weight'], { end: '2026-09-21' })[0].points.map(point => point.date), ['2026-09-01', '2026-09-21']);
  assert.equal(dayNumber('2026-09-21') - dayNumber('2026-09-01'), 20);
  assert.equal(dayNumber('2024-03-01') - dayNumber('2024-02-28'), 2);
});

test('seven-day weight trend does not treat gaps as zero or include older entries', () => {
  const records = { '2026-09-01': { weight: 110 }, '2026-09-14': { weight: 100 }, '2026-09-15': { weight: 94 }, '2026-09-18': { waist: 100 }, '2026-09-20': { weight: 93 }, '2026-09-21': { weight: 92 } };
  const average = weightAverage(records, { end: '2026-09-21', days: 2 });
  assert.equal(average.length, 2);
  assert.equal(average[0].value, (100 + 94 + 93) / 3);
  assert.equal(average[1].value, 93);
});
