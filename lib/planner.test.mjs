import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planCuts,
  completePlan,
  emptyData,
  defaultMaterials,
  validate,
  demoData,
} from './planner.mjs';
test('fresh data contains only the configured default sections', () => {
  assert.deepEqual(
    defaultMaterials().map((m) => m.section),
    [
      'Profil 40 × 40 × 2',
      'Profil 40 × 20 × 2',
      'Profil 20 × 20 × 2',
      'Profil 20 × 20 × 1,5',
      'Płaskownik 40 × 2',
      'Płaskownik 80 × 5',
    ],
  );
  assert.deepEqual(emptyData().materials, defaultMaterials());
});
const fixture = (length = 1000, quantity = 1) => ({
  ...emptyData(),
  materials: [
    { id: 'm', name: 'Stal', section: '40x40', purchaseLength: 6000 },
  ],
  stock: [{ id: 's', materialId: 'm', length, quantity, kind: 'full' }],
  orders: [{ id: 'o', materialId: 'm', length: 500, quantity: 1 }],
});
test('exact end uses no kerf', () => {
  const d = fixture(1000);
  d.orders[0].quantity = 2;
  d.kerf = 0;
  const p = planCuts(d);
  assert.equal(p.bars.length, 1);
  assert.equal(p.bars[0].remaining, 0);
  d.stock[0].length = 500;
  d.orders[0].quantity = 1;
  d.kerf = 3;
  assert.equal(planCuts(d).bars[0].kerfLoss, 0);
});
test('kerf prevents impossible fit', () => {
  const d = fixture(502);
  const p = planCuts(d);
  assert.equal(p.bars[0].kind, 'purchase');
  assert.equal(p.bars[0].remaining, 5497);
});
test('smallest adequate remnant used first', () => {
  const d = fixture(6000);
  d.stock.push({
    id: 'r',
    materialId: 'm',
    kind: 'remnant',
    length: 600,
    quantity: 1,
  });
  assert.equal(planCuts(d).bars[0].stockId, 'r');
});
test('stock is preferred even when a purchase bar is open', () => {
  const d = fixture(600);
  d.orders = [
    { id: 'a', materialId: 'm', length: 2000, quantity: 1 },
    { id: 'b', materialId: 'm', length: 500, quantity: 1 },
  ];
  const p = planCuts(d);
  assert.equal(p.bars.length, 2);
  assert.equal(p.bars[1].stockId, 's');
});
test('material groups never mix', () => {
  const d = fixture();
  d.materials.push({
    id: 'n',
    name: 'Stal',
    section: '50x50',
    purchaseLength: 6000,
  });
  d.orders[0].materialId = 'n';
  assert.equal(planCuts(d).bars[0].kind, 'purchase');
});
test('oversize is reported and completion blocked', () => {
  const d = fixture();
  d.orders[0].length = 7000;
  const p = planCuts(d);
  assert.equal(p.missing.length, 1);
  assert.throws(() => completePlan(d, p, true));
});
test('completion decrements inventory, retains remnant, clears order', () => {
  const d = fixture(1000, 2),
    p = planCuts(d),
    next = completePlan(d, p);
  assert.equal(next.stock.find((s) => s.id === 's').quantity, 1);
  assert.equal(next.stock.find((s) => s.kind === 'remnant').length, 497);
  assert.equal(next.orders.length, 0);
  assert.equal(next.history.length, 1);
  assert.equal(d.stock[0].quantity, 2);
  assert.throws(() => completePlan(next, p));
});

test('completion records an undo checkpoint that restores the prior state', () => {
  const data = demoData();
  const plan = planCuts(data, 'steel');
  const next = completePlan(data, plan);
  assert.equal(next.history[0].undo.orders.length, data.orders.length);
  const restored = {
    ...next.history[0].undo,
    history: next.history.slice(1),
  };
  assert.deepEqual(restored.stock, data.stock);
  assert.deepEqual(restored.orders, data.orders);
});
test('stale plans and unreceived purchases rejected', () => {
  const d = fixture(100),
    p = planCuts(d);
  assert.throws(() => completePlan(d, p));
  assert.equal(completePlan(d, p, true).orders.length, 0);
  d.kerf = 4;
  assert.throws(() => completePlan(d, p, true));
});
test('tiny remainders discarded; decimals preserved', () => {
  const d = fixture(503.4);
  d.kerf = 3.1;
  const p = planCuts(d);
  assert.equal(p.bars[0].remaining, 0.3);
  assert.equal(completePlan(d, p).stock.length, 0);
});
test('invalid quantities and foreign keys rejected', () => {
  const d = fixture();
  d.orders[0].quantity = -1;
  assert.throws(() => validate(d));
  d.orders[0].quantity = 1;
  d.orders[0].materialId = 'missing';
  assert.throws(() => validate(d));
});
test('conservation of material across 100 varied plans', () => {
  for (let i = 1; i <= 100; i++) {
    const d = fixture(6000, 2);
    d.orders = [
      { id: 'a', materialId: 'm', length: i * 17 + 0.1, quantity: 7 },
      { id: 'b', materialId: 'm', length: 600, quantity: 5 },
    ];
    const p = planCuts(d);
    assert.equal(p.missing.length, 0);
    assert.equal(
      p.bars.reduce((n, b) => n + b.pieces.length, 0),
      12,
    );
    for (const b of p.bars) {
      assert.ok(b.remaining >= 0);
      assert.ok(
        Math.abs(
          b.length -
            b.remaining -
            b.kerfLoss -
            b.pieces.reduce((s, x) => s + x.length, 0),
        ) < 0.0001,
      );
    }
    const used = p.bars.filter((b) => b.stockId === 's').length;
    assert.ok(used <= 2);
  }
});
test('example runs entirely from stock', () => {
  const d = demoData();
  const p = planCuts(d);
  assert.equal(p.bars.filter((b) => b.kind === 'purchase').length, 0);
  assert.equal(completePlan(d, p).orders.length, 0);
});

test('single-material lists preserve legacy mixed orders without migration', async () => {
  const { cuttingLists } = await import('./planner.mjs');
  const d = demoData();
  d.orders.push({
    id: 'wood-order',
    materialId: 'wood',
    length: 900,
    quantity: 2,
  });
  const snapshot = JSON.stringify(d);
  const lists = cuttingLists(d);
  assert.equal(lists.length, 2);
  assert.equal(lists.find((l) => l.materialId === 'steel').rows.length, 2);
  assert.equal(lists.find((l) => l.materialId === 'wood').rows.length, 1);
  assert.equal(JSON.stringify(d), snapshot);
});
test('scoped plan and completion preserve other lists and their inventory', () => {
  const d = demoData();
  d.orders.push({
    id: 'wood-order',
    materialId: 'wood',
    length: 900,
    quantity: 2,
  });
  const other = d.orders.filter((r) => r.materialId === 'steel');
  const stock = d.stock.filter((r) => r.materialId === 'steel');
  const plan = planCuts(d, 'wood');
  assert.ok(plan.bars.every((b) => b.materialId === 'wood'));
  assert.equal(
    plan.bars.reduce((s, b) => s + b.pieces.length, 0),
    2,
  );
  const next = completePlan(d, plan);
  assert.deepEqual(next.orders, other);
  assert.deepEqual(
    next.stock.filter((r) => r.materialId === 'steel'),
    stock,
  );
  assert.throws(() => completePlan(next, plan));
});
test('unknown list rejected, empty list consumes nothing', () => {
  const d = demoData();
  assert.throws(() => planCuts(d, 'unknown'));
  const p = planCuts(d, 'wood');
  assert.equal(p.bars.length, 0);
  assert.throws(() => completePlan(d, p));
});
