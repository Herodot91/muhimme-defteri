// Collaborative verification: charts on the page and a PDF report with graphs.
// jsPDF and the Roboto fonts (vendor/) are loaded only when a report is made.

const CHART_COLORS = {
  ok: '#4a5a3a', no: '#8a2f25', added: '#c79a2e',
  agree: '#4a5a3a', disagree: '#8a2f25',
  simple: '#b8a982', engine: '#1f4e6b', final: '#8a2f25',
  people: ['#1f4e6b', '#8a2f25', '#4a5a3a', '#c79a2e', '#6b4a2f', '#7a5c99'],
};

function collabSets() {
  const all = [{ name: review.annotator || 'Eu', items: review.annotations }, ...review.colleagues];
  return all.filter(s => Object.keys(s.items).length);
}

function shortLabel(id) {
  return labelOfId(id).replace(/\s*\(.*\)\s*$/, '');
}

// One entry per chart: used for the on-page charts and for the PDF.
function collabChartSpecs() {
  const sets = collabSets();
  const specs = [];
  if (sets.length) {
    const sums = sets.map(s => annotatorSummary(s.items));
    const traces = [['Corect', 'ok'], ['Greșit', 'no'], ['Adăugat (lipsă)', 'added']].map(([name, k]) => ({
      type: 'bar', name, x: sets.map(s => s.name), y: sums.map(s => s[k]), marker: { color: CHART_COLORS[k] },
    }));
    specs.push({
      key: 'verdicts', title: 'Verdicte pe cercetător', height: 380, traces,
      layout: { barmode: 'group', xaxis: { automargin: true }, yaxis: Object.assign({ title: 'etichete' }, integerYAxis(traces)) },
      caption: 'Câte etichete a confirmat (Corect), a respins (Greșit) și a adăugat ca lipsă fiecare cercetător.',
    });
  }
  if (sets.length >= 2) {
    const cmp = compareAnnotators(sets);
    if (cmp.byLabel.length) {
      const labels = cmp.byLabel.map(r => shortLabel(r.id));
      specs.push({
        key: 'agreement', title: 'Acord pe etichetă', height: Math.max(300, 150 + 34 * cmp.byLabel.length),
        traces: [
          { type: 'bar', orientation: 'h', name: 'Verdicte la fel', y: labels, x: cmp.byLabel.map(r => r.agree), marker: { color: CHART_COLORS.agree } },
          { type: 'bar', orientation: 'h', name: 'Verdicte diferite', y: labels, x: cmp.byLabel.map(r => r.judged - r.agree), marker: { color: CHART_COLORS.disagree } },
        ],
        layout: { barmode: 'stack', xaxis: Object.assign({ title: 'etichete verificate de cel puțin două persoane' }, integerYAxis([{ y: cmp.byLabel.map(r => r.judged) }])), margin: { l: 150 } },
        caption: `Pentru fiecare etichetă verificată de cel puțin două persoane: câte verdicte au fost la fel și câte diferite (acord general ${pct(cmp.judged ? cmp.agree / cmp.judged : null)}).`,
      });
    }
  }
  const rowsBy = sets.map(s => Object.fromEntries(accuracyByLabel(s.items).filter(r => r.ok + r.no > 0).map(r => [r.id, r])));
  const ids = [...new Set(rowsBy.flatMap(r => Object.keys(r)))].sort();
  if (ids.length) {
    specs.push({
      key: 'precision', title: 'Precizia etichetelor, pe cercetător', height: 420,
      traces: sets.map((s, i) => ({
        type: 'bar', name: s.name, x: ids.map(shortLabel),
        y: ids.map(id => (rowsBy[i][id] ? Math.round(100 * rowsBy[i][id].precision) : null)),
        marker: { color: CHART_COLORS.people[i % CHART_COLORS.people.length] },
      })),
      layout: { barmode: 'group', xaxis: { automargin: true }, yaxis: { title: 'precizie (%)', range: [0, 100] } },
      caption: 'Precizia = etichetele confirmate împărțite la cele verificate (confirmate plus respinse), pentru fiecare cercetător. Etichetele fără verdict nu apar.',
    });
  }
  if (hasVolume()) {
    const rows = NAME_REGISTRY.map(p => ({ p, c: placeCounts(p.label, p.type) })).filter(r => r.c.simple || r.c.engine || r.c.final);
    if (rows.length) {
      const traces = [['Căutare simplă', 'simple'], ['Motor actual', 'engine'], ['După corecții', 'final']].map(([name, k]) => ({
        type: 'bar', name, x: rows.map(r => shortLabel('x:' + r.p.label)), y: rows.map(r => r.c[k]), marker: { color: CHART_COLORS[k] },
      }));
      specs.push({
        key: 'counts', title: 'Mențiuni pe loc: căutare simplă, motor actual, după corecții', height: 420, traces,
        layout: { barmode: 'group', xaxis: { automargin: true }, yaxis: Object.assign({ title: 'hükümuri' }, integerYAxis(traces)) },
        caption: 'Aceleași hükümuri numărate în trei moduri. Diferența dintre prima și ultima coloană este efectul corectărilor motorului și al verdictelor cercetătorilor.',
      });
    }
  }
  return specs;
}

function renderCollabCharts(container) {
  if (!container) return;
  container.innerHTML = '';
  collabChartSpecs().forEach(spec => {
    const wrap = document.createElement('div');
    wrap.className = 'collab-chart';
    wrap.innerHTML = `<h4 class="rv-sub">${esc(spec.title)}</h4><div class="chart-box"></div><p class="rv-help">${esc(spec.caption)}</p>`;
    container.appendChild(wrap);
    const target = wrap.querySelector('.chart-box');
    target.style.minHeight = '0';
    Plotly.newPlot(target, spec.traces, Object.assign({
      height: spec.height, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 20, l: 60, r: 20, b: 70 }, legend: { orientation: 'h', y: -0.25 },
    }, spec.layout, spec.layout.margin ? { margin: Object.assign({ t: 20, r: 20, b: 70, l: 60 }, spec.layout.margin) } : {}),
    { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });
  });
}

// ---------------------------------------------------------------- PDF report

const fontCache = {};

async function fontBase64(url) {
  if (fontCache[url]) return fontCache[url];
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  fontCache[url] = btoa(bin);
  return fontCache[url];
}

async function chartImage(spec) {
  const div = document.createElement('div');
  div.style.cssText = `position:fixed;left:-10000px;top:0;width:900px;height:${spec.height}px;`;
  document.body.appendChild(div);
  const layout = Object.assign({
    width: 900, height: spec.height, paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff',
    font: { family: 'Roboto, Arial, sans-serif', size: 14, color: '#231d14' },
    margin: { t: 20, l: 70, r: 40, b: 90 }, legend: { orientation: 'h', y: -0.28 },
  }, spec.layout, spec.layout.margin ? { margin: Object.assign({ t: 20, r: 20, b: 90, l: 70 }, spec.layout.margin) } : {});
  await Plotly.newPlot(div, spec.traces, layout, { staticPlot: true, displayModeBar: false });
  const url = await Plotly.toImage(div, { format: 'png', width: 900, height: spec.height, scale: 1.6 });
  Plotly.purge(div);
  div.remove();
  return url;
}

async function buildCollabReport() {
  if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
  const { jsPDF } = window.jspdf;
  const [regular, bold] = await Promise.all([fontBase64('vendor/Roboto-Regular.ttf'), fontBase64('vendor/Roboto-Bold.ttf')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('Roboto-Regular.ttf', regular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', bold);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  const W = 210, H = 297, M = 16, CW = W - 2 * M;
  let y = M;
  const lineH = size => size * 0.3528 * 1.35;
  const ensure = h => { if (y + h > H - 18) { doc.addPage(); y = M; } };
  const para = (s, size = 10, style = 'normal', color = [35, 29, 20], gap = 2, width = CW) => {
    doc.setFont('Roboto', style); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(s), width);
    const lh = lineH(size);
    ensure(lines.length * lh + gap);
    lines.forEach((line, i) => doc.text(line, M, y + size * 0.3528 + i * lh));
    y += lines.length * lh + gap;
  };

  const sets = collabSets();
  const demo = sets.some(s => /^Demonstrativ/.test(s.name));
  const volumes = state.volumes.map(v => v.name);

  para('Raport de verificare colaborativă', 20, 'bold', [138, 47, 37], 3);
  para(`Mühimme Defterleri · motor ${ENGINE_VERSION} · ${new Date().toLocaleDateString('ro-RO')}`, 10, 'normal', [90, 80, 66], 1);
  para(volumes.length ? 'Volume încărcate: ' + volumes.join('; ') : 'Niciun volum încărcat.', 10, 'normal', [90, 80, 66], 5);
  if (demo) para('Atenție: raportul conține date demonstrative (fictive), marcate „Demonstrativ”. Nu reprezintă verdicte reale.', 10, 'bold', [138, 47, 37], 4);

  para('Rezumat', 14, 'bold', [35, 29, 20], 2);
  if (!sets.length) {
    para('Nicio verificare făcută încă. Marchează etichete cu Corect / Greșit în aplicație sau importă fișierele colegilor, apoi generează din nou raportul.', 10);
  } else {
    sets.forEach(s => {
      const m = annotatorSummary(s.items);
      para(`${s.name}: ${m.ok} confirmate, ${m.no} respinse, ${m.added} adăugate, în ${m.entries} hükümuri${m.notes ? `, ${m.notes} note` : ''}.`, 10, 'normal', [35, 29, 20], 1);
    });
    y += 2;
    if (sets.length >= 2) {
      const cmp = compareAnnotators(sets);
      para(`${cmp.judged} etichete au fost verificate de cel puțin două persoane; ${cmp.agree} cu verdicte la fel (${pct(cmp.judged ? cmp.agree / cmp.judged : null)}), ${cmp.disagreements.length} cu verdicte diferite.`, 10, 'bold', [35, 29, 20], 4);
    } else {
      para('O singură persoană a verificat etichete, deci nu se poate calcula acordul. Importă fișierul unui coleg pentru comparație.', 10, 'normal', [35, 29, 20], 4);
    }
  }

  for (const spec of collabChartSpecs()) {
    const h = CW * spec.height / 900;
    ensure(h + 18);
    para(spec.title, 12, 'bold', [35, 29, 20], 1.5);
    const png = await chartImage(spec);
    doc.addImage(png, 'PNG', M, y, CW, h, undefined, 'FAST');
    y += h + 1.5;
    para(spec.caption, 9, 'normal', [90, 80, 66], 5);
  }

  if (sets.length >= 2) {
    const cmp = compareAnnotators(sets);
    const byKey = new Map(allEntries().map(e => [entryKey(e), e]));
    if (cmp.disagreements.length) {
      ensure(30);
      para('Dezacorduri', 14, 'bold', [35, 29, 20], 2);
      const shown = sets.slice(0, 4);
      const wNum = 14, wText = 62, wLabel = 36, wV = (CW - wNum - wText - wLabel) / shown.length;
      const drawHead = () => {
        ensure(14);
        doc.setFillColor(230, 220, 194); doc.rect(M, y, CW, 7, 'F');
        doc.setFont('Roboto', 'bold'); doc.setFontSize(8.5); doc.setTextColor(35, 29, 20);
        doc.text('Nr.', M + 1, y + 4.8); doc.text('Hüküm', M + wNum + 1, y + 4.8); doc.text('Etichetă', M + wNum + wText + 1, y + 4.8);
        shown.forEach((s, i) => doc.text(doc.splitTextToSize(s.name, wV - 2)[0], M + wNum + wText + wLabel + i * wV + 1, y + 4.8));
        y += 7;
      };
      drawHead();
      cmp.disagreements.slice(0, 40).forEach(d => {
        const e = byKey.get(d.key);
        const sp = splitKey(d.key);
        const desc = e ? (e.recipient ? `${e.recipient}: ` : '') + e.summary.replace(/\s+/g, ' ') : `${sp.volume} (volum neîncărcat)`;
        doc.setFont('Roboto', 'normal'); doc.setFontSize(8.5);
        const textLines = doc.splitTextToSize(desc, wText - 2).slice(0, 3);
        const labelLines = doc.splitTextToSize(labelOfId(d.id), wLabel - 2).slice(0, 3);
        const rowH = Math.max(textLines.length, labelLines.length, 1) * 3.6 + 2;
        if (y + rowH > H - 18) { doc.addPage(); y = M; drawHead(); }
        doc.setFont('Roboto', 'normal'); doc.setFontSize(8.5); doc.setTextColor(35, 29, 20);
        doc.text('#' + sp.num, M + 1, y + 4);
        textLines.forEach((l, i) => doc.text(l, M + wNum + 1, y + 4 + i * 3.6));
        labelLines.forEach((l, i) => doc.text(l, M + wNum + wText + 1, y + 4 + i * 3.6));
        shown.forEach((s, i) => doc.text(verdictText(d.verdicts[sets.indexOf(s)]), M + wNum + wText + wLabel + i * wV + 1, y + 4));
        doc.setDrawColor(214, 201, 171); doc.line(M, y + rowH, M + CW, y + rowH);
        y += rowH;
      });
      if (cmp.disagreements.length > 40) para(`… și încă ${cmp.disagreements.length - 40} dezacorduri, vizibile în aplicație.`, 9, 'normal', [90, 80, 66], 4);
      if (sets.length > 4) para('În tabel sunt primii patru cercetători; graficele îi cuprind pe toți.', 9, 'normal', [90, 80, 66], 4);
      y += 3;
    }
  }

  ensure(60);
  para('Metodă și limite', 14, 'bold', [35, 29, 20], 2);
  [
    'Etichetele automate (regiuni, cetăți, teme) vin din reguli de text: liste de nume, cuvinte-cheie și expresii regulate. Nu este folosit niciun model de învățare automată pentru selecție.',
    'Verdictele sunt cele ale cercetătorilor: Corect confirmă o etichetă găsită automat, Greșit o respinge, iar „adăugat” înseamnă că a fost adăugată ca lipsă.',
    'Acordul este numărul de etichete cu verdicte la fel (toate confirmă sau toate resping) împărțit la numărul de etichete verificate de cel puțin două persoane. Nu este corectat pentru acordul întâmplător și nu este un test statistic.',
    'Precizia = etichete confirmate / etichete verificate. Cu puține etichete verificate cifrele sunt nesigure.',
    'Dezacordurile nu sunt arbitrate: aplicația le arată, iar decizia rămâne la cercetători.',
  ].forEach(t => para('• ' + t, 9.5, 'normal', [35, 29, 20], 1.5));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('Roboto', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 110, 95);
    doc.text(`Mühimme Defterleri · motor ${ENGINE_VERSION}`, M, H - 9);
    doc.text(`Pagina ${i} din ${pages}`, W - M, H - 9, { align: 'right' });
  }
  return doc;
}

async function downloadCollabReport(statusEl) {
  const set = text => { if (statusEl) statusEl.textContent = text; };
  try {
    set('Se generează raportul PDF (grafice incluse)...');
    const doc = await buildCollabReport();
    doc.save('raport-verificare-colaborativa.pdf');
    set('Raportul a fost generat: raport-verificare-colaborativa.pdf');
  } catch (err) {
    console.error(err);
    set('Raportul nu a putut fi generat: ' + (err && err.message ? err.message : err));
  }
}

// Two clearly labelled fictitious colleagues, so the comparison can be seen
// before real files arrive. They never touch the researcher's own verdicts.
function addDemoColleagues() {
  const pool = reviewSource().slice(0, 40);
  const make = (name, shift) => {
    const items = {};
    pool.forEach((e, i) => {
      const evs = evidenceFor(e);
      if (!evs.length) return;
      const verdicts = {};
      evs.forEach((ev, j) => {
        const base = ev.wholeWord ? 'ok' : 'no';
        const flip = (i * 7 + j * 3 + shift) % 5 === 0;
        verdicts[labelId(ev.kind, ev.label)] = flip ? (base === 'ok' ? 'no' : 'ok') : base;
      });
      items[entryKey(e)] = { verdicts, added: { regions: [], fortresses: [], themes: [] }, note: '' };
    });
    return { name, engineVersion: ENGINE_VERSION, importedAt: new Date().toISOString(), items: sanitizeAnnotations(items) };
  };
  review.colleagues = review.colleagues.filter(c => !/^Demonstrativ/.test(c.name));
  review.colleagues.push(make('Demonstrativ A fictiv', 0), make('Demonstrativ B fictiv', 2));
  persistReview();
}

function removeDemoColleagues() {
  review.colleagues = review.colleagues.filter(c => !/^Demonstrativ/.test(c.name));
  persistReview();
}
