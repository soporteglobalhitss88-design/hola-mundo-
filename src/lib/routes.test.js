import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITY_ROUTES, createCityRoutePlan, buildGoogleRouteEmbed, buildGoogleDirectionsUrl, buildGooglePointEmbed } from './routes.js';
const data = JSON.parse(readFileSync(new URL('../data/workbook.json', import.meta.url)));
const flatStops = plan => plan.routes.flatMap(route => route.stops);
const assigned = plan => Object.fromEntries(flatStops(plan).flatMap(stop => stop.shipmentIds.map(id => [id, stop.id])));

test('all supplied city observations are assigned once, without inventing deliveries', () => {
  const counts = { Bogota: 1337, Medellin: 781, Cali: 599, Barranquilla: 283 };
  for (const [city, count] of Object.entries(counts)) {
    const plan = createCityRoutePlan(data.shipments, city);
    assert.equal(plan.count, count);
    assert.equal(plan.routes.length, 3);
    assert.equal(flatStops(plan).length, 12);
    assert.equal(plan.routes.reduce((sum, route) => sum + route.count, 0), count);
    const ids = flatStops(plan).flatMap(stop => stop.shipmentIds);
    assert.equal(ids.length, count);
    assert.equal(new Set(ids).size, count);
    assert.deepEqual([...ids].sort(), data.shipments.filter(row => row.center === city).map(row => row.id).sort());
    assert.equal(plan.onTimeCount, data.shipments.filter(row => row.center === city && row.onTime === 1).length);
  }
});

test('route and point assignments remain stable after sorting and filtering', () => {
  const complete = createCityRoutePlan(data.shipments, 'Bogota');
  const initial = assigned(complete);
  const januaryRows = [...data.shipments].reverse().filter(row => row.date.startsWith('2025-01'));
  const january = createCityRoutePlan(januaryRows, 'Bogota');
  for (const [id, point] of Object.entries(assigned(january))) assert.equal(initial[id], point);
  const noIdRows = [{ center: 'Cali', date: '2025-01-01', client: 'Prueba', cost: 0 }, { center: 'Cali', date: '2025-02-01', client: 'Otro', cost: 12 }];
  const before = createCityRoutePlan(noIdRows, 'Cali');
  const after = createCityRoutePlan([...noIdRows].reverse(), 'Cali');
  assert.deepEqual(flatStops(before).map(stop => stop.count), flatStops(after).map(stop => stop.count));
});

test('simulated geographic references stay within each city, distinct and immutable', () => {
  const bounds = { Bogota: [4.5, 4.85, -74.25, -73.95], Medellin: [6.15, 6.36, -75.66, -75.48], Cali: [3.28, 3.57, -76.6, -76.44], Barranquilla: [10.85, 11.08, -74.9, -74.72] };
  for (const [city, [south, north, west, east]] of Object.entries(bounds)) {
    const definition = CITY_ROUTES[city];
    const points = [definition.hub, ...definition.routes.flatMap(route => route.stops)];
    assert.equal(new Set(points.map(point => `${point.lat},${point.lon}`)).size, 13);
    for (const point of points) {
      assert.equal(point.simulated, true);
      assert.ok(point.lat >= south && point.lat <= north && point.lon >= west && point.lon <= east);
    }
    assert.ok(Object.isFrozen(definition.routes[0].stops[0]));
  }
  const fixture = [{ id: 'A', center: 'Bogota', onTime: 1, claim: null }];
  const input = structuredClone(fixture);
  const metadata = JSON.stringify(CITY_ROUTES);
  createCityRoutePlan(fixture, 'Bogota');
  assert.deepEqual(fixture, input);
  assert.equal(JSON.stringify(CITY_ROUTES), metadata);
});

test('empty selections, unknown fields and unknown cities remain distinguishable', () => {
  assert.equal(createCityRoutePlan(data.shipments, 'Ciudad inexistente'), null);
  const empty = createCityRoutePlan([], 'Cali');
  assert.equal(empty.count, 0);
  assert.ok(flatStops(empty).every(stop => stop.count === 0 && stop.onTimeRate === null && stop.averageCost === null));
  const plan = createCityRoutePlan([{ id: 'A', center: 'Bogotá', onTime: null, claim: 0, cost: 0 }], 'Bogota');
  assert.equal(plan.count, 1);
  assert.equal(plan.onTimeRate, null);
  assert.equal(plan.claimRate, 0);
  assert.equal(plan.averageCost, 0);
});

test('Google route and point URLs preserve stop order and contain no credentials', () => {
  const plan = createCityRoutePlan([], 'Medellin');
  const route = plan.routes[1];
  const coords = point => `${point.lat},${point.lon}`;
  const embed = new URL(buildGoogleRouteEmbed(plan, route.id, { zoom: 99 }));
  assert.equal(embed.hostname, 'www.google.com');
  assert.equal(embed.searchParams.get('output'), 'embed');
  assert.equal(embed.searchParams.get('saddr'), coords(plan.hub));
  assert.deepEqual(embed.searchParams.get('daddr').split(' to:'), route.stops.map(coords));
  assert.equal(embed.searchParams.get('z'), '18');
  const official = new URL(buildGoogleDirectionsUrl(plan, route.id));
  assert.equal(official.searchParams.get('api'), '1');
  assert.equal(official.searchParams.get('origin'), coords(plan.hub));
  assert.equal(official.searchParams.get('destination'), coords(route.stops.at(-1)));
  assert.deepEqual(official.searchParams.get('waypoints').split('|'), route.stops.slice(0, -1).map(coords));
  assert.equal(official.searchParams.get('travelmode'), 'driving');
  assert.equal(official.searchParams.has('key'), false);
  const point = new URL(buildGooglePointEmbed(route.stops[2]));
  assert.equal(point.searchParams.get('q'), coords(route.stops[2]));
  assert.equal(point.searchParams.get('z'), '15');
  assert.throws(() => buildGoogleRouteEmbed(plan, 'missing'), RangeError);
  assert.throws(() => buildGooglePointEmbed({ lat: 999, lon: 0 }), TypeError);
});
