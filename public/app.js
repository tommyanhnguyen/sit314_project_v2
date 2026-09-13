const containers = {
  stock: document.querySelector('#stock'),
  orders: document.querySelector('#orders'),
  alerts: document.querySelector('#alerts'),
  deliveries: document.querySelector('#deliveries')
};
const status = document.querySelector('#status');

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function card(lines, action = '') {
  return `<article class="card">${lines.map(line => `<div>${line}</div>`).join('')}${action}</article>`;
}

async function approve(orderId) {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ approvedBy: 'manager:tommy' })
  });
  if (!response.ok) throw new Error((await response.json()).error);
  await loadData();
}

async function complete(deliveryId) {
  const response = await fetch(`/api/deliveries/${encodeURIComponent(deliveryId)}/complete`, { method: 'POST' });
  if (!response.ok) throw new Error((await response.json()).error);
  await loadData();
}

async function loadData() {
  status.textContent = 'Loading...';
  try {
    const [stock, orders, alerts, deliveries] = await Promise.all(
      ['stock', 'orders', 'alerts', 'deliveries'].map(name => fetch('/api/' + name).then(response => response.json()))
    );

    containers.stock.innerHTML = stock.map(row => card([
      `<strong>${escapeHtml(row.store)} · ${escapeHtml(row.skuId)}</strong>`,
      `Quantity: ${escapeHtml(row.qty)}`,
      `Velocity: ${escapeHtml(row.velocityPerDay || 0)} per day`
    ])).join('') || '<p>No stock data.</p>';

    const pending = orders.filter(order => order.status === 'PENDING_APPROVAL');
    containers.orders.innerHTML = pending.map(order => card([
      `<strong>${escapeHtml(order.orderId)}</strong>`,
      `${escapeHtml(order.store)} · $${escapeHtml(order.value)}`
    ], `<button data-order="${escapeHtml(order.orderId)}">Approve</button>`)).join('') || '<p>No pending orders.</p>';

    containers.alerts.innerHTML = alerts.map(alert => card([
      `<strong>${escapeHtml(alert.store)} · ${escapeHtml(alert.data.unitId)}</strong>`,
      `${escapeHtml(alert.data.state)} at ${escapeHtml(alert.data.tempC)}°C`
    ])).join('') || '<p>No cold-chain alerts.</p>';

    containers.deliveries.innerHTML = deliveries.map(delivery => card([
      `<strong>${escapeHtml(delivery.deliveryId)}</strong>`,
      `${escapeHtml(delivery.store)} · ${escapeHtml(delivery.status)}`
    ], ['PLANNED', 'RESTOCK_PENDING'].includes(delivery.status)
      ? `<button data-delivery="${escapeHtml(delivery.deliveryId)}">Mark arrived</button>`
      : '')).join('') || '<p>No deliveries.</p>';

    status.textContent = 'Data updated.';
  } catch (error) {
    status.textContent = error.message;
  }
}

containers.orders.addEventListener('click', event => {
  const orderId = event.target.dataset.order;
  if (orderId) approve(orderId).catch(error => { status.textContent = error.message; });
});
containers.deliveries.addEventListener('click', event => {
  const deliveryId = event.target.dataset.delivery;
  if (deliveryId) complete(deliveryId).catch(error => { status.textContent = error.message; });
});
document.querySelector('#refresh').addEventListener('click', loadData);
loadData();
