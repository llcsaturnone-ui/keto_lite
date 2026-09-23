import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeight } from './calculator.mjs';
const grams = expression => { const result = calculateWeight(expression); assert.equal(result.status, 'ok', expression); return result.value; };

test('live weight results update after each digit and follow arithmetic precedence', () => {
  assert.equal(grams('584+5'), 589);
  assert.equal(grams('584+58'), 642);
  assert.equal(grams('584+584'), 1168);
  assert.equal(grams('584−250'), 334);
  assert.equal(grams('30+15×2'), 60);
  assert.equal(grams('180÷3−20'), 40);
  assert.equal(grams('0,1+0,2'), 0.3);
  assert.equal(grams('150,5-25,25'), 125.25);
  assert.equal(grams('100/3'), 33.333333);
  assert.equal(grams('30+25-100'), -45);
});

test('empty, incomplete, invalid and oversized expressions never silently become weights', () => {
  assert.equal(calculateWeight('').status, 'empty');
  for (const value of ['584+', '30−', '3÷', ',']) assert.equal(calculateWeight(value).status, 'pending', value);
  for (const value of ['5÷0', '1,2,3', 'alert(1)', '1e5', '9'.repeat(201), '1000000001', '1000000000×2']) assert.equal(calculateWeight(value).status, 'error', value);
});
