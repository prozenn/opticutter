const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const number = (n) =>
  new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(n);
export function renderPrintHTML(doc) {
  const plan = doc.kind === 'plan';
  const heading = `<tr><td class="document-heading" colspan="${plan ? 7 : 5}"><div class="type">${plan ? 'PLAN CIĘCIA' : 'LISTA CIĘCIA'}</div><h1>${escape(doc.name)}</h1><p class="material">${escape(doc.material.name)} • ${escape(doc.material.section)}</p><p>Data: ${escape(new Date(doc.savedAt).toLocaleString('pl-PL'))} | Razem: ${doc.rows.reduce((s, r) => s + r.quantity, 0)} szt.${plan ? ` | Rzaz: ${number(doc.kerf)} mm` : ''}</p></td></tr>`;
  const head = plan
    ? [
        'Sztanga / wsad (mm)',
        'Kolejność',
        'Odcinek (mm)',
        'Ilość (szt.)',
        'Opis',
        'Zostało (mm)',
        'Wykonano',
      ]
    : ['Poz.', 'Długość (mm)', 'Ilość (szt.)', 'Opis', 'Wykonano'];
  let rows = '';
  if (!plan)
    rows = doc.rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td class="dimension">${number(r.length)}</td><td class="quantity">${r.quantity}</td><td class="description">${escape(r.label || '')}</td><td></td></tr>`,
      )
      .join('');
  else
    for (const [index, bar] of doc.bars.entries()) {
      const groups = [];
      bar.pieces.forEach((p, i) => {
        const last = groups.at(-1);
        if (last && last.length === p.length && last.label === p.label) {
          last.quantity++;
          last.end = i + 1;
        } else groups.push({ ...p, start: i + 1, end: i + 1, quantity: 1 });
      });
      rows += groups
        .map(
          (g, i) =>
            `<tr class="${i === 0 ? 'new-bar' : ''}"><td><b>${index + 1}</b> / ${number(bar.length)}${bar.kind === 'purchase' ? '<br><small>z zakupu</small>' : ''}</td><td>${g.start === g.end ? g.start : `${g.start}–${g.end}`}</td><td class="dimension">${number(g.length)}</td><td class="quantity">${g.quantity}</td><td class="description">${escape(g.label)}</td><td>${i === groups.length - 1 ? `${number(bar.remaining)}<br><small>${bar.remaining > 0 && bar.remaining >= doc.minRemnant ? 'zachować' : 'odpad'}</small>` : ''}</td><td></td></tr>`,
        )
        .join('');
    }
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${escape(doc.name)}</title><style>
 @page{size:A4 portrait;margin:14mm 12mm;@bottom-right{content:counter(page) " / " counter(pages);font:9pt Arial,sans-serif;}}
 *{box-sizing:border-box}body{color:#000;background:#fff;font:11pt Arial,"DejaVu Sans",sans-serif;margin:0}table{border-collapse:collapse;width:calc(100% - 2px);table-layout:fixed}thead{display:table-header-group}tbody{display:table-row-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #555;padding:9px 7px;vertical-align:middle;overflow-wrap:anywhere}th{font-size:10pt;background:#eee;text-align:left;font-weight:700}td{font-size:11pt}.document-heading{border:0;padding:0 0 16px}.type{font-size:10pt;letter-spacing:1px;font-weight:700}h1{font-size:19pt;margin:6px 0;overflow-wrap:anywhere}p{margin:5px 0;font-size:10pt}.material{font-size:14pt;font-weight:700}.dimension{font-size:15pt;font-weight:700;font-variant-numeric:tabular-nums}.quantity{font-size:14pt;font-weight:700}.description{white-space:pre-wrap}small{font-size:9pt}.new-bar td{border-top:2px solid #000}.footer{margin-top:14px;font-size:10pt}col.n{width:9%}col.length{width:24%}col.qty{width:15%}col.check{width:15%}col.source{width:17%}col.sequence{width:13%}col.cut{width:17%}col.count{width:10%}col.remain{width:14%}col.done{width:12%}@media screen{body{padding:28px;max-width:210mm;margin:auto}}
 </style></head><body><table><colgroup>${plan ? '<col class="source"><col class="sequence"><col class="cut"><col class="count"><col><col class="remain"><col class="done">' : '<col class="n"><col class="length"><col class="qty"><col><col class="check">'}</colgroup><thead>${heading}<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><p class="footer">${plan ? 'Cięcia wykonuj w podanej kolejności, osobno dla każdej sztangi.' : 'Podane długości są wymiarami gotowych odcinków.'}</p></body></html>`;
}
