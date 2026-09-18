export const uid = () => globalThis.crypto.randomUUID();
const tenth = (x) => Math.round(x * 10);
export function validate(data) {
  if (
    !data ||
    !Array.isArray(data.materials) ||
    !Array.isArray(data.stock) ||
    !Array.isArray(data.orders)
  )
    throw Error('Nieprawidłowy plik danych.');
  const dimension = (n) =>
    Number.isFinite(n) &&
    n > 0 &&
    n <= 1000000 &&
    Math.abs(n * 10 - Math.round(n * 10)) < 1e-7;
  const ids = new Set();
  for (const m of data.materials) {
    if (
      !m.id ||
      ids.has(m.id) ||
      typeof m.name !== 'string' ||
      !m.name.trim() ||
      typeof m.section !== 'string' ||
      !m.section.trim() ||
      !dimension(m.purchaseLength)
    )
      throw Error('Nieprawidłowy materiał.');
    ids.add(m.id);
  }
  for (const rows of [data.stock, data.orders]) {
    const seen = new Set();
    for (const r of rows) {
      if (
        !r.id ||
        seen.has(r.id) ||
        !ids.has(r.materialId) ||
        !dimension(r.length) ||
        !Number.isInteger(r.quantity) ||
        r.quantity < 1 ||
        r.quantity > 10000
      )
        throw Error('Nieprawidłowe odcinki lub ilości.');
      seen.add(r.id);
    }
  }
  for (const s of data.stock)
    if (!['full', 'remnant'].includes(s.kind))
      throw Error('Nieprawidłowa forma materiału.');
  for (const r of data.orders)
    if (r.label !== undefined && typeof r.label !== 'string')
      throw Error('Nieprawidłowy opis odcinka.');
  if (
    data.history !== undefined &&
    (!Array.isArray(data.history) ||
      data.history.some(
        (h) =>
          !h.id ||
          !Number.isFinite(Date.parse(h.date)) ||
          !Number.isInteger(h.bars) ||
          !Number.isInteger(h.pieces),
      ))
  )
    throw Error('Nieprawidłowa historia.');
  if (
    !Number.isFinite(data.kerf) ||
    data.kerf < 0 ||
    !Number.isFinite(data.minRemnant) ||
    data.minRemnant < 0 ||
    data.kerf > 1000000 ||
    data.minRemnant > 1000000 ||
    Math.abs(data.kerf * 10 - Math.round(data.kerf * 10)) > 1e-7 ||
    Math.abs(data.minRemnant * 10 - Math.round(data.minRemnant * 10)) > 1e-7
  )
    throw Error('Nieprawidłowe ustawienia cięcia.');
  if (data.orders.reduce((s, r) => s + r.quantity, 0) > 10000)
    throw Error('Maksymalnie 10 000 odcinków w planie.');
  if (data.archive !== undefined) validateArchive(data.archive);
  return data;
}
// Integer tenths of a millimetre prevent floating-point fit errors.
export function cuttingLists(data) {
  return data.materials.map((material) => ({
    materialId: material.id,
    material,
    rows: data.orders.filter((row) => row.materialId === material.id),
  }));
}
export function planCuts(data, materialId = null) {
  validate(data);
  if (materialId !== null && !data.materials.some((m) => m.id === materialId))
    throw Error('Wybierz materiał listy cięcia.');
  const k = tenth(data.kerf),
    bars = [],
    missing = [];
  for (const material of data.materials.filter(
    (m) => materialId === null || m.id === materialId,
  )) {
    const pieces = data.orders
      .filter((r) => r.materialId === material.id)
      .flatMap((r) =>
        Array.from({ length: r.quantity }, () => ({
          orderId: r.id,
          label: r.label || '',
          length: r.length,
        })),
      )
      .sort((a, b) => b.length - a.length);
    const available = data.stock
      .filter((s) => s.materialId === material.id)
      .map((s) => ({ ...s, left: s.quantity }));
    const local = [];
    const fits = (remaining, length) =>
      remaining === length || remaining >= length + k;
    for (const piece of pieces) {
      const len = tenth(piece.length);
      let bar = local
        .filter((b) => b.kind !== 'purchase' && fits(b.remaining, len))
        .sort((a, b) => a.remaining - b.remaining)[0];
      if (!bar) {
        const source = available
          .filter((s) => s.left > 0 && fits(tenth(s.length), len))
          .sort(
            (a, b) => a.length - b.length || (a.kind === 'remnant' ? -1 : 1),
          )[0];
        if (source) {
          source.left--;
          bar = {
            id: uid(),
            materialId: material.id,
            stockId: source.id,
            kind: source.kind,
            length: source.length,
            remaining: tenth(source.length),
            pieces: [],
            kerfLoss: 0,
          };
        } else if (
          local.some((b) => b.kind === 'purchase' && fits(b.remaining, len))
        ) {
          bar = local
            .filter((b) => b.kind === 'purchase' && fits(b.remaining, len))
            .sort((a, b) => a.remaining - b.remaining)[0];
        } else if (fits(tenth(material.purchaseLength), len))
          bar = {
            id: uid(),
            materialId: material.id,
            stockId: null,
            kind: 'purchase',
            length: material.purchaseLength,
            remaining: tenth(material.purchaseLength),
            pieces: [],
            kerfLoss: 0,
          };
        else {
          missing.push({ ...piece, materialId: material.id });
          continue;
        }
        if (!local.includes(bar)) local.push(bar);
      }
      const cut = bar.remaining === len ? 0 : k;
      bar.pieces.push({ ...piece, kerf: cut / 10 });
      bar.remaining -= len + cut;
      bar.kerfLoss += cut / 10;
    }
    bars.push(...local.map((b) => ({ ...b, remaining: b.remaining / 10 })));
  }
  return {
    id: uid(),
    fingerprint: JSON.stringify(data),
    materialId,
    bars,
    missing,
    createdAt: new Date().toISOString(),
  };
}
export function completePlan(data, plan, purchasesReceived = false) {
  if (plan.archived)
    throw Error('Archiwalny dokument służy wyłącznie do odczytu i wydruku.');
  if (JSON.stringify(data) !== plan.fingerprint)
    throw Error('Dane zmieniły się. Oblicz plan ponownie.');
  if (!plan.bars.length || plan.missing.length)
    throw Error('Plan jest pusty lub zawiera odcinki bez materiału.');
  if (plan.bars.some((b) => b.kind === 'purchase') && !purchasesReceived)
    throw Error('Potwierdź zakup i dostępność materiału.');
  const next = structuredClone(data);
  for (const bar of plan.bars) {
    if (bar.stockId) {
      const s = next.stock.find((s) => s.id === bar.stockId);
      if (!s || s.quantity < 1) throw Error('Brak materiału w magazynie.');
      s.quantity--;
    }
    if (bar.remaining > 0 && bar.remaining >= data.minRemnant)
      next.stock.push({
        id: uid(),
        materialId: bar.materialId,
        length: bar.remaining,
        quantity: 1,
        kind: 'remnant',
      });
  }
  next.stock = next.stock.filter((s) => s.quantity > 0);
  const completedIds = new Set(
    plan.bars.flatMap((b) => b.pieces.map((p) => p.orderId)),
  );
  next.orders = next.orders.filter((row) => !completedIds.has(row.id));
  next.history = [
    {
      id: plan.id,
      date: new Date().toISOString(),
      bars: plan.bars.length,
      pieces: plan.bars.reduce((s, b) => s + b.pieces.length, 0),
      // Keep a bounded, self-contained checkpoint so the latest completion
      // can be reverted without guessing how inventory was consumed.
      undo: {
        materials: structuredClone(data.materials),
        stock: structuredClone(data.stock),
        orders: structuredClone(data.orders),
        kerf: data.kerf,
        minRemnant: data.minRemnant,
        archive: structuredClone(data.archive || []),
      },
    },
    ...(data.history || []),
  ].slice(0, 50);
  return next;
}
export const defaultMaterials = () => [
  {
    id: 'profile-40x40x2',
    name: 'Stal S235',
    section: 'Profil 40 × 40 × 2',
    purchaseLength: 6000,
  },
  {
    id: 'profile-40x20x2',
    name: 'Stal S235',
    section: 'Profil 40 × 20 × 2',
    purchaseLength: 6000,
  },
  {
    id: 'profile-20x20x2',
    name: 'Stal S235',
    section: 'Profil 20 × 20 × 2',
    purchaseLength: 6000,
  },
  {
    id: 'profile-20x20x1-5',
    name: 'Stal S235',
    section: 'Profil 20 × 20 × 1,5',
    purchaseLength: 6000,
  },
  {
    id: 'flat-40x2',
    name: 'Stal S235',
    section: 'Płaskownik 40 × 2',
    purchaseLength: 6000,
  },
  {
    id: 'flat-80x5',
    name: 'Stal S235',
    section: 'Płaskownik 80 × 5',
    purchaseLength: 6000,
  },
];

export const emptyData = () => ({
  materials: defaultMaterials(),
  stock: [],
  orders: [],
  kerf: 3,
  minRemnant: 200,
  history: [],
});
export function demoData() {
  return {
    materials: [
      {
        id: 'steel',
        name: 'Stal S235',
        section: 'Profil 40 × 40 × 2',
        purchaseLength: 6000,
      },
      {
        id: 'wood',
        name: 'Drewno sosnowe',
        section: 'Kantówka 60 × 80',
        purchaseLength: 4000,
      },
    ],
    stock: [
      {
        id: 's1',
        materialId: 'steel',
        length: 6000,
        quantity: 3,
        kind: 'full',
      },
      {
        id: 's2',
        materialId: 'steel',
        length: 1850,
        quantity: 2,
        kind: 'remnant',
      },
      { id: 's3', materialId: 'wood', length: 4000, quantity: 2, kind: 'full' },
    ],
    orders: [
      {
        id: 'o1',
        materialId: 'steel',
        length: 1200,
        quantity: 4,
        label: 'Rama • bok',
      },
      {
        id: 'o2',
        materialId: 'steel',
        length: 800,
        quantity: 6,
        label: 'Rama • poprzeczka',
      },
    ],
    kerf: 3,
    minRemnant: 200,
    history: [],
  };
}

// Archive entries are immutable document snapshots, never executable plans.
export function validateArchive(entries) {
  if (!Array.isArray(entries)) throw Error('Nieprawidłowe archiwum.');
  const ids = new Set();
  for (const entry of entries) {
    if (
      !entry ||
      entry.version !== 1 ||
      typeof entry.id !== 'string' ||
      ids.has(entry.id) ||
      !['list', 'plan'].includes(entry.kind) ||
      typeof entry.name !== 'string' ||
      !entry.name.trim() ||
      !Number.isFinite(Date.parse(entry.savedAt)) ||
      entry.archived !== true
    )
      throw Error('Nieprawidłowy zapis archiwalny.');
    ids.add(entry.id);
    if (entry.sourcePlanId !== undefined && typeof entry.sourcePlanId !== 'string')
      throw Error('Nieprawidłowe powiązanie planu archiwalnego.');
    validate({
      materials: [entry.material],
      stock: [],
      orders: entry.rows,
      kerf: entry.kerf,
      minRemnant: entry.minRemnant,
    });
    if (
      !entry.rows.length ||
      !Array.isArray(entry.bars) ||
      (entry.kind === 'list' && entry.bars.length) ||
      (entry.kind === 'plan' && !entry.bars.length)
    )
      throw Error('Nieprawidłowa zawartość archiwum.');
    for (const bar of entry.bars) {
      if (
        !Number.isFinite(bar.length) ||
        bar.length <= 0 ||
        !['full', 'remnant', 'purchase'].includes(bar.kind) ||
        !Number.isFinite(bar.remaining) ||
        bar.remaining < 0 ||
        !Array.isArray(bar.pieces) ||
        !bar.pieces.length
      )
        throw Error('Nieprawidłowa sztanga w archiwum.');
      for (const p of bar.pieces)
        if (
          !Number.isFinite(p.length) ||
          p.length <= 0 ||
          typeof p.label !== 'string' ||
          !Number.isFinite(p.kerf) ||
          p.kerf < 0
        )
          throw Error('Nieprawidłowe cięcia w archiwum.');
      if (
        Math.abs(
          bar.length -
            bar.remaining -
            bar.pieces.reduce((s, p) => s + p.length + p.kerf, 0),
        ) > 0.01
      )
        throw Error('Nieprawidłowy bilans zapisanej sztangi.');
    }
    if (entry.kind === 'plan') {
      const expected = new Map(),
        actual = new Map();
      const key = (p) => JSON.stringify([p.length, p.label || '']);
      for (const row of entry.rows)
        expected.set(key(row), (expected.get(key(row)) || 0) + row.quantity);
      for (const bar of entry.bars)
        for (const piece of bar.pieces)
          actual.set(key(piece), (actual.get(key(piece)) || 0) + 1);
      if (
        expected.size !== actual.size ||
        [...expected].some(([k, n]) => actual.get(k) !== n)
      )
        throw Error('Zapisany plan nie odpowiada liście odcinków.');
    }
  }
  return entries;
}
export function createSnapshot(data, materialId, name = '', plan = null) {
  validate(data);
  const material = data.materials.find((m) => m.id === materialId),
    rows = data.orders.filter((r) => r.materialId === materialId);
  if (!material || !rows.length) throw Error('Lista cięcia jest pusta.');
  if (
    plan &&
    (plan.archived ||
      plan.materialId !== materialId ||
      plan.fingerprint !== JSON.stringify(data) ||
      plan.missing.length ||
      !plan.bars.length)
  )
    throw Error('Oblicz kompletny, aktualny plan przed zapisem lub wydrukiem.');
  const savedAt = new Date().toISOString();
  const entry = {
    version: 1,
    archived: true,
    id: uid(),
    kind: plan ? 'plan' : 'list',
    name:
      name.trim() ||
      `${plan ? 'Plan' : 'Lista'} — ${material.name} — ${new Date(savedAt).toLocaleString('pl-PL')}`,
    savedAt,
    material: structuredClone(material),
    rows: structuredClone(rows),
    kerf: data.kerf,
    minRemnant: data.minRemnant,
    bars: plan
      ? plan.bars.map((b) => ({
          length: b.length,
          remaining: b.remaining,
          kind: b.kind,
          pieces: b.pieces.map((p) => ({
            length: p.length,
            label: p.label || '',
            kerf: p.kerf,
          })),
        }))
      : [],
  };
  if (plan) entry.sourcePlanId = plan.id;
  validateArchive([entry]);
  return entry;
}

// Legacy list snapshots remain readable; new archive entries must be calculated plans.
export function archivePlan(data, snapshot) {
  validate(data);
  validateArchive([snapshot]);
  if (snapshot.kind !== 'plan' || !snapshot.sourcePlanId)
    throw Error('Możesz zapisać tylko przeliczony plan cięcia.');
  return {
    ...data,
    archive: [snapshot, ...(data.archive || []).filter(
      (entry) => entry.sourcePlanId !== snapshot.sourcePlanId,
    )],
  };
}
