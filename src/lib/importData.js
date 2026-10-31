import * as XLSXModule from 'xlsx';
const XLSX = Reflect.get(XLSXModule, 'default') ?? XLSXModule;

const normalize = value => String(value ?? '').replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const shipmentColumns = [
  ['id', 'ID'], ['date', 'Fecha pedido'], ['center', 'Centro'], ['client', 'Cliente'],
  ['segment', 'Segmento'], ['zone', 'Zona'], ['driver', 'Conductor'],
  ['tenure', 'Antiguedad conductor meses'], ['training', 'Capacitacion horas'],
  ['routeChanges', 'Cambios ruta'], ['promiseHours', 'Promesa horas'], ['deliveryHours', 'Entrega horas'],
  ['onTime', 'A tiempo'], ['claim', 'Reclamo'], ['returned', 'Devolucion'],
  ['cost', 'Costo COP'], ['revenue', 'Ingreso COP'], ['complete', 'Registro completo'],
  ['vehicleFailure', 'Falla vehiculo'], ['overtime', 'Horas extra turno'], ['load', 'Carga ruta paquetes'],
];
const personnelColumns = [
  ['month', 'Mes'], ['headcount', 'Plantilla media'], ['hired', 'Ingresos'], ['departures', 'Retiros'],
  ['absenceDays', 'Ausencias dias'], ['trainingHours', 'Horas formacion'], ['vacancies', 'Vacantes cierre'], ['overtimeHours', 'Horas extra total'],
];
const financeColumns = [
  ['month', 'Mes'], ['revenue', 'Ingresos MM COP'], ['operatingCosts', 'Costos operativos MM COP'],
  ['adminCosts', 'Gastos admin MM COP'], ['overdue', 'Cartera vencida MM COP'], ['cash', 'Efectivo cierre MM COP'], ['penalties', 'Penalizaciones MM COP'],
];
const offerColumns = [
  ['code', 'Codigo'], ['name', 'Alternativa'], ['cost', 'Costo MM COP'], ['months', 'Plazo meses'], ['condition', 'Condicion contractual'], ['risk', 'Riesgo declarado'],
];
const shipmentText = new Set(['id', 'date', 'center', 'client', 'segment', 'zone', 'driver']);
const binaryFields = new Set(['onTime', 'claim', 'returned', 'complete', 'vehicleFailure']);
const isBlank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
const textValue = value => isBlank(value) ? null : String(value).trim();
function numberValue(value) {
  if (isBlank(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  let clean = String(value).trim().replace(/\s|COP|\$/gi, '');
  // Unambiguous locale decimal forms, retaining true zeros.
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(clean)) clean = clean.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(clean)) clean = clean.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(clean)) clean = clean.replace(',', '.');
  const result = Number(clean);
  return Number.isFinite(result) ? result : null;
}
function dateValue(value) {
  if (isBlank(value)) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : null;
  }
  const string = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(string)) {
    const candidate = string.slice(0, 10);
    const parsed = new Date(`${candidate}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate ? candidate : null;
  }
  const match = string.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return dateValue(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
  return null;
}
function monthValue(value) {
  const text = String(value ?? '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text;
  return dateValue(value)?.slice(0, 7) ?? null;
}
function grid(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false });
}
function columnMap(headers, columns) {
  return Object.fromEntries(columns.map(([key, label]) => [key, headers.findIndex(header => normalize(header) === normalize(label) || normalize(header) === normalize(key))]));
}
function assertHeaders(map, required, name) {
  const missing = required.filter(key => map[key] < 0);
  if (missing.length) throw new Error(`La hoja «${name}» no tiene los encabezados requeridos: ${missing.join(', ')}.`);
}
function readTable(sheet, columns, required, name, textFields, report) {
  const rows = grid(sheet);
  if (rows.length < 2) throw new Error(`La hoja «${name}» no contiene registros.`);
  const map = columnMap(rows[0], columns);
  assertHeaders(map, required, name);
  const missingHeaders = columns.filter(([key]) => map[key] < 0).map(([, label]) => label);
  if (missingHeaders.length) report.warnings.push(`${name}: columnas ausentes (${missingHeaders.join(', ')}); sus valores se conservan como desconocidos.`);
  return rows.slice(1).filter(row => row.some(value => !isBlank(value))).map((row, index) => {
    const parsed = {};
    for (const [key] of columns) {
      const original = map[key] >= 0 ? row[map[key]] : null;
      let value = key === 'date' ? dateValue(original) : key === 'month' ? monthValue(original) : textFields.has(key) ? textValue(original) : numberValue(original);
      if (binaryFields.has(key) && value !== null && value !== 0 && value !== 1) value = null;
      if (value === null) report.missingValues++;
      if (value === null && !isBlank(original)) report.invalidValues++;
      parsed[key] = value;
    }
    return { parsed, row: index + 2 };
  });
}

/** Read original Excel sheets or a CSV converted to a SheetJS workbook. Never invent missing values. */
export function parseWorkbook(workbook) {
  if (!workbook?.Sheets || !Array.isArray(workbook.SheetNames) || !workbook.SheetNames.length) throw new Error('El archivo no contiene hojas de datos válidas.');
  const report = { type: 'workbook', shipmentCount: 0, personnelCount: 0, financeCount: 0, duplicates: 0, rejectedRows: 0, missingValues: 0, invalidValues: 0, warnings: [], importedSheets: [] };
  const namedSheet = expected => workbook.SheetNames.find(name => normalize(name) === normalize(expected));
  let shipmentName = namedSheet('Envios_muestra');
  if (!shipmentName && workbook.SheetNames.length === 1) shipmentName = workbook.SheetNames[0];
  if (!shipmentName) throw new Error('No se encontró la hoja «Envios_muestra». Para CSV, usa los encabezados de esa hoja.');
  const rawShipments = readTable(workbook.Sheets[shipmentName], shipmentColumns, ['id', 'date', 'center', 'client', 'onTime'], shipmentName, shipmentText, report);
  const ids = new Set();
  const shipments = [];
  for (const { parsed } of rawShipments) {
    if (!parsed.id || !parsed.date) { report.rejectedRows++; continue; }
    if (ids.has(parsed.id)) { report.duplicates++; continue; }
    ids.add(parsed.id);
    shipments.push(parsed);
  }
  if (!shipments.length) throw new Error('No hay envíos válidos. Revisa los identificadores y fechas de pedido.');
  report.importedSheets.push(shipmentName);
  const data = {
    meta: { source: 'Archivo importado', period: [...new Set(shipments.map(row => row.date.slice(0, 4)))].join(', '), imported: true, notes: ['Datos cargados por el usuario. Los valores ausentes no se sustituyen por cero.'] },
    shipments, personnel: [], finances: [], offers: [], meetings: [], areas: [],
  };
  for (const spec of [
    { name: 'Personal_mensual', target: 'personnel', columns: personnelColumns, required: ['month', 'headcount', 'departures'], text: new Set(['month']) },
    { name: 'Finanzas_mensual', target: 'finances', columns: financeColumns, required: ['month', 'revenue', 'operatingCosts', 'adminCosts'], text: new Set(['month']) },
    { name: 'Ofertas_inversion', target: 'offers', columns: offerColumns, required: ['code', 'name', 'cost'], text: new Set(['code', 'name', 'condition', 'risk']) },
  ]) {
    const sheetName = namedSheet(spec.name);
    if (!sheetName) continue;
    const parsed = readTable(workbook.Sheets[sheetName], spec.columns, spec.required, sheetName, spec.text, report);
    const seen = new Set();
    for (const { parsed: row } of parsed) {
      const identity = spec.target === 'offers' ? row.code : row.month;
      if (!identity) { report.rejectedRows++; continue; }
      if (seen.has(identity)) throw new Error(`La hoja «${sheetName}» contiene un periodo o código duplicado (${identity}). Corrige el archivo para evitar sumar valores dos veces.`);
      seen.add(identity);
      data[spec.target].push(row);
    }
    report.importedSheets.push(sheetName);
  }
  const contextName = namedSheet('Contexto');
  if (contextName) {
    data.meta.notes = grid(workbook.Sheets[contextName]).map(row => row[0]).filter(value => typeof value === 'string');
    data.meta.academic = data.meta.notes.some(note => /ficticios|academica|académica/i.test(note));
  }
  report.type = data.personnel.length || data.finances.length ? 'workbook' : 'shipments';
  report.shipmentCount = shipments.length;
  report.personnelCount = data.personnel.length;
  report.financeCount = data.finances.length;
  if (report.duplicates) report.warnings.push(`Se omitieron ${report.duplicates} envíos duplicados por ID; se conservó la primera aparición.`);
  if (report.rejectedRows) report.warnings.push(`Se omitieron ${report.rejectedRows} filas sin identificador o fecha válida.`);
  if (report.invalidValues) report.warnings.push(`${report.invalidValues} valores no válidos se conservaron como desconocidos.`);
  return { data, report };
}
