const ITEMS = {
  'milk-1l': {
    skuId: 'milk-1l',
    name: 'Fresh Milk 1L',
    unitWeight: 1000,
    supplier: 'Dairy Distribution Centre',
    leadTimeDays: 2,
    price: 3.2
  },
  'yoghurt-500g': {
    skuId: 'yoghurt-500g',
    name: 'Natural Yoghurt 500g',
    unitWeight: 500,
    supplier: 'Dairy Distribution Centre',
    leadTimeDays: 2,
    price: 5.5
  },
  'rice-1kg': {
    skuId: 'rice-1kg',
    name: 'Rice 1kg',
    unitWeight: 1000,
    supplier: 'Dry Goods Distribution Centre',
    leadTimeDays: 3,
    price: 4.8
  }
};

function getSku(skuId) {
  if (!Object.hasOwn(ITEMS, skuId)) throw new Error('Unknown SKU: ' + skuId);
  const item = ITEMS[skuId];
  if (!item) throw new Error('Unknown SKU: ' + skuId);
  return item;
}

function listSkus() {
  return Object.values(ITEMS).map(item => ({ ...item }));
}

module.exports = { getSku, listSkus };
