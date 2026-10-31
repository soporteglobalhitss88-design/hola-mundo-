import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateShipments, summarizeFinance, summarizePersonnel, filterData, monthlyMetrics, groupShipments } from './analytics.js';
const data = JSON.parse(readFileSync(new URL('../data/workbook.json', import.meta.url)));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} differs from ${expected}`);

test('actual supplied sample produces independently audited operational totals', () => {
  const stats = aggregateShipments(data.shipments);
  assert.equal(stats.count, 3000);
  close(stats.onTimeRate, 1396 / 3000 * 100);
  close(stats.claimRate, 424 / 3000 * 100);
  close(stats.returnRate, 288 / 3000 * 100);
  assert.equal(stats.incomplete, 322);
  const bogota = groupShipments(data.shipments, 'center').find(group => group.name === 'Bogota');
  assert.equal(bogota.count, 1337);
});

test('monthly corporate finance flows sum while closing balances do not', () => {
  const stats = summarizeFinance([...data.finances].reverse());
  assert.equal(stats.revenue, 12305);
  assert.equal(stats.operatingCosts, 10364);
  assert.equal(stats.adminCosts, 1398);
  assert.equal(stats.profit, 543);
  close(stats.margin, 543 / 12305 * 100);
  assert.equal(stats.overdue, 1166);
  assert.equal(stats.cash, 280);
  assert.equal(stats.month, '2025-12');
  close(stats.penalties, 225.8);
});

test('annual turnover uses average headcount rather than summing percentages', () => {
  const stats = summarizePersonnel(data.personnel);
  assert.equal(stats.headcount, 406.25);
  assert.equal(stats.departures, 157);
  assert.equal(stats.trainingHours, 4318);
  close(stats.turnover, 157 / 406.25 * 100);
});

test('empty and unknown observations remain null; known zero remains valid', () => {
  const empty = aggregateShipments([]);
  assert.equal(empty.count, 0);
  for (const key of ['onTimeRate', 'claimRate', 'returnRate', 'averageCost', 'profit', 'margin']) assert.equal(empty[key], null);
  const missing = aggregateShipments([{ cost: null, revenue: null, onTime: null }, { cost: 0, revenue: 0, onTime: 0 }]);
  assert.equal(missing.averageCost, 0);
  assert.equal(missing.onTimeRate, 0);
  assert.equal(missing.margin, null);
  assert.equal(summarizeFinance([]).cash, null);
  assert.equal(summarizePersonnel([]).turnover, null);
});

test('period filters apply to all datasets while dimensions apply only to shipment observations', () => {
  const january = filterData(data, { period: '2025-01', center: 'Bogota' });
  assert.ok(january.shipments.length > 0);
  assert.ok(january.shipments.every(row => row.center === 'Bogota' && row.date.startsWith('2025-01')));
  assert.equal(january.personnel.length, 1);
  assert.equal(january.finances.length, 1);
  assert.equal(january.finances[0].revenue, 881);
  const q2 = filterData(data, { period: 'Q2' });
  assert.deepEqual(q2.finances.map(row => row.month), ['2025-04', '2025-05', '2025-06']);
  assert.equal(q2.personnel.length, 3);
  assert.equal(monthlyMetrics(data, { period: 'Q2' }).length, 3);
  assert.equal(monthlyMetrics(data).length, 12);
});

test('dimension filtering never invents finance allocation or revenue for empty samples', () => {
  const none = filterData(data, { client: 'Nonexistent' });
  assert.equal(none.shipments.length, 0);
  assert.equal(none.finances.length, 12);
  const series = monthlyMetrics(data, { period: '2025-01', center: 'Nonexistent' });
  assert.equal(series[0].count, 0);
  assert.equal(series[0].onTimeRate, null);
  assert.equal(series[0].revenue, 881);
});
