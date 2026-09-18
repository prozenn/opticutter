'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  Package,
  Plus,
  Trash2,
  ArrowRight,
  Download,
  Upload,
  Check,
  Printer,
  Ruler,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  uid,
  emptyData,
  demoData,
  validate,
  planCuts,
  completePlan,
  cuttingLists,
  createSnapshot,
} from '@/lib/planner.mjs';
import { renderPrintHTML } from '@/lib/print.mjs';
const KEY = 'opticutter-v1';
const mm = (n) =>
  new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(n);
function Pick({ value, onChange, items, label }) {
  return (
    <Select value={value} onValueChange={onChange} items={items}>
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue placeholder="Wybierz materiał" />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Num({ label, ...props }) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        min="0.1"
        max="1000000"
        step="0.1"
        required
        onFocus={(event) => event.currentTarget.select()}
        {...props}
      />
    </label>
  );
}
export default function Home() {
  const [data, setData] = useState(emptyData),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [tab, setTab] = useState('order'),
    [plan, setPlan] = useState(null),
    [confirm, setConfirm] = useState(false),
    [received, setReceived] = useState(false),
    [pendingImport, setPendingImport] = useState(null);
  const [materialId, setMaterialId] = useState(''),
    [kind, setKind] = useState('full');
  const [listMaterialId, setListMaterialId] = useState(''),
    [drafts, setDrafts] = useState({});
  const [documentName, setDocumentName] = useState('');
  const [documentPreview, setDocumentPreview] = useState(null);
  const [printReady, setPrintReady] = useState(false);
  const printRef = useRef(null);
  function downloadPrintDocument() {
    if (!documentPreview) return;
    const url = URL.createObjectURL(
      new Blob([renderPrintHTML(documentPreview)], {
        type: 'text/html;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `wydruk-${documentPreview.id.slice(0, 8)}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function showDocument(doc) {
    setDocumentPreview(doc);
    setPrintReady(false);
    setTab('archive');
  }
  function prepareDocument(kind, persist = false) {
    try {
      const snapshot = createSnapshot(
        kind === 'plan' ? data : dataWithEdits(),
        listMaterialId,
        documentName,
        kind === 'plan' ? plan : null,
      );
      if (persist) {
        const next = { ...data, archive: [snapshot, ...(data.archive || [])] };
        const previousPlan = plan;
        if (!save(next)) return;
        if (previousPlan)
          setPlan({ ...previousPlan, fingerprint: JSON.stringify(next) });
        setNotice('Zapisano w archiwum. Magazyn pozostaje bez zmian.');
      }
      showDocument(snapshot);
    } catch (e) {
      setError(e.message);
    }
  }
  const lengthRef = useRef(null);
  const lists = cuttingLists(data);
  const listRows = data.orders.filter((r) => r.materialId === listMaterialId);
  useEffect(() => {
    if (!data.materials.some((m) => m.id === listMaterialId))
      setListMaterialId(
        data.orders[0]?.materialId || data.materials[0]?.id || '',
      );
    if (!data.materials.some((m) => m.id === materialId))
      setMaterialId(data.materials[0]?.id || '');
  }, [data.materials, listMaterialId, materialId]);
  useEffect(() => {
    if (tab === 'order' && listMaterialId) lengthRef.current?.focus();
  }, [tab, listMaterialId]);
  function selectList(id) {
    setListMaterialId(id);
    setPlan(null);
  }
  function editRow(row, field, value) {
    setDrafts((current) => ({
      ...current,
      [row.id]: { ...(current[row.id] || row), [field]: value },
    }));
    setPlan(null);
  }
  function saveRow(row) {
    const draft = drafts[row.id];
    if (!draft) return true;
    const updated = {
      ...draft,
      length: Number(draft.length),
      quantity: Number(draft.quantity),
    };
    if (
      !save({
        ...data,
        orders: data.orders.map((r) => (r.id === row.id ? updated : r)),
      })
    )
      return false;
    setDrafts((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
    return true;
  }
  function rowKey(e, row) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setError('');
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (saveRow(row)) {
        const next = e.currentTarget
          .closest('tr')
          ?.nextElementSibling?.querySelector('input');
        (next || lengthRef.current)?.focus();
        (next || lengthRef.current)?.select();
      }
    }
  }
  function dataWithEdits() {
    const next = {
      ...data,
      orders: data.orders.map((r) =>
        r.materialId === listMaterialId && drafts[r.id]
          ? {
              ...drafts[r.id],
              length: Number(drafts[r.id].length),
              quantity: Number(drafts[r.id].quantity),
            }
          : r,
      ),
    };
    validate(next);
    return next;
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(validate(JSON.parse(raw)));
    } catch {
      setError(
        'Nie udało się odczytać zapisanych danych. Zaimportuj poprawną kopię; zapis jest wstrzymany.',
      );
      return;
    }
    setReady(true);
  }, []);
  function save(next) {
    try {
      validate(next);
      localStorage.setItem(KEY, JSON.stringify(next));
      setData(next);
      setPlan(null);
      setError('');
      setNotice('Zapisano na tym urządzeniu.');
      return true;
    } catch (e) {
      setError(e.message || 'Nie udało się zapisać danych.');
      return false;
    }
  }
  useEffect(() => {
    function sync(e) {
      if (e.key === KEY) {
        try {
          setData(e.newValue ? validate(JSON.parse(e.newValue)) : emptyData());
          setPlan(null);
          setDrafts({});
          setNotice(
            'Wczytano zmiany z drugiej karty. Niezapisane edycje zostały anulowane.',
          );
        } catch {
          setError('Nieprawidłowe dane z drugiej karty.');
        }
      }
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const mats = data.materials.map((m) => ({
    value: m.id,
    label: `${m.name} / ${m.section}`,
  }));
  const material = (id) => data.materials.find((m) => m.id === id);
  const title = (id) => {
    const m = material(id);
    return m ? `${m.name} · ${m.section}` : '—';
  };
  function calculate() {
    try {
      const next = dataWithEdits();
      if (listRows.some((r) => drafts[r.id])) {
        if (!save(next)) return;
        setDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([id]) => !listRows.some((r) => r.id === id),
            ),
          ),
        );
      }
      const p = planCuts(next, listMaterialId);
      setPlan(p);
      setReceived(false);
      setTab('plan');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    const ctx = document.modelContext;
    if (!ctx?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: 'read_cutting_plan',
            description:
              'Oblicza plan wybranej listy jednego materiału z uwzględnieniem widocznych edycji, bez zapisywania ani zmiany zapasów.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                Object.keys(input).length
              )
                throw Error('Oczekiwano pustego obiektu.');
              return planCuts(dataWithEdits(), listMaterialId);
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [data, listMaterialId, drafts]);
  function addRow(e, target) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const selected = target === 'orders' ? listMaterialId : materialId;
    if (!selected) {
      setError('Wybierz materiał.');
      return;
    }
    const row = {
      id: uid(),
      materialId: selected,
      length: Number(f.get('length')),
      quantity: Number(f.get('quantity')),
      ...(target === 'stock'
        ? { kind }
        : { label: String(f.get('label') || '') }),
    };
    if (save({ ...data, [target]: [...data[target], row] })) {
      form.reset();
      const input = form.elements.namedItem('length');
      input?.focus();
    }
  }
  function addMaterial(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      m = {
        id: uid(),
        name: String(f.get('name')).trim(),
        section: String(f.get('section')).trim(),
        purchaseLength: Number(f.get('purchaseLength')),
      };
    if (
      data.materials.some(
        (x) =>
          x.name.toLowerCase() === m.name.toLowerCase() &&
          x.section.toLowerCase() === m.section.toLowerCase(),
      )
    ) {
      setError('Taki rodzaj i przekrój już istnieje.');
      return;
    }
    if (save({ ...data, materials: [...data.materials, m] })) {
      setMaterialId(m.id);
      setListMaterialId(m.id);
      e.currentTarget.reset();
    }
  }
  function remove(target, id) {
    if (save({ ...data, [target]: data[target].filter((r) => r.id !== id) }))
      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `opticutter-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5000000) throw Error('Plik jest za duży (maks. 5 MB).');
      setPendingImport(validate(JSON.parse(await file.text())));
    } catch (e) {
      setError(e.message);
    }
    e.target.value = '';
  }
  function finish() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && raw !== JSON.stringify(data))
        throw Error(
          'Magazyn zmienił się w innej karcie. Odśwież stronę i oblicz plan ponownie.',
        );
      // Completion always archives the exact plan that was executed, so an
      // operator can inspect and print it later without an extra manual step.
      const snapshot = createSnapshot(data, listMaterialId, documentName, plan);
      const completed = completePlan(data, plan, received);
      const next = {
        ...completed,
        archive: [
          snapshot,
          ...(data.archive || []).filter((entry) => entry.sourcePlanId !== plan.id),
        ],
      };
      if (save(next)) {
        setConfirm(false);
        setDrafts({});
        setTab('stock');
        setNotice(
          'Cięcie zatwierdzone. Magazyn zaktualizowany, pozostałości zapisane.',
        );
      }
    } catch (e) {
      setError(e.message);
      setConfirm(false);
    }
  }
  function undoCompletion(id) {
    const index = (data.history || []).findIndex((h) => h.id === id);
    const entry = data.history?.[index];
    if (index !== 0 || !entry?.undo) {
      setError('Można cofnąć tylko ostatnie zapisane cięcie.');
      return;
    }
    try {
      const restored = validate({
        ...entry.undo,
        history: (data.history || []).slice(1),
      });
      if (save(restored)) {
        setTab('stock');
        setNotice('Cofnięto ostatnie cięcie. Magazyn i lista zostały przywrócone.');
      }
    } catch (e) {
      setError(e.message);
    }
  }
  const purchases = plan?.bars.filter((b) => b.kind === 'purchase') || [];
  const totals = plan
    ? {
        input: plan.bars.reduce((s, b) => s + b.length, 0),
        output: plan.bars.reduce(
          (s, b) => s + b.pieces.reduce((a, p) => a + p.length, 0),
          0,
        ),
        remaining: plan.bars.reduce(
          (s, b) => s + (b.remaining >= data.minRemnant ? b.remaining : 0),
          0,
        ),
      }
    : null;
  const rowForm = (target) => (
    <form
      className="row-form"
      aria-label={target === 'stock' ? 'Dodawanie zapasu' : 'Dodawanie odcinka'}
      onSubmit={(e) => addRow(e, target)}
    >
      {target === 'stock' && (
        <>
          <label className="field grow">
            Materiał i przekrój
            <Pick
              label="Materiał i przekrój"
              value={materialId}
              onChange={setMaterialId}
              items={mats}
            />
          </label>
          <label className="field">
            Forma
            <Pick
              label="Forma materiału"
              value={kind}
              onChange={setKind}
              items={[
                { value: 'full', label: 'Pełny materiał' },
                { value: 'remnant', label: 'Pozostałość' },
              ]}
            />
          </label>
        </>
      )}
      <Num
        label="Długość (mm)"
        name="length"
        ref={target === 'orders' ? lengthRef : undefined}
      />
      <Num
        label="Ilość (szt.)"
        name="quantity"
        min="1"
        max="10000"
        step="1"
        defaultValue="1"
      />
      {target === 'orders' && (
        <label className="field grow">
          Opis odcinka
          <input
            name="label"
            placeholder="np. bok ramy (opcjonalnie)"
            maxLength="80"
          />
        </label>
      )}
      <Button
        type="submit"
        className="add"
        disabled={!ready || !data.materials.length}
      >
        <Plus size={16} />
        Dodaj
      </Button>
    </form>
  );
  const orderTable = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Długość (mm)</TableHead>
          <TableHead>Ilość (szt.)</TableHead>
          <TableHead>Opis odcinka</TableHead>
          <TableHead>Zmiany</TableHead>
          <TableHead>
            <span className="sr-only">Usuń</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listRows.map((row, index) => {
          const r = drafts[row.id] || row;
          return (
            <TableRow key={row.id} className={drafts[row.id] ? 'editing' : ''}>
              <TableCell>
                <input
                  className="cell-input"
                  onFocus={(event) => event.currentTarget.select()}
                  type="number"
                  min="0.1"
                  max="1000000"
                  step="0.1"
                  aria-label={`Długość pozycji ${index + 1}`}
                  value={r.length}
                  onChange={(e) => editRow(row, 'length', e.target.value)}
                  onKeyDown={(e) => rowKey(e, row)}
                />
              </TableCell>
              <TableCell>
                <input
                  className="cell-input quantity"
                  onFocus={(event) => event.currentTarget.select()}
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  aria-label={`Ilość pozycji ${index + 1}`}
                  value={r.quantity}
                  onChange={(e) => editRow(row, 'quantity', e.target.value)}
                  onKeyDown={(e) => rowKey(e, row)}
                />
              </TableCell>
              <TableCell>
                <input
                  className="cell-input description"
                  aria-label={`Opis pozycji ${index + 1}`}
                  value={r.label || ''}
                  maxLength="80"
                  onChange={(e) => editRow(row, 'label', e.target.value)}
                  onKeyDown={(e) => rowKey(e, row)}
                />
              </TableCell>
              <TableCell>
                {drafts[row.id] ? (
                  <Button
                    type="button"
                    onClick={() => saveRow(row)}
                    aria-label={`Zapisz pozycję ${index + 1}`}
                  >
                    <Check size={16} />
                    Zapisz
                  </Button>
                ) : (
                  <span className="saved-cell">Zapisano</span>
                )}
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Usuń pozycję ${index + 1}`}
                  onClick={() => remove('orders', row.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
  const rows = (target) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Materiał / przekrój</TableHead>
          <TableHead>{target === 'stock' ? 'Forma' : 'Opis'}</TableHead>
          <TableHead>Długość</TableHead>
          <TableHead>Ilość</TableHead>
          <TableHead>
            <span className="sr-only">Usuń</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data[target].map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <strong>{material(r.materialId)?.name}</strong>
              <small>{material(r.materialId)?.section}</small>
            </TableCell>
            <TableCell>
              {target === 'stock' ? (
                <span
                  className={`badge ${r.kind === 'remnant' ? 'green' : ''}`}
                >
                  {r.kind === 'remnant' ? 'Pozostałość' : 'Pełny materiał'}
                </span>
              ) : (
                r.label || '—'
              )}
            </TableCell>
            <TableCell className="numeric">{mm(r.length)} mm</TableCell>
            <TableCell>{r.quantity} szt.</TableCell>
            <TableCell>
              <Button
                variant="ghost"
                aria-label={`Usuń ${mm(r.length)} mm`}
                onClick={() => remove(target, r.id)}
              >
                <Trash2 size={16} />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  return (
    <div className="app">
      <header>
        <a className="brand" href="/">
          <span>
            <Scissors size={23} />
          </span>
          opti<span className="brand-light">cutter</span>
          <em>1D</em>
        </a>
        <div className="header-right">
          <span className="local-dot" /> Magazyn lokalny{' '}
          <Button variant="outline" onClick={exportData} disabled={!ready}>
            <Download size={16} />
            Kopia danych
          </Button>
          <label className="import-button">
            <Upload size={16} />
            <span>Importuj</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={importData}
            />
          </label>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">WARSZTAT / CIĘCIE NA DŁUGOŚĆ</p>
            <h1>Dobry plan. Mniej odpadu.</h1>
            <p>Najpierw wykorzystaj materiał, który już masz.</p>
          </div>
          <div className="unit">
            <Ruler size={18} /> Wszystkie wymiary w mm
          </div>
        </div>
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            {notice}
          </div>
        )}
        <div className="stats">
          <div>
            <span>Materiał w magazynie</span>
            <strong>
              {data.stock.reduce((s, r) => s + r.quantity, 0)}{' '}
              <small>szt.</small>
            </strong>
          </div>
          <div>
            <span>W tym pozostałości</span>
            <strong>
              {data.stock
                .filter((r) => r.kind === 'remnant')
                .reduce((s, r) => s + r.quantity, 0)}{' '}
              <small>szt.</small>
            </strong>
          </div>
          <div>
            <span>Odcinki do wycięcia</span>
            <strong>
              {data.orders.reduce((s, r) => s + r.quantity, 0)}{' '}
              <small>szt.</small>
            </strong>
          </div>
          <div>
            <span>Łączna długość zamówienia</span>
            <strong>
              {mm(
                data.orders.reduce((s, r) => s + r.length * r.quantity, 0) /
                  1000,
              )}{' '}
              <small>m</small>
            </strong>
          </div>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <div className="tabbar">
            <TabsList className="tablist">
              <TabsTrigger value="order">
                01 <span>Zamówienie</span>
              </TabsTrigger>
              <TabsTrigger value="stock">
                02 <span>Magazyn</span>
              </TabsTrigger>
              <TabsTrigger value="plan">
                03 <span>Plan cięcia</span>
              </TabsTrigger>
              <TabsTrigger value="archive">
                04 <span>Archiwum / wydruk</span>
              </TabsTrigger>
            </TabsList>
            <span className="saved">
              {ready ? 'Zapis automatyczny w przeglądarce' : 'Odczyt danych…'}
            </span>
          </div>
          <TabsContent value="order">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Lista cięcia</h2>
                  <p>Jedna lista — jeden materiał i przekrój.</p>
                </div>
                <span className="badge">{listRows.length} pozycji</span>
              </div>
              {!data.materials.length && (
                <div className="empty">
                  <Package />
                  <h3>Zacznij od materiału</h3>
                  <p>W magazynie dodaj rodzaj, przekrój i długość handlową.</p>
                  <Button onClick={() => setTab('stock')}>
                    Dodaj pierwszy materiał
                    <ArrowRight size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!ready}
                    onClick={() => save(demoData())}
                  >
                    lub wczytaj dane przykładowe
                  </Button>
                </div>
              )}
              {data.materials.length > 0 && (
                <div className="list-selection">
                  <label className="field grow">
                    Materiał listy cięcia
                    <Pick
                      label="Materiał listy cięcia"
                      value={listMaterialId}
                      onChange={selectList}
                      items={lists.map((l) => ({
                        value: l.materialId,
                        label: `${l.material.name} / ${l.material.section} · ${l.rows.length} poz.`,
                      }))}
                    />
                  </label>
                  <p>
                    Wybór materiału otwiera jego osobną listę. Pozostałe listy
                    pozostają zapisane.
                  </p>
                </div>
              )}
              {data.materials.length > 0 && (
                <div className="document-actions">
                  <label className="field grow">
                    Nazwa zapisu (opcjonalnie)
                    <input
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      maxLength={100}
                      placeholder="np. Rama hali — zlecenie 24"
                    />
                  </label>
                  <Button
                    variant="outline"
                    disabled={!ready || !listRows.length}
                    onClick={() => prepareDocument('list', true)}
                  >
                    Zapisz listę
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!ready || !listRows.length}
                    onClick={() => prepareDocument('list')}
                  >
                    <Printer size={16} />
                    Drukuj listę
                  </Button>
                </div>
              )}
              {rowForm('orders')}
              <p className="keyboard-hint">
                Długość → <kbd>Tab</kbd> ilość → <kbd>Enter</kbd> dodaje i wraca
                do długości. W tabeli edytuj pola i zatwierdź <kbd>Enter</kbd>{' '}
                lub „Zapisz”; <kbd>Esc</kbd> cofa zmiany w wierszu.
              </p>
              {listRows.length ? (
                orderTable
              ) : (
                <p className="empty-line">Lista odcinków jest pusta.</p>
              )}
            </section>
            <section className="settings">
              <div>
                <h2>Parametry cięcia</h2>
                <p>
                  Rzaz jest doliczany przy każdym odcięciu. Idealne dopasowanie
                  końca nie wymaga rzazu.
                </p>
              </div>
              <Num
                label="Szerokość rzazu (mm)"
                min="0"
                value={data.kerf}
                onChange={(e) =>
                  save({ ...data, kerf: Number(e.target.value) })
                }
              />
              <Num
                label="Zachowaj pozostałości od (mm)"
                min="0"
                value={data.minRemnant}
                onChange={(e) =>
                  save({ ...data, minRemnant: Number(e.target.value) })
                }
              />
              <Button
                className="primary-large"
                disabled={!ready || !listRows.length}
                onClick={calculate}
              >
                <Scissors size={18} />
                Oblicz plan
                <ArrowRight size={17} />
              </Button>
            </section>
          </TabsContent>
          <TabsContent value="stock">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Materiały i przekroje</h2>
                  <p>Każda para rodzaju i przekroju ma osobne zapasy.</p>
                </div>
              </div>
              <form className="row-form" onSubmit={addMaterial}>
                <label className="field grow">
                  Rodzaj materiału
                  <input
                    required
                    name="name"
                    maxLength="80"
                    placeholder="np. Stal S235"
                  />
                </label>
                <label className="field grow">
                  Przekrój
                  <input
                    required
                    name="section"
                    maxLength="80"
                    placeholder="np. Profil 40 × 40 × 2"
                  />
                </label>
                <Num
                  label="Długość zakupu (mm)"
                  name="purchaseLength"
                  defaultValue="6000"
                />
                <Button type="submit" className="add" disabled={!ready}>
                  <Plus size={16} />
                  Dodaj materiał
                </Button>
              </form>
              <div className="material-list">
                {data.materials.map((m) => (
                  <div key={m.id}>
                    <Package size={18} />
                    <div>
                      <strong>{m.name}</strong>
                      <small>
                        {m.section} · zakup {mm(m.purchaseLength)} mm
                      </small>
                    </div>
                    <Button
                      variant="ghost"
                      aria-label={`Usuń materiał ${m.name}`}
                      disabled={
                        data.stock.some((r) => r.materialId === m.id) ||
                        data.orders.some((r) => r.materialId === m.id)
                      }
                      onClick={() => remove('materials', m.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Stan magazynu</h2>
                  <p>
                    Pełne sztangi i użyteczne pozostałości z poprzednich cięć.
                  </p>
                </div>
              </div>
              {rowForm('stock')}
              {data.stock.length ? (
                rows('stock')
              ) : (
                <p className="empty-line">
                  Brak zapasów. Plan wskaże potrzebne zakupy.
                </p>
              )}
            </section>
            {data.history?.length > 0 && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Ostatnie wykonane plany</h2>
                </div>
                {data.history.map((h) => (
                  <p className="history" key={h.id}>
                    <span>
                      {new Date(h.date).toLocaleString('pl-PL')}{' '}
                      <span>
                        {h.pieces} odcinków z {h.bars} sztang
                      </span>
                    </span>
                    {h.undo && h.id === data.history[0]?.id && (
                      <Button variant="outline" onClick={() => undoCompletion(h.id)}>
                        Cofnij cięcie
                      </Button>
                    )}
                  </p>
                ))}
              </section>
            )}
          </TabsContent>
          <TabsContent value="plan">
            {!plan ? (
              <section className="panel empty">
                <Scissors />
                <h2>Twój następny plan cięcia</h2>
                <p>
                  Oblicz plan na podstawie aktualnego zamówienia i magazynu.
                </p>
                <Button
                  disabled={!ready || !listRows.length}
                  onClick={calculate}
                >
                  Oblicz plan
                  <ArrowRight size={16} />
                </Button>
              </section>
            ) : (
              <>
                <div className="plan-top">
                  <div>
                    <h2>Plan: {title(plan.materialId)}</h2>
                    <p>
                      {plan.bars.length} sztang · {data.kerf} mm rzazu ·
                      zachowaj od {data.minRemnant} mm
                    </p>
                  </div>
                  <div className="document-buttons">
                    <Button
                      variant="outline"
                      disabled={!!plan.missing.length}
                      onClick={() => prepareDocument('plan', true)}
                    >
                      Zapisz plan
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!!plan.missing.length}
                      onClick={() => prepareDocument('plan')}
                    >
                      <Printer size={16} />
                      Drukuj plan
                    </Button>
                  </div>
                </div>
                <div className="plan-summary">
                  <div>
                    <strong>
                      {totals.input
                        ? mm((100 * totals.output) / totals.input)
                        : 0}
                      %
                    </strong>
                    <span>wykorzystania na odcinki</span>
                  </div>
                  <div>
                    <strong>{plan.bars.length - purchases.length} szt.</strong>
                    <span>z własnego magazynu</span>
                  </div>
                  <div>
                    <strong>{purchases.length} szt.</strong>
                    <span>do zakupu</span>
                  </div>
                  <div>
                    <strong>{mm(totals.remaining)} mm</strong>
                    <span>pozostałości do zachowania</span>
                  </div>
                </div>
                {plan.missing.length > 0 && (
                  <section className="purchase warning">
                    <h3>Odcinki bez dopasowanego materiału</h3>
                    <p>
                      Dodaj dłuższe zapasy lub usuń i ponownie dodaj materiał z
                      właściwą długością zakupu.
                    </p>
                    {plan.missing.map((p, i) => (
                      <p key={i}>
                        {title(p.materialId)} — {mm(p.length)} mm (
                        {p.label || 'bez opisu'})
                      </p>
                    ))}
                  </section>
                )}
                <section className={`purchase ${purchases.length ? '' : 'ok'}`}>
                  <h3>
                    {purchases.length
                      ? 'Lista zakupów'
                      : 'Wszystko z Twojego magazynu'}
                  </h3>
                  {!purchases.length ? (
                    <p>Ten plan nie wymaga zakupu dodatkowego materiału.</p>
                  ) : (
                    data.materials.map((m) => {
                      const count = purchases.filter(
                        (b) => b.materialId === m.id,
                      ).length;
                      return count ? (
                        <p key={m.id}>
                          <strong>
                            {count} szt. × {mm(m.purchaseLength)} mm
                          </strong>{' '}
                          — {title(m.id)}
                        </p>
                      ) : null;
                    })
                  )}
                </section>
                <div className="legend">
                  <span>
                    <i />
                    Odcinek
                  </span>
                  <span>
                    <i className="remnant" />
                    Pozostałość
                  </span>
                  <span>
                    <i className="loss" />
                    Rzaz
                  </span>
                </div>
                {plan.bars.map((b, index) => (
                  <section className="cut-card" key={b.id}>
                    <div className="cut-title">
                      <span className="bar-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h3>{title(b.materialId)}</h3>
                        <p>
                          {mm(b.length)} mm{' '}
                          <span
                            className={`badge ${b.kind === 'remnant' ? 'green' : ''}`}
                          >
                            {b.kind === 'purchase'
                              ? 'Zakup'
                              : b.kind === 'remnant'
                                ? 'Pozostałość z magazynu'
                                : 'Pełny materiał z magazynu'}
                          </span>
                        </p>
                      </div>
                      <strong>
                        {mm(b.remaining)} mm{' '}
                        <small>
                          {b.remaining >= data.minRemnant && b.remaining > 0
                            ? 'do magazynu'
                            : 'odpadu'}
                        </small>
                      </strong>
                    </div>
                    <div
                      className="cut-bar"
                      aria-label={`Sztanga ${index + 1}: ${b.pieces.map((p) => mm(p.length)).join(' + ')} mm; pozostałość ${mm(b.remaining)} mm`}
                    >
                      {b.pieces.map((p, i) => (
                        <div
                          className="cut-segment"
                          key={i}
                          style={{
                            width: `${(100 * (p.length + p.kerf)) / b.length}%`,
                            borderRightWidth: p.kerf ? 2 : 0,
                          }}
                          title={`${p.label || 'Odcinek'}: ${mm(p.length)} mm; rzaz ${p.kerf} mm`}
                        >
                          <span>{mm(p.length)}</span>
                        </div>
                      ))}
                      {b.remaining > 0 && (
                        <div
                          className="cut-rest"
                          style={{
                            width: `${(100 * b.remaining) / b.length}%`,
                          }}
                          title={`Pozostałość: ${mm(b.remaining)} mm`}
                        >
                          <span>{mm(b.remaining)}</span>
                        </div>
                      )}
                    </div>
                    <div className="cut-details">
                      {b.pieces.map((p, i) => (
                        <span key={i}>
                          {i + 1}. <b>{mm(p.length)} mm</b>
                          {p.label ? ` · ${p.label}` : ''}
                        </span>
                      ))}
                      <span>Rzaz łącznie: {mm(b.kerfLoss)} mm</span>
                    </div>
                  </section>
                ))}
                <div className="execution">
                  <div>
                    <h2>Cięcie wykonane?</h2>
                    <p>
                      Zatwierdzenie odejmie zużyte sztangi i zapisze użyteczne
                      pozostałości.
                    </p>
                  </div>
                  <Button
                    className="primary-large"
                    disabled={!plan.bars.length || plan.missing.length > 0}
                    onClick={() => setConfirm(true)}
                  >
                    <Check size={18} />
                    Zatwierdź wykonanie
                  </Button>
                </div>
                <p className="method">
                  Planowanie heurystyczne: najdłuższe odcinki najpierw,
                  dopasowanie do zapasów przed zakupem. Plan nie gwarantuje
                  matematycznego minimum odpadu.
                </p>
              </>
            )}
          </TabsContent>
          <TabsContent value="archive">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Zapisane listy i plany</h2>
                  <p>
                    Zapisy zachowują materiał i odcinki z chwili zapisu. Możesz
                    je przeglądać i ponownie drukować.
                  </p>
                </div>
                <span className="badge">
                  {(data.archive || []).length} zapisów
                </span>
              </div>
              {(data.archive || []).length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa / data</TableHead>
                      <TableHead>Materiał / przekrój</TableHead>
                      <TableHead>Rodzaj</TableHead>
                      <TableHead>Sztuki</TableHead>
                      <TableHead>Dokument</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.archive.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <strong>{entry.name}</strong>
                          <small>
                            {new Date(entry.savedAt).toLocaleString('pl-PL')}
                          </small>
                        </TableCell>
                        <TableCell>
                          {entry.material.name}
                          <small>{entry.material.section}</small>
                        </TableCell>
                        <TableCell>
                          {entry.kind === 'plan'
                            ? 'Plan cięcia'
                            : 'Lista odcinków'}
                        </TableCell>
                        <TableCell>
                          {entry.rows.reduce((n, r) => n + r.quantity, 0)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            onClick={() => showDocument(entry)}
                            aria-label={`Otwórz ${entry.name}`}
                          >
                            Otwórz / drukuj
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="empty-line">
                  Brak zapisów. Użyj „Zapisz listę” w zamówieniu lub „Zapisz
                  plan” przy gotowym planie.
                </p>
              )}
            </section>
            {documentPreview && (
              <section className="print-preview">
                <div className="plan-top">
                  <div>
                    <h2>Podgląd wydruku</h2>
                    <p>
                      {(data.archive || []).some(
                        (e) => e.id === documentPreview.id,
                      )
                        ? 'Zapis archiwalny — tylko do odczytu.'
                        : 'Bieżący dokument — nie zapisano w archiwum.'}{' '}
                      Wydruk nie zmienia magazynu.
                    </p>
                  </div>
                  <div className="document-buttons">
                    <Button variant="outline" onClick={downloadPrintDocument}>
                      <Download size={16} />
                      Pobierz wydruk HTML
                    </Button>
                    <Button
                      disabled={!printReady}
                      onClick={() => {
                        printRef.current?.contentWindow?.focus();
                        printRef.current?.contentWindow?.print();
                      }}
                    >
                      <Printer size={16} />
                      Drukuj / zapisz PDF
                    </Button>
                  </div>
                </div>
                <p className="print-tip">
                  Papier A4, pionowo, skala 100%. W oknie drukowania wyłącz
                  nagłówki i stopki przeglądarki. Jeśli okno drukowania się nie
                  otwiera, pobierz wydruk HTML i otwórz plik w zwykłej
                  przeglądarce.
                </p>
                <iframe
                  key={documentPreview.id}
                  ref={printRef}
                  title="Dokument dla operatora piły"
                  srcDoc={renderPrintHTML(documentPreview)}
                  onLoad={() => setPrintReady(true)}
                />
              </section>
            )}
          </TabsContent>
        </Tabs>
        <footer>
          <span>OPTICUTTER / 1D</span>
          <span>
            Dane są zapisane w tej przeglądarce. Regularnie pobieraj kopię.
          </span>
        </footer>
      </main>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Zatwierdzić wykonanie cięcia?</AlertDialogTitle>
          <AlertDialogDescription>
            Magazyn zostanie pomniejszony o zużyte sztangi. Pozostałości od{' '}
            {data.minRemnant} mm trafią do magazynu, a lista cięcia tego
            materiału zostanie wyczyszczona. Pozostałe listy pozostaną zapisane.
          </AlertDialogDescription>
          {purchases.length > 0 && (
            <label className="checkbox-label">
              <Checkbox checked={received} onCheckedChange={setReceived} />
              Potwierdzam zakup i dostępność {purchases.length} sztang z listy
              zakupów.
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Wróć</AlertDialogCancel>
            <AlertDialogAction
              disabled={purchases.length > 0 && !received}
              onClick={finish}
            >
              Zatwierdź
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!pendingImport}
        onOpenChange={(open) => !open && setPendingImport(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Zastąpić dane kopią?</AlertDialogTitle>
          <AlertDialogDescription>
            Import zastąpi obecny magazyn, zamówienie i ustawienia. Plik zawiera{' '}
            {pendingImport?.materials.length} materiałów i{' '}
            {pendingImport?.stock.length} pozycji magazynowych.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (save(pendingImport)) {
                  setReady(true);
                  setDrafts({});
                  setPendingImport(null);
                  setDocumentPreview(null);
                }
              }}
            >
              Wczytaj kopię
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
