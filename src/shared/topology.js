const STORES = {
  'store-01': { store: 'store-01', region: 'melbourne-east', x: 3, y: 4 },
  'store-02': { store: 'store-02', region: 'melbourne-east', x: 6, y: 8 },
  'store-03': { store: 'store-03', region: 'melbourne-west', x: 4, y: 3 },
  'store-04': { store: 'store-04', region: 'melbourne-west', x: 8, y: 6 }
};

const DEPOTS = {
  'Dairy Distribution Centre': { x: 0, y: 0 },
  'Dry Goods Distribution Centre': { x: 1, y: 1 }
};

function getStore(store) {
  if (!Object.hasOwn(STORES, store)) throw new Error('Unknown store: ' + store);
  return { ...STORES[store] };
}

function getDepot(supplier) {
  if (!Object.hasOwn(DEPOTS, supplier)) throw new Error('Unknown supplier: ' + supplier);
  return { ...DEPOTS[supplier] };
}

function batchKey(order) {
  return encodeURIComponent(order.supplier) + ':' + getStore(order.store).region;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function nearestNeighbour(start, stops) {
  const pending = stops.map(stop => ({ ...stop }));
  const route = [];
  let current = start;
  while (pending.length) {
    pending.sort((a, b) => distance(current, a) - distance(current, b) || a.id.localeCompare(b.id));
    current = pending.shift();
    route.push(current);
  }
  return route;
}

function routeWithEtas(start, stops, speedKmPerHour, startedAt) {
  if (!Number.isFinite(speedKmPerHour) || speedKmPerHour <= 0) throw new Error('Speed must be positive');
  let current = start;
  let elapsedMs = 0;
  return nearestNeighbour(start, stops).map(stop => {
    const distanceKm = distance(current, stop);
    elapsedMs += distanceKm / speedKmPerHour * 60 * 60 * 1000;
    current = stop;
    return { ...stop, distanceKm: Number(distanceKm.toFixed(2)), eta: Math.round(startedAt + elapsedMs) };
  });
}

module.exports = { DEPOTS, STORES, batchKey, distance, getDepot, getStore, nearestNeighbour, routeWithEtas };
