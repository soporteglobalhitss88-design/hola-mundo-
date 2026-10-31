import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseWorkbook } from './importData.js';
const fixture = rows => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Envios_muestra');
  return workbook;
};
const headers = ['ID', 'Fecha pedido', 'Centro', 'Cliente', 'A tiempo', 'Costo COP', 'Ingreso COP', 'Reclamo'];

test('supplied dataset imports its sample and monthly balances without invented records', () => {
  const source = JSON.parse(readFileSync(new URL('../data/workbook.json', import.meta.url)));
  const workbook = XLSX.utils.book_new();
  for (const [name, records] of [['Envios_muestra', source.shipments], ['Personal_mensual', source.personnel], ['Finanzas_mensual', source.finances], ['Ofertas_inversion', source.offers]]) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records), name);
  }
  const { data, report } = parseWorkbook(workbook);
  assert.equal(report.type, 'workbook');
  assert.equal(report.shipmentCount, 3000);
  assert.equal(report.personnelCount, 12);
  assert.equal(report.financeCount, 12);
  assert.equal(report.duplicates, 0);
  assert.equal(report.invalidValues, 0);
  assert.equal(report.missingValues, 0);
  assert.equal(data.shipments[0].date, '2025-01-22');
  assert.equal(data.shipments[0].onTime, 0);
  assert.equal(data.finances.at(-1).cash, 280);
  assert.equal(data.offers.length, 12);
});

test('shipment import preserves true zeros, unknown values, and removes duplicate IDs', () => {
  const workbook = fixture([
    headers,
    ['E1', '2025-01-01', 'Bogota', 'Cliente', 0, 0, 1000, null],
    ['E1', '2025-01-02', 'Cali', 'Otro', 1, 20, 2000, 1],
    ['E2', '2025-01-03', 'Cali', 'Otro', 1, null, null, 0],
  ]);
  const { data, report } = parseWorkbook(workbook);
  assert.equal(report.type, 'shipments');
  assert.equal(report.duplicates, 1);
  assert.equal(data.shipments.length, 2);
  assert.equal(data.shipments[0].cost, 0);
  assert.equal(data.shipments[0].onTime, 0);
  assert.equal(data.shipments[0].claim, null);
  assert.equal(data.shipments[1].cost, null);
  assert.equal(data.finances.length, 0);
});

test('bad required headers are rejected before data replacement', () => {
  assert.throws(() => parseWorkbook(fixture([['Name', 'Value'], ['ABC', 12]])), /encabezados requeridos/);
});

test('invalid dates are rejected and unknown binary values do not become success or zero', () => {
  const { data, report } = parseWorkbook(fixture([
    headers,
    ['E1', '2025-02-31', 'Bogota', 'A', 1, 20, 30, 0],
    ['E2', '2025-01-01', 'Bogota', 'A', 4, 20, 30, 0],
  ]));
  assert.equal(report.rejectedRows, 1);
  assert.equal(data.shipments[0].onTime, null);
  assert.ok(report.invalidValues >= 2);
});

test('numeric Excel date serials import correctly across CommonJS and browser module builds', () => {
  const { data } = parseWorkbook(fixture([headers, ['E1', 45679, 'Bogota', 'A', 0, 0, 30, 0]]));
  assert.equal(data.shipments[0].date, '2025-01-22');
});
