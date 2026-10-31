/**
 * Illustrative city route plans. Coordinates are fixed geographic reference
 * points, never addresses or GPS observations from the supplied shipments.
 * Assignment is deterministic so filters keep each shipment at the same stop.
 */
const PALETTE = ['#247b68', '#d0a055', '#6c86ae'];
const CITY_INPUTS = [
  { key: 'Bogota', name: 'Bogotá', hub: [4.711, -74.0721], routes: [
    [[4.746, -74.044], [4.774, -74.041], [4.761, -74.077], [4.733, -74.081]],
    [[4.704, -74.061], [4.682, -74.047], [4.661, -74.074], [4.686, -74.103]],
    [[4.651, -74.112], [4.626, -74.137], [4.598, -74.124], [4.623, -74.092]],
  ] },
  { key: 'Medellin', name: 'Medellín', hub: [6.2442, -75.5812], routes: [
    [[6.267, -75.573], [6.289, -75.565], [6.307, -75.579], [6.284, -75.594]],
    [[6.257, -75.564], [6.241, -75.552], [6.229, -75.572], [6.244, -75.598]],
    [[6.222, -75.577], [6.201, -75.57], [6.181, -75.593], [6.206, -75.608]],
  ] },
  { key: 'Cali', name: 'Cali', hub: [3.4516, -76.532], routes: [
    [[3.474, -76.528], [3.497, -76.516], [3.516, -76.535], [3.488, -76.547]],
    [[3.459, -76.515], [3.441, -76.502], [3.427, -76.526], [3.446, -76.55]],
    [[3.418, -76.535], [3.397, -76.525], [3.377, -76.547], [3.402, -76.558]],
  ] },
  { key: 'Barranquilla', name: 'Barranquilla', hub: [10.9685, -74.7813], routes: [
    [[10.991, -74.801], [11.012, -74.815], [11.025, -74.795], [11.002, -74.777]],
    [[10.984, -74.785], [10.971, -74.765], [10.955, -74.779], [10.97, -74.804]],
    [[10.948, -74.795], [10.927, -74.791], [10.913, -74.768], [10.94, -74.758]],
  ] },
];
const ROUTE_NAMES = ['Norte', 'Centro', 'Sur'];
const freeze = object => { Object.values(object).forEach(value => { if (value && typeof value === 'object') freeze(value); }); return Object.freeze(object); };
export const CITY_ROUTES = freeze(Object.fromEntries(CITY_INPUTS.map(city => [city.key, {
  key: city.key, name: city.name, simulated: true,
  hub: { id: `${city.key}-hub`, label: `Centro de referencia · ${city.name}`, lat: city.hub[0], lon: city.hub[1], simulated: true },
  routes: city.routes.map((coordinates, routeIndex) => ({
    id: `${city.key}-${ROUTE_NAMES[routeIndex].toLowerCase()}`,
    label: `Ruta ${ROUTE_NAMES[routeIndex]}`, color: PALETTE[routeIndex], simulated: true,
    stops: coordinates.map(([lat, lon], pointIndex) => ({
      id: `${city.key}-p${String(routeIndex * 4 + pointIndex + 1).padStart(2, '0')}`,
      label: `Punto simulado ${String(routeIndex * 4 + pointIndex + 1).padStart(2, '0')}`,
      lat, lon, zone: ROUTE_NAMES[routeIndex], simulated: true,
    })),
  })),
}])));

const normalizeCity = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
function resolveCity(key) { return Object.values(CITY_ROUTES).find(city => normalizeCity(city.key) === normalizeCity(key)); }
function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function shipmentKey(row) {
  if (row.id != null && String(row.id).trim() !== '') return String(row.id).trim();
  // Do not use array positions: reducing or sorting the selection must not move a stop.
  return JSON.stringify(['date', 'center', 'client', 'driver', 'zone', 'cost', 'revenue', 'deliveryHours', 'promiseHours', 'onTime', 'claim', 'returned'].map(key => row[key] ?? null));
}
function summarize(rows) {
  const flags = field => {
    const known = rows.filter(row => row[field] === 0 || row[field] === 1);
    const count = known.filter(row => row[field] === 1).length;
    return { count, known: known.length, rate: known.length ? count / known.length * 100 : null };
  };
  const onTime = flags('onTime'), claim = flags('claim'), returned = flags('returned');
  const costs = rows.map(row => row.cost).filter(value => typeof value === 'number' && Number.isFinite(value));
  return {
    count: rows.length,
    onTimeCount: onTime.count, onTimeKnownCount: onTime.known, onTimeRate: onTime.rate,
    claimCount: claim.count, claimKnownCount: claim.known, claimRate: claim.rate,
    returnCount: returned.count, returnKnownCount: returned.known, returnRate: returned.rate,
    averageCost: costs.length ? costs.reduce((total, value) => total + value, 0) / costs.length : null,
  };
}

/** Unknown cities return null; known cities with no observations keep empty plans. */
export function createCityRoutePlan(shipments = [], cityKey) {
  const definition = resolveCity(cityKey);
  if (!definition) return null;
  const rows = (Array.isArray(shipments) ? shipments : []).filter(row => row && normalizeCity(row.center) === normalizeCity(definition.key));
  const buckets = Array.from({ length: 12 }, () => []);
  rows.forEach(row => buckets[stableHash(`${definition.key}:${shipmentKey(row)}`) % buckets.length].push(row));
  return {
    city: { key: definition.key, name: definition.name, simulated: true },
    hub: { ...definition.hub }, simulated: true,
    assignmentMethod: 'stable-id-hash',
    note: 'Puntos y asignación de rutas simulados; las coordenadas no provienen de direcciones ni recorridos GPS del archivo.',
    ...summarize(rows),
    routes: definition.routes.map((route, routeIndex) => {
      const routeRows = buckets.slice(routeIndex * 4, routeIndex * 4 + 4).flat();
      return { ...route, ...summarize(routeRows), stops: route.stops.map((point, pointIndex) => {
        const pointRows = buckets[routeIndex * 4 + pointIndex];
        return { ...point, ...summarize(pointRows), shipmentIds: pointRows.map(row => row.id ?? null) };
      }) };
    }),
  };
}

function coordinate(point) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) throw new TypeError('El punto requiere coordenadas geográficas válidas.');
  return `${point.lat},${point.lon}`;
}
function routeFrom(plan, routeId) {
  if (!plan?.hub || !Array.isArray(plan.routes)) throw new TypeError('Selecciona un plan de ciudad válido.');
  const route = routeId == null ? plan.routes[0] : plan.routes.find(item => item.id === routeId);
  if (!route?.stops?.length) throw new RangeError('La ruta seleccionada no contiene puntos.');
  return route;
}
function zoomLevel(value, fallback) { return value == null || !Number.isFinite(Number(value)) ? fallback : Math.max(3, Math.min(18, Math.round(Number(value)))); }

/**
 * Public Google Maps legacy embed. Google determines the road path; the stops
 * and their shipment allocation remain explicitly illustrative. No API key.
 */
export function buildGoogleRouteEmbed(plan, routeId, { zoom } = {}) {
  const route = routeFrom(plan, routeId);
  const url = new URL('https://www.google.com/maps');
  url.search = new URLSearchParams({
    f: 'd', saddr: coordinate(plan.hub),
    daddr: route.stops.map(coordinate).join(' to:'),
    dirflg: 'd', output: 'embed', hl: 'es', z: String(zoomLevel(zoom, 12)),
  }).toString();
  return url.toString();
}

/** Official Maps URLs directions link, with three waypoints at most per route. */
export function buildGoogleDirectionsUrl(plan, routeId) {
  const route = routeFrom(plan, routeId);
  const url = new URL('https://www.google.com/maps/dir/');
  const params = new URLSearchParams({ api: '1', origin: coordinate(plan.hub), destination: coordinate(route.stops.at(-1)), travelmode: 'driving' });
  if (route.stops.length > 1) params.set('waypoints', route.stops.slice(0, -1).map(coordinate).join('|'));
  url.search = params.toString();
  return url.toString();
}

export function buildGooglePointEmbed(point, { zoom } = {}) {
  const url = new URL('https://www.google.com/maps');
  url.search = new URLSearchParams({ q: coordinate(point), z: String(zoomLevel(zoom, 15)), output: 'embed', hl: 'es' }).toString();
  return url.toString();
}
