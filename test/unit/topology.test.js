const test = require('node:test');
const assert = require('node:assert/strict');

const {
  batchKey,
  getDepot,
  getStore,
  nearestNeighbour,
  routeWithEtas
} = require('../../src/shared/topology');

test('resolves stores, depots and regional batch keys', () => {
  assert.equal(getStore('store-01').region, 'melbourne-east');
  assert.deepEqual(getDepot('Dairy Distribution Centre'), { x: 0, y: 0 });
  assert.equal(batchKey({ store: 'store-01', supplier: 'Dairy Distribution Centre' }),
    'Dairy%20Distribution%20Centre:melbourne-east');
  assert.throws(() => getStore('missing'), /Unknown store/);
});

test('nearest neighbour returns every store once in distance order', () => {
  const route = nearestNeighbour(
    { x: 0, y: 0 },
    [
      { id: 'far', x: 6, y: 8 },
      { id: 'near', x: 3, y: 4 },
      { id: 'middle', x: 3, y: 8 }
    ]
  );
  assert.deepEqual(route.map(stop => stop.id), ['near', 'middle', 'far']);
});

test('route ETAs accumulate travel time from the prior stop', () => {
  const route = routeWithEtas(
    { x: 0, y: 0 },
    [{ id: 'a', x: 3, y: 4 }, { id: 'b', x: 6, y: 8 }],
    10,
    1000
  );
  assert.deepEqual(route.map(stop => ({ id: stop.id, distanceKm: stop.distanceKm, eta: stop.eta })), [
    { id: 'a', distanceKm: 5, eta: 1801000 },
    { id: 'b', distanceKm: 5, eta: 3601000 }
  ]);
});
