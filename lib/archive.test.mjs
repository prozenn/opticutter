import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoData,
  validate,
  createSnapshot,
  planCuts,
  completePlan,
} from './planner.mjs';
import { renderPrintHTML } from './print.mjs';
test('snapshot is detached from stock, materials and later row edits', () => {
  const d = demoData(),
    before = JSON.stringify(d),
    entry = createSnapshot(d, 'steel', 'Rama');
  assert.equal(JSON.stringify(d), before);
  d.orders[0].length = 99;
  d.materials[0].name = 'Changed';
  assert.equal(entry.rows[0].length, 1200);
  assert.equal(entry.material.name, 'Stal S235');
  assert.equal(entry.name, 'Rama');
  assert.equal(entry.archived, true);
  assert.equal(entry.fingerprint, undefined);
  assert.equal(entry.stock, undefined);
});
test('archive survives completion and preserves exact bar sequence', () => {
  const d = demoData(),
    p = planCuts(d, 'steel'),
    entry = createSnapshot(d, 'steel', '', p);
  d.archive = [entry];
  const live = { ...p, fingerprint: JSON.stringify(d) };
  const next = completePlan(d, live);
  assert.equal(next.orders.length, 0);
  assert.deepEqual(next.archive, [entry]);
  assert.deepEqual(
    entry.bars[0].pieces.map((p) => p.length),
    p.bars[0].pieces.map((p) => p.length),
  );
  assert.equal(entry.bars[0].stockId, undefined);
  assert.throws(() => completePlan(next, entry), /Archiwalny/);
  assert.throws(() => completePlan(next, live));
});
test('JSON backups retain archive even when original material was removed', () => {
  const d = demoData();
  const entry = createSnapshot(d, 'steel', 'Rama');
  const backup = {
    ...d,
    materials: [],
    orders: [],
    stock: [],
    archive: [entry],
  };
  assert.deepEqual(validate(JSON.parse(JSON.stringify(backup))).archive, [
    entry,
  ]);
  assert.doesNotThrow(() => validate(d));
});
test('stale, missing and mixed plan snapshots are rejected', () => {
  const d = demoData(),
    p = planCuts(d, 'steel');
  assert.throws(() => createSnapshot(d, 'wood', ''));
  d.kerf = 4;
  assert.throws(() => createSnapshot(d, 'steel', '', p));
  d.orders[0].length = 8000;
  assert.throws(() => createSnapshot(d, 'steel', '', planCuts(d, 'steel')));
});
test('invalid imported archive fails without corrupting source', () => {
  const d = demoData(),
    entry = createSnapshot(d, 'steel', '', planCuts(d, 'steel'));
  const broken = structuredClone(entry);
  broken.bars[0].remaining += 1;
  assert.throws(() => validate({ ...d, archive: [broken] }));
  assert.throws(() => validate({ ...d, archive: [entry, entry] }));
  const mismatch = structuredClone(entry);
  mismatch.rows[0].quantity++;
  assert.throws(() => validate({ ...d, archive: [mismatch] }));
  assert.doesNotThrow(() => validate({ ...d, archive: [entry] }));
});
test('print documents escape text and omit app chrome and charts', () => {
  const d = demoData();
  d.orders[0].label = '<script>alert(1)</script>';
  const entry = createSnapshot(d, 'steel', '<img src=x>');
  const html = renderPrintHTML(entry);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<svg'));
  assert.ok(!html.includes('<button'));
  assert.ok(html.includes('table-header-group'));
  assert.ok(html.includes('A4'));
  assert.ok(html.includes('1200'));
});
test('plan print labels bars and combines only adjacent identical pieces', () => {
  const d = demoData(),
    p = planCuts(d, 'steel');
  const html = renderPrintHTML(createSnapshot(d, 'steel', 'Plan', p));
  assert.ok(html.includes('Sztanga / wsad (mm)'));
  assert.ok(html.includes('Kolejność'));
  assert.ok(html.includes('Rzaz: 3 mm'));
  assert.ok(html.includes('zachować'));
  assert.ok(html.includes('new-bar'));
});

test('new archive writes accept only calculated plans and replace duplicate saves', async () => {
  const { archivePlan, demoData, planCuts, createSnapshot } = await import('./planner.mjs');
  const data = demoData();
  const materialId = data.orders[0].materialId;
  assert.throws(() => archivePlan(data, createSnapshot(data, materialId)), /przeliczony/);
  const plan = planCuts(data, materialId);
  const snapshot = createSnapshot(data, materialId, 'Test', plan);
  const saved = archivePlan(data, snapshot);
  assert.equal(saved.archive[0].kind, 'plan');
  assert.equal(archivePlan(saved, { ...snapshot, name: 'Nowa nazwa' }).archive.length, 1);
  assert.deepEqual(saved.stock, data.stock);
});
