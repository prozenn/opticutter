// Fixtures use the same HTML renderer as the app's print iframe.
import { mkdirSync, writeFileSync } from 'node:fs';
import { demoData, planCuts, createSnapshot } from '../lib/planner.mjs';
import { renderPrintHTML } from '../lib/print.mjs';
mkdirSync('tmp/pdfs', { recursive: true });
const data = demoData();
writeFileSync(
  'tmp/pdfs/plan.html',
  renderPrintHTML(
    createSnapshot(
      data,
      'steel',
      'Rama — plan dla operatora',
      planCuts(data, 'steel'),
    ),
  ),
);
data.orders = Array.from({ length: 75 }, (_, i) => ({
  id: `row${i}`,
  materialId: 'steel',
  length: 400 + i * 10,
  quantity: (i % 5) + 1,
  label: `Element ${i + 1} — poprzeczka / długość kontrolna`,
}));
writeFileSync(
  'tmp/pdfs/list.html',
  renderPrintHTML(
    createSnapshot(data, 'steel', 'Zlecenie 24 — lista wielostronicowa'),
  ),
);
