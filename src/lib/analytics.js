/** Workbook measures keep shipment samples separate from corporate monthly totals. */
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const values = (rows, key) => rows.map(row => row[key]).filter(numeric);
const sum = (rows, key) => {
  const known = values(rows, key);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
};
const average = (rows, key) => {
  const known = values(rows, key);
  return known.length ? known.reduce((total, value) => total + value, 0) / known.length : null;
};
const percentage = (part, whole) => numeric(part) && numeric(whole) && whole > 0 ? part / whole * 100 : null;
const rate = (rows, key) => {
  const known = rows.map(row => row[key]).filter(value => value === 0 || value === 1);
  return known.length ? known.reduce((total, value) => total + value, 0) / known.length * 100 : null;
};
const latest = rows => [...rows].sort((a, b) => a.month.localeCompare(b.month)).at(-1);
const selected = (month, period) => {
  if (!period || period === 'all') return true;
  if (/^Q[1-4]$/.test(period)) return Math.ceil(Number(month.slice(5, 7)) / 3) === Number(period[1]);
  return month === period;
};
export const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function aggregateShipments(rows = []) {
  const cost = sum(rows, 'cost');
  const revenue = sum(rows, 'revenue');
  // Use paired monetary observations for profit; unknown entries remain unknown.
  const paired = rows.filter(row => numeric(row.cost) && numeric(row.revenue));
  const profit = paired.length ? paired.reduce((total, row) => total + row.revenue - row.cost, 0) : null;
  const pairedRevenue = sum(paired, 'revenue');
  return {
    count: rows.length,
    onTimeRate: rate(rows, 'onTime'),
    claimRate: rate(rows, 'claim'),
    returnRate: rate(rows, 'returned'),
    cost, revenue, averageCost: average(rows, 'cost'), profit,
    margin: percentage(profit, pairedRevenue),
    incomplete: rows.filter(row => row.complete === 0).length,
  };
}

export function summarizeFinance(rows = []) {
  const revenue = sum(rows, 'revenue');
  const operatingCosts = sum(rows, 'operatingCosts');
  const adminCosts = sum(rows, 'adminCosts');
  const complete = rows.filter(row => ['revenue', 'operatingCosts', 'adminCosts'].every(key => numeric(row[key])));
  const profit = complete.length ? complete.reduce((total, row) => total + row.revenue - row.operatingCosts - row.adminCosts, 0) : null;
  const closing = latest(rows);
  return {
    revenue, operatingCosts, adminCosts, profit,
    margin: percentage(profit, sum(complete, 'revenue')),
    overdue: numeric(closing?.overdue) ? closing.overdue : null,
    cash: numeric(closing?.cash) ? closing.cash : null,
    penalties: sum(rows, 'penalties'), month: closing?.month ?? null,
  };
}

export function summarizePersonnel(rows = []) {
  const headcount = average(rows, 'headcount');
  const departures = sum(rows, 'departures');
  const closing = latest(rows);
  return {
    headcount, departures, turnover: percentage(departures, headcount),
    trainingHours: sum(rows, 'trainingHours'), absenceDays: sum(rows, 'absenceDays'),
    overtimeHours: sum(rows, 'overtimeHours'), vacancies: numeric(closing?.vacancies) ? closing.vacancies : null,
  };
}

export function filterData(data, filters = {}) {
  const dimensions = ['center', 'client', 'zone', 'segment', 'driver'];
  return {
    shipments: (data.shipments ?? []).filter(row => selected(row.date?.slice(0, 7) ?? '', filters.period) && dimensions.every(key => !filters[key] || filters[key] === 'all' || row[key] === filters[key])),
    personnel: (data.personnel ?? []).filter(row => selected(row.month, filters.period)),
    finances: (data.finances ?? []).filter(row => selected(row.month, filters.period)),
  };
}

export function groupShipments(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const name = row[key] ?? 'Sin dato';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  }
  return [...groups.entries()].map(([name, group]) => ({ name, ...aggregateShipments(group) })).sort((a, b) => b.count - a.count);
}

export function monthlyMetrics(data, filters = {}) {
  const filtered = filterData(data, filters);
  const months = [...new Set([
    ...(data.shipments ?? []).map(row => row.date?.slice(0, 7)),
    ...(data.personnel ?? []).map(row => row.month),
    ...(data.finances ?? []).map(row => row.month),
  ].filter(Boolean))].sort().filter(month => selected(month, filters.period));
  return months.map(month => {
    const shipments = aggregateShipments(filtered.shipments.filter(row => row.date.slice(0, 7) === month));
    const finance = summarizeFinance(filtered.finances.filter(row => row.month === month));
    const people = summarizePersonnel(filtered.personnel.filter(row => row.month === month));
    return {
      month, label: MONTH_LABELS[Number(month.slice(5, 7)) - 1],
      count: shipments.count, onTimeRate: shipments.onTimeRate, claimRate: shipments.claimRate,
      revenue: finance.revenue, profit: finance.profit, margin: finance.margin,
      overdue: finance.overdue, cash: finance.cash, penalties: finance.penalties,
      headcount: people.headcount, turnover: people.turnover,
      trainingHours: people.trainingHours, overtimeHours: people.overtimeHours,
    };
  });
}
