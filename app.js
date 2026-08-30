// Mühimme Defterleri — client-side app logic (PDF.js ingestion + rendering).
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const PALETTE = { "Moldova": "#8b3a2f", "Țara Românească": "#4a5a3a" };

const DEMO_DATA = [
  {id:"MD-001", registru:"MD Demo 1", an:1552, principat:"Moldova", localitate:"Suceava", tema:"Diplomație", actor_principal:"Domnul Moldovei", actor_secundar:"Poarta Otomană", tip_decizie:"Ordin", rezumat:"Exemplu demonstrativ privind comunicarea dintre administrația centrală otomană și Moldova."},
  {id:"MD-002", registru:"MD Demo 1", an:1553, principat:"Țara Românească", localitate:"Târgoviște", tema:"Fiscalitate", actor_principal:"Domnul Țării Românești", actor_secundar:"Poarta Otomană", tip_decizie:"Dispoziție", rezumat:"Exemplu demonstrativ privind o problemă fiscală."},
  {id:"MD-003", registru:"MD Demo 1", an:1554, principat:"Moldova", localitate:"Iași", tema:"Securitate", actor_principal:"Domnul Moldovei", actor_secundar:"Sangeacul Silistra", tip_decizie:"Avertizare", rezumat:"Exemplu demonstrativ referitor la securitate și circulație regională."},
  {id:"MD-004", registru:"MD Demo 2", an:1555, principat:"Țara Românească", localitate:"București", tema:"Administrație", actor_principal:"Domnul Țării Românești", actor_secundar:"Beylerbey de Rumelia", tip_decizie:"Ordin", rezumat:"Exemplu demonstrativ privind coordonarea administrativă."},
  {id:"MD-005", registru:"MD Demo 2", an:1556, principat:"Moldova", localitate:"Chilia", tema:"Comerț", actor_principal:"Autorități locale", actor_secundar:"Negustori", tip_decizie:"Reglementare", rezumat:"Exemplu demonstrativ privind activitatea comercială în regiunea Dunării de Jos."},
  {id:"MD-006", registru:"MD Demo 2", an:1557, principat:"Țara Românească", localitate:"Giurgiu", tema:"Securitate", actor_principal:"Sangeacul Giurgiu", actor_secundar:"Domnul Țării Românești", tip_decizie:"Ordin", rezumat:"Exemplu demonstrativ privind securitatea zonei dunărene."},
  {id:"MD-007", registru:"MD Demo 3", an:1558, principat:"Moldova", localitate:"Cetatea Albă", tema:"Militar", actor_principal:"Sangeacul Akkerman", actor_secundar:"Poarta Otomană", tip_decizie:"Mobilizare", rezumat:"Exemplu demonstrativ privind măsuri cu caracter militar."},
  {id:"MD-008", registru:"MD Demo 3", an:1559, principat:"Țara Românească", localitate:"Târgoviște", tema:"Diplomație", actor_principal:"Domnul Țării Românești", actor_secundar:"Poarta Otomană", tip_decizie:"Instrucțiune", rezumat:"Exemplu demonstrativ privind relațiile politico-diplomatice."},
  {id:"MD-009", registru:"MD Demo 3", an:1560, principat:"Moldova", localitate:"Iași", tema:"Fiscalitate", actor_principal:"Domnul Moldovei", actor_secundar:"Poarta Otomană", tip_decizie:"Solicitare", rezumat:"Exemplu demonstrativ privind obligațiile fiscale."},
  {id:"MD-010", registru:"MD Demo 3", an:1561, principat:"Țara Românească", localitate:"București", tema:"Comerț", actor_principal:"Negustori", actor_secundar:"Domnul Țării Românești", tip_decizie:"Reglementare", rezumat:"Exemplu demonstrativ privind reglementarea unor activități comerciale."},
  {id:"MD-011", registru:"MD Demo 4", an:1562, principat:"Moldova", localitate:"Suceava", tema:"Administrație", actor_principal:"Domnul Moldovei", actor_secundar:"Autorități locale", tip_decizie:"Instrucțiune", rezumat:"Exemplu demonstrativ privind administrația teritorială."},
  {id:"MD-012", registru:"MD Demo 4", an:1563, principat:"Țara Românească", localitate:"Giurgiu", tema:"Militar", actor_principal:"Sangeacul Giurgiu", actor_secundar:"Poarta Otomană", tip_decizie:"Ordin", rezumat:"Exemplu demonstrativ privind probleme militare în regiunea Dunării."}
];

const state = { volumes: [] };

// ---------------------------------------------------------------------
// AI translation via Puter.js (puter.ai.chat) — keyless from our side.
// Puter's "User-Pays" model means the visiting user signs into their own
// free Puter account (a one-time popup on first use); translations then
// run under their account, with nothing for us to store or leak.
// ---------------------------------------------------------------------

async function translateToRomanian(text) {
  const prompt = 'Tradu în limba română textul otoman de mai jos, dintr-un hüküm ' +
    '(ordin imperial) din Mühimme Defterleri. Este otomană chancery, ' +
    'transliterată. Redă o traducere aproximativă, naturală, fără ' +
    'comentarii sau explicații suplimentare — doar traducerea.\n\n' + text;
  const response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
  return response.message.content;
}

function allEntries() { return state.volumes.flatMap(v => v.entries); }
function corpusEntries() { return allEntries().filter(e => e.regions.length || e.fortresses.length); }
function hasPdf() { return corpusEntries().length > 0; }

function groupCount(arr, keyFn) {
  const m = {};
  arr.forEach(r => { const k = keyFn(r); m[k] = (m[k] || 0) + 1; });
  return m;
}

// ---------------------------------------------------------------------
// PDF ingestion
// ---------------------------------------------------------------------

function setBanner(html, kind) {
  const banner = document.getElementById('global-banner');
  banner.style.display = 'block';
  banner.className = kind || '';
  banner.innerHTML = html;
}

function setProgress(current, total, label) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  setBanner(
    `<span class="spinner"></span>${label} (${current}/${total})
     <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>`
  );
}

async function extractPages(file, onProgress) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  const pages = [];
  if (onProgress) onProgress(0, total);
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      text += item.str;
      text += item.hasEOL ? '\n' : ' ';
    }
    pages.push(text);
    if (onProgress && (i % 5 === 0 || i === total)) onProgress(i, total);
  }
  return pages;
}

async function processFile(file, statusEl) {
  statusEl.innerHTML = `<span class="spinner"></span>Se extrage textul din „${file.name}”...`;
  setBanner(`<span class="spinner"></span>Se încarcă „${file.name}”...`);
  const pages = await extractPages(file, (done, total) => {
    setProgress(done, total, `Se extrage textul din „${file.name}”`);
    statusEl.innerHTML = `<span class="spinner"></span>Pagina ${done}/${total}...`;
  });
  statusEl.innerHTML = `<span class="spinner"></span>Se analizează hükümurile...`;
  setBanner(`<span class="spinner"></span>Se analizează hükümurile din „${file.name}” (${pages.length} pagini)...`);
  const period = detectPeriod(pages);
  let entries = parseEntries(pages, file.name);
  entries = attachYears(entries, period);
  const centuryLabel = period
    ? `secolul ${period.centuryRoman} (${period.gregStart}–${period.gregEnd})`
    : "secol necunoscut (dată neidentificată pe pagina de titlu)";
  const objectUrl = URL.createObjectURL(file);
  return { name: file.name, pages, period, entries, centuryLabel, objectUrl, pageCount: pages.length };
}

document.getElementById('pdf-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const statusEl = document.getElementById('upload-status');
  const input = document.getElementById('pdf-input');
  input.disabled = true;
  let okCount = 0, entryCount = 0, corpusCount = 0;
  const errors = [];
  for (const file of files) {
    try {
      const vol = await processFile(file, statusEl);
      state.volumes.push(vol);
      okCount++;
      entryCount += vol.entries.length;
      corpusCount += vol.entries.filter(e => e.regions.length || e.fortresses.length).length;
    } catch (err) {
      console.error(err);
      errors.push(`„${file.name}”: ${err.message || err}`);
    }
  }
  input.disabled = false;
  input.value = '';

  if (errors.length) {
    statusEl.innerHTML = `<div class="status err">Eroare la ${errors.length} fișier(e):<br>${errors.map(escapeHtml).join('<br>')}</div>`;
    setBanner(`❌ Eroare la procesare:<br>${errors.map(escapeHtml).join('<br>')}`, 'err');
  } else if (okCount > 0 && corpusCount === 0) {
    statusEl.innerHTML = `<div class="status err">${okCount} volum(e) citite (${entryCount} hükümuri în total), dar niciunul nu menționează Eflak/Boğdan/Erdel sau cetățile urmărite.</div>`;
    setBanner(
      `⚠️ PDF-ul a fost citit cu succes (${entryCount} hükümuri identificate în total), dar <b>niciunul nu
       menționează Eflak, Boğdan, Erdel</b> sau cetățile urmărite (Kili, Akkerman, Bender, Hotin, Silistre) —
       de aceea filele de mai jos rămân pe corpusul demonstrativ. Verifică fila „📕 Volum PDF” → „Căutare
       completă” pentru a răsfoi tot ce a fost extras din acest volum.`,
      'err'
    );
  } else if (okCount > 0) {
    statusEl.innerHTML = `<div class="status ok">${okCount} volum(e) încărcate — ${entryCount} hükümuri identificate (${corpusCount} despre Eflak/Boğdan/Erdel/cetăți).</div>`;
    setBanner(`✅ ${okCount} volum(e) încărcate — ${corpusCount} hükümuri reale acum populează filele de mai jos (din ${entryCount} identificate în total). Vezi filele „🏠 Corpus”, „📄 Documente”, etc.`, 'ok');
    setTimeout(() => { document.getElementById('global-banner').style.display = 'none'; }, 8000);
  }
  renderAll();
});

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

function renderAll() {
  renderVolumesList();
  updateScopeNote();
  renderCorpus();
  renderCronologie();
  renderTeme();
  renderHarta();
  renderRetele();
  renderComparatie();
  renderDocumenteFilters();
  renderDocumente();
  renderVolum();
}

function updateScopeNote() {
  const note = document.getElementById('scope-note');
  if (hasPdf()) {
    note.innerHTML = `✅ <b>${corpusEntries().length} hükümuri reale</b> extrase din ${state.volumes.length}
      volum(e) — toate filele de mai jos arată acum datele reale (Eflak / Boğdan / Erdel +
      cetăți anexate), nu corpusul demonstrativ.`;
  } else {
    note.innerHTML = `⚠️ Fără niciun volum încărcat, tabelele de mai jos arată un corpus
      demonstrativ fictiv (12 înregistrări „Exemplu demonstrativ”), doar pentru ilustrare.`;
  }
}

function renderVolumesList() {
  const box = document.getElementById('volumes-list-box');
  const list = document.getElementById('volumes-list');
  if (!state.volumes.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  list.innerHTML = state.volumes.map(v =>
    `<div class="vol-row"><b>${v.name}</b><br>${v.pageCount} pagini · ${v.entries.length} hükümuri<br>${v.centuryLabel}</div>`
  ).join('');
}

// ---------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------

function renderCorpus() {
  if (hasPdf()) {
    const entries = corpusEntries();
    document.getElementById('m-documente').textContent = entries.length;
    document.getElementById('m-registre').textContent = state.volumes.length;
    document.getElementById('m-localitati').textContent = new Set(entries.flatMap(e => e.regions)).size;
    document.getElementById('m-actori').textContent = new Set(entries.map(e => e.recipient)).size;

    const dated = entries.filter(e => e.year != null);
    const regionRows = [];
    entries.forEach(e => e.regions.forEach(r => regionRows.push({ an: e.year, regiune: r })));
    const datedRegionRows = regionRows.filter(r => r.an != null);
    if (datedRegionRows.length) {
      const years = [...new Set(datedRegionRows.map(r => r.an))].sort();
      const regions = [...new Set(datedRegionRows.map(r => r.regiune))];
      const byYearRegion = groupCount(datedRegionRows, r => r.an + '|||' + r.regiune);
      const traces = regions.map(r => ({
        x: years, y: years.map(y => byYearRegion[y + '|||' + r] || 0),
        name: r, type: 'bar'
      }));
      Plotly.newPlot('chart-yearly', traces, {
        barmode: 'group', title: 'Hükümuri identificate pe ani (an aproximativ)',
        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
      }, { responsive: true, displayModeBar: false });
    } else {
      document.getElementById('chart-yearly').innerHTML = '<p style="padding:20px;">Anul nu a putut fi determinat.</p>';
    }

    const themeRows = [];
    entries.forEach(e => (e.themes.length ? e.themes : ['Neclasificat']).forEach(t => themeRows.push(t)));
    const byTheme = groupCount(themeRows, t => t);
    Plotly.newPlot('chart-theme-pie', [{ labels: Object.keys(byTheme), values: Object.values(byTheme), type: 'pie' }],
      { title: 'Structura tematică', paper_bgcolor: 'transparent', margin: { t: 40 } },
      { responsive: true, displayModeBar: false });

    const regionNames = Object.keys(REGION_TERMS);
    const highlights = document.getElementById('highlights');
    highlights.innerHTML = '<h3>Repere tematice</h3><div style="display:flex; gap:14px; flex-wrap:wrap;">' +
      regionNames.map(name => {
        const matches = entries.filter(e => e.regions.includes(name));
        if (!matches.length) return `<div class="chart-box" style="flex:1; min-width:220px;"><b>${name}</b><p>Niciun hüküm găsit.</p></div>`;
        const tc = groupCount(matches.flatMap(e => e.themes), t => t);
        const topTheme = Object.entries(tc).sort((a, b) => b[1] - a[1])[0];
        const ex = matches[0];
        return `<div class="chart-box" style="flex:1; min-width:220px;">
          <b>${name}</b><br>${matches.length} hükümuri · temă dominantă: <b>${topTheme ? topTheme[0] : 'necunoscută'}</b>
          <p style="font-size:0.85rem; margin-top:8px;">Exemplu — #${ex.num} către ${ex.recipient} (${ex.volume}, p. ${ex.page}):<br>
          <i>${ex.summary.slice(0, 200)}</i></p></div>`;
      }).join('') + '</div>';
  } else {
    document.getElementById('m-documente').textContent = DEMO_DATA.length;
    document.getElementById('m-registre').textContent = new Set(DEMO_DATA.map(r => r.registru)).size;
    document.getElementById('m-localitati').textContent = new Set(DEMO_DATA.map(r => r.localitate)).size;
    document.getElementById('m-actori').textContent = new Set(DEMO_DATA.map(r => r.actor_principal)).size;

    const byYearPrincipat = groupCount(DEMO_DATA, r => r.an + '|||' + r.principat);
    const principates = [...new Set(DEMO_DATA.map(r => r.principat))];
    const years = [...new Set(DEMO_DATA.map(r => r.an))].sort();
    const traces = principates.map(p => ({
      x: years, y: years.map(y => byYearPrincipat[y + '|||' + p] || 0),
      name: p, type: 'bar', marker: { color: PALETTE[p] }
    }));
    Plotly.newPlot('chart-yearly', traces, {
      barmode: 'group', title: 'Documente identificate pe ani (demonstrativ)',
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
    }, { responsive: true, displayModeBar: false });

    const byTheme = groupCount(DEMO_DATA, r => r.tema);
    Plotly.newPlot('chart-theme-pie', [{ labels: Object.keys(byTheme), values: Object.values(byTheme), type: 'pie' }],
      { title: 'Structura tematică (demonstrativ)', paper_bgcolor: 'transparent', margin: { t: 40 } },
      { responsive: true, displayModeBar: false });

    document.getElementById('highlights').innerHTML = '';
  }
}

// ---------------------------------------------------------------------
// Cronologie
// ---------------------------------------------------------------------

function renderCronologie() {
  if (hasPdf()) {
    const entries = corpusEntries();
    const rows = [];
    entries.forEach(e => (e.themes.length ? e.themes : ['Neclasificat']).forEach(t => {
      if (e.year != null) rows.push({ an: e.year, tema: t });
    }));
    if (!rows.length) {
      document.getElementById('chart-cronologie').innerHTML = '<p style="padding:20px;">Anul nu a putut fi determinat.</p>';
      return;
    }
    const years = [...new Set(rows.map(r => r.an))].sort();
    const themes = [...new Set(rows.map(r => r.tema))];
    const byYearTheme = groupCount(rows, r => r.an + '|||' + r.tema);
    const traces = themes.map(t => ({
      x: years, y: years.map(y => byYearTheme[y + '|||' + t] || 0), name: t, mode: 'lines+markers'
    }));
    Plotly.newPlot('chart-cronologie', traces, {
      title: 'Evoluția temelor în timp (an aproximativ)',
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
    }, { responsive: true, displayModeBar: false });
  } else {
    const byYearTheme = groupCount(DEMO_DATA, r => r.an + '|||' + r.tema);
    const themes = [...new Set(DEMO_DATA.map(r => r.tema))];
    const years = [...new Set(DEMO_DATA.map(r => r.an))].sort();
    const traces = themes.map(t => ({
      x: years, y: years.map(y => byYearTheme[y + '|||' + t] || 0), name: t, mode: 'lines+markers'
    }));
    Plotly.newPlot('chart-cronologie', traces, {
      title: 'Evoluția temelor în timp (demonstrativ)',
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
    }, { responsive: true, displayModeBar: false });
  }
}

// ---------------------------------------------------------------------
// Teme
// ---------------------------------------------------------------------

function renderTeme() {
  if (hasPdf()) {
    const entries = corpusEntries();
    const crossRows = [];
    entries.forEach(e => {
      const regs = e.regions.length ? e.regions : ['(doar cetate, fără regiune)'];
      const thms = e.themes.length ? e.themes : ['Neclasificat'];
      regs.forEach(r => thms.forEach(t => crossRows.push({ regiune: r, tema: t })));
    });
    const themes = [...new Set(crossRows.map(r => r.tema))];
    const regions = [...new Set(crossRows.map(r => r.regiune))];
    const byThemeRegion = groupCount(crossRows, r => r.tema + '|||' + r.regiune);
    const traces = regions.map(reg => ({
      x: themes, y: themes.map(t => byThemeRegion[t + '|||' + reg] || 0), name: reg, type: 'bar'
    }));
    Plotly.newPlot('chart-teme', traces, {
      barmode: 'group', title: 'Eflak / Boğdan / Erdel – comparație tematică',
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
    }, { responsive: true, displayModeBar: false });

    const themeRows = entries.flatMap(e => e.themes.length ? e.themes : ['Neclasificat']);
    const ranking = Object.entries(groupCount(themeRows, t => t)).sort((a, b) => b[1] - a[1]);
    document.getElementById('table-teme').innerHTML = '<tr><th>Temă</th><th>Număr hükümuri</th></tr>' +
      ranking.map(([t, c]) => `<tr><td>${t}</td><td>${c}</td></tr>`).join('');
  } else {
    const byThemePrincipat = groupCount(DEMO_DATA, r => r.tema + '|||' + r.principat);
    const themes = [...new Set(DEMO_DATA.map(r => r.tema))];
    const principates = [...new Set(DEMO_DATA.map(r => r.principat))];
    const traces = principates.map(p => ({
      x: themes, y: themes.map(t => byThemePrincipat[t + '|||' + p] || 0), name: p, type: 'bar', marker: { color: PALETTE[p] }
    }));
    Plotly.newPlot('chart-teme', traces, {
      barmode: 'group', title: 'Moldova și Țara Românească – comparație tematică (demonstrativ)',
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
    }, { responsive: true, displayModeBar: false });

    const ranking = Object.entries(groupCount(DEMO_DATA, r => r.tema)).sort((a, b) => b[1] - a[1]);
    document.getElementById('table-teme').innerHTML = '<tr><th>Temă</th><th>Număr documente</th></tr>' +
      ranking.map(([t, c]) => `<tr><td>${t}</td><td>${c}</td></tr>`).join('');
  }
}

// ---------------------------------------------------------------------
// Hartă (stylized historical map, ported from the Python SVG builder)
// ---------------------------------------------------------------------

const MAP_POSITIONS = {
  "Boğdan (Moldova)": [560, 120],
  "Eflak (Țara Românească)": [420, 300],
  "Erdel (Ardeal / Transilvania)": [270, 210],
  "Kili (Chilia)": [640, 310],
  "Akkerman (Cetatea Albă)": [690, 210],
  "Bender (Tighina)": [630, 150],
  "Hotin (Khotyn)": [560, 55],
  "Silistre": [470, 390],
};

function renderHarta() {
  const entries = hasPdf() ? corpusEntries() : [];
  const note = document.getElementById('map-note');
  if (hasPdf()) {
    const centuries = [...new Set(state.volumes.map(v => v.period && v.period.century).filter(c => c != null))].sort();
    note.textContent = centuries.length
      ? `Volume încărcate: ${centuries.map(c => 'secolul ' + ROMAN_NUMERALS[c]).join(', ')}. Hartă schematică ilustrativă, nu o proiecție geografică precisă.`
      : 'Secolul volumelor încărcate nu a putut fi identificat automat. Hartă schematică ilustrativă.';
  } else {
    note.textContent = 'Hartă disponibilă doar cu date reale — încarcă un volum PDF pentru a o vedea populată.';
  }

  const counts = {};
  Object.keys(REGION_TERMS).forEach(name => { counts[name] = entries.filter(e => e.regions.includes(name)).length; });
  Object.keys(FORTRESS_TERMS).forEach(name => {
    if (name !== 'Yedikule') counts[name] = entries.filter(e => e.fortresses.includes(name)).length;
  });

  const radius = c => 12 + Math.min(c, 80) * 0.5;
  let markers = '';
  for (const [name, [mx, my]] of Object.entries(MAP_POSITIONS)) {
    const c = counts[name] || 0;
    const r = radius(c);
    const short = name.split(' ')[0];
    const fill = REGION_TERMS[name] ? '#8b3a2f' : '#4a5a3a';
    markers += `<circle cx="${mx}" cy="${my}" r="${r}" fill="${fill}" fill-opacity="0.75" stroke="#2b2013" stroke-width="1.5" />
      <text x="${mx}" y="${my - r - 6}" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#2b2013" font-weight="bold">${short}</text>
      <text x="${mx}" y="${my + 4}" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#f5ecd8">${c}</text>`;
  }

  const svg = `
    <svg viewBox="0 0 820 460" xmlns="http://www.w3.org/2000/svg" style="width:100%; max-width:820px; height:auto; background:#f0e2c0; border:6px solid #6b4a2f; border-radius:4px;">
      <defs>
        <radialGradient id="parchment" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stop-color="#f5ecd8" />
          <stop offset="100%" stop-color="#e3d2a5" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="820" height="460" fill="url(#parchment)" />
      <path d="M 650 260 Q 780 260 800 350 Q 780 440 680 440 Q 620 400 630 330 Q 630 280 650 260 Z" fill="#5b7c8c" fill-opacity="0.55" stroke="#2b2013" stroke-width="1" />
      <text x="700" y="360" font-family="Georgia, serif" font-size="14" fill="#1d2a30" font-style="italic">Marea Neagră</text>
      <path d="M 120 380 Q 260 370 350 360 Q 460 350 560 340 Q 620 335 650 310" fill="none" stroke="#4a6b7a" stroke-width="5" stroke-linecap="round" opacity="0.8" />
      <text x="160" y="400" font-family="Georgia, serif" font-size="12" fill="#2b2013" font-style="italic">Dunărea</text>
      <path d="M 560 60 Q 600 110 620 150 Q 660 180 690 210" fill="none" stroke="#4a6b7a" stroke-width="4" stroke-linecap="round" opacity="0.7" />
      <text x="595" y="95" font-family="Georgia, serif" font-size="11" fill="#2b2013" font-style="italic">Nistru</text>
      <path d="M 230 120 Q 300 200 260 320 Q 250 360 300 400" fill="none" stroke="#6b5a3a" stroke-width="6" stroke-dasharray="2 6" stroke-linecap="round" opacity="0.6" />
      ${markers}
      <text x="20" y="30" font-family="Georgia, serif" font-size="20" fill="#2b2013" font-weight="bold">Eflak · Boğdan · Erdel</text>
      <text x="20" y="440" font-family="Georgia, serif" font-size="11" fill="#6b5a3a">Diametrul cercurilor = nr. de mențiuni. Nu este o proiecție geografică exactă.</text>
    </svg>`;
  document.getElementById('map-container').innerHTML = svg;
}

// ---------------------------------------------------------------------
// Rețele (networks via d3-force layout + Plotly rendering, click-to-inspect)
// ---------------------------------------------------------------------

function computeForceLayout(nodeIds, edges) {
  const nodes = nodeIds.map(id => ({ id }));
  const links = edges.map(e => ({ source: e[0], target: e[1] }));
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(90).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(0, 0))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();
  const pos = {};
  nodes.forEach(n => { pos[n.id] = [n.x, n.y]; });
  return pos;
}

function renderNetworkChart(divId, nodeWeights, edgeWeights, title, onNodeClick) {
  const nodeIds = Object.keys(nodeWeights);
  if (!nodeIds.length) {
    document.getElementById(divId).innerHTML = '<p style="padding:20px;">Niciun rezultat.</p>';
    return;
  }
  const edges = Object.keys(edgeWeights).map(k => k.split('§§'));
  const pos = computeForceLayout(nodeIds, edges);

  const degree = {};
  nodeIds.forEach(id => degree[id] = 0);
  edges.forEach(([a, b]) => { degree[a] = (degree[a] || 0) + 1; degree[b] = (degree[b] || 0) + 1; });

  const edgeX = [], edgeY = [];
  edges.forEach(([a, b]) => {
    edgeX.push(pos[a][0], pos[b][0], null);
    edgeY.push(pos[a][1], pos[b][1], null);
  });

  const nodeX = nodeIds.map(id => pos[id][0]);
  const nodeY = nodeIds.map(id => pos[id][1]);
  const nodeSize = nodeIds.map(id => 16 + (degree[id] || 0) * 6);
  const nodeText = nodeIds.map(id => `${id}<br>Legături: ${degree[id] || 0}<br>Menționări: ${nodeWeights[id]}`);

  const edgeTrace = { x: edgeX, y: edgeY, mode: 'lines', line: { width: 1, color: '#8b7355' }, hoverinfo: 'none', type: 'scatter' };
  const nodeTrace = {
    x: nodeX, y: nodeY, mode: 'markers+text', text: nodeIds, textposition: 'top center',
    hoverinfo: 'text', hovertext: nodeText, customdata: nodeIds, type: 'scatter',
    marker: { size: nodeSize, color: '#8b3a2f', line: { width: 1, color: '#2b2013' } }
  };

  Plotly.newPlot(divId, [edgeTrace, nodeTrace], {
    title, showlegend: false, hovermode: 'closest',
    xaxis: { showgrid: false, zeroline: false, showticklabels: false },
    yaxis: { showgrid: false, zeroline: false, showticklabels: false },
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
  }, { responsive: true, displayModeBar: false });

  const el = document.getElementById(divId);
  el.on('plotly_click', (data) => {
    const pt = data.points[0];
    if (pt.curveNumber === 1 && pt.customdata) onNodeClick(pt.customdata);
  });
}

function renderRetele() {
  if (!hasPdf()) {
    document.getElementById('chart-network-recipients').innerHTML = '<p style="padding:20px;">Disponibil doar cu date reale — încarcă un volum PDF.</p>';
    document.getElementById('chart-network-regions').innerHTML = '';
    document.getElementById('network-detail-1').innerHTML = '';
    document.getElementById('network-detail-2').innerHTML = '';
    return;
  }
  const entries = corpusEntries();

  // Recipients network
  const recipientCounts = groupCount(entries, e => e.recipient);
  const nodeWeights1 = { "Poarta Otomană (Sultan)": entries.length };
  const edgeWeights1 = {};
  const topRecipients = Object.entries(recipientCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  topRecipients.forEach(([r, c]) => {
    nodeWeights1[r] = c;
    edgeWeights1["Poarta Otomană (Sultan)§§" + r] = c;
  });
  renderNetworkChart('chart-network-recipients', nodeWeights1, edgeWeights1, 'Destinatarii hükümurilor (din document)', (node) => {
    const matched = node === "Poarta Otomană (Sultan)" ? entries : entries.filter(e => e.recipient === node);
    document.getElementById('network-detail-1').innerHTML = renderEntryList(node, matched);
  });

  // Region/fortress co-occurrence network
  const nodeWeights2 = {};
  const edgeWeights2 = {};
  entries.forEach(e => {
    const ents = [...new Set([...e.regions, ...e.fortresses])];
    ents.forEach(x => { nodeWeights2[x] = (nodeWeights2[x] || 0) + 1; });
    for (let a = 0; a < ents.length; a++) {
      for (let b = a + 1; b < ents.length; b++) {
        const key = [ents[a], ents[b]].sort().join('§§');
        edgeWeights2[key] = (edgeWeights2[key] || 0) + 1;
      }
    }
  });
  renderNetworkChart('chart-network-regions', nodeWeights2, edgeWeights2, 'Co-menționări regiuni și cetăți', (node) => {
    const matched = entries.filter(e => e.regions.includes(node) || e.fortresses.includes(node));
    document.getElementById('network-detail-2').innerHTML = renderEntryList(node, matched);
  });
}

function renderEntryList(title, entries) {
  let html = `<h4 style="margin-top:14px;">📌 ${title} — ${entries.length} hükümuri</h4>`;
  entries.slice(0, 20).forEach(e => {
    html += `<details class="entry-card"><summary>#${e.num} — ${e.recipient} (${e.volume}, p. ${e.page})</summary>
      <p><b>Rezumat:</b> ${e.summary}</p><div class="fulltext">${escapeHtml(e.fullText.slice(0, 1200))}</div></details>`;
  });
  if (entries.length > 20) html += `<p class="hint">Se afișează primele 20 din ${entries.length}.</p>`;
  return html;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------------------------------------------------------------------
// Comparație
// ---------------------------------------------------------------------

function renderComparatie() {
  if (!hasPdf()) {
    document.getElementById('comparatie-metrics').innerHTML = '<p style="padding:10px;">Disponibil doar cu date reale — încarcă un volum PDF.</p>';
    document.getElementById('chart-comparatie').innerHTML = '';
    document.getElementById('comparatie-recipients').innerHTML = '';
    return;
  }
  const entries = corpusEntries();
  const regionNames = Object.keys(REGION_TERMS);

  document.getElementById('comparatie-metrics').innerHTML = regionNames.map(name => {
    const c = entries.filter(e => e.regions.includes(name)).length;
    return `<div class="metric"><div class="value">${c}</div><div class="label">${name}</div></div>`;
  }).join('');

  const themeRows = [];
  regionNames.forEach(name => {
    const matches = entries.filter(e => e.regions.includes(name));
    const tc = groupCount(matches.flatMap(e => e.themes), t => t);
    Object.keys(THEME_TERMS).forEach(theme => {
      themeRows.push({ regiune: name, tema: theme, hükümuri: tc[theme] || 0 });
    });
  });
  const total = themeRows.reduce((s, r) => s + r.hükümuri, 0);
  if (total > 0) {
    const themes = Object.keys(THEME_TERMS);
    const traces = regionNames.map(name => ({
      x: themes, y: themes.map(t => (themeRows.find(r => r.regiune === name && r.tema === t) || {}).hükümuri || 0),
      name, type: 'bar'
    }));
    Plotly.newPlot('chart-comparatie', traces, {
      barmode: 'group', title: 'Profil tematic: Eflak vs. Boğdan vs. Erdel',
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 40 }
    }, { responsive: true, displayModeBar: false });
  } else {
    document.getElementById('chart-comparatie').innerHTML = '<p style="padding:20px;">Nicio temă clasificată încă.</p>';
  }

  document.getElementById('comparatie-recipients').innerHTML = '<h3>Cei mai frecvenți destinatari, pe regiune</h3><div style="display:flex; gap:14px; flex-wrap:wrap;">' +
    regionNames.map(name => {
      const matches = entries.filter(e => e.regions.includes(name));
      const top = Object.entries(groupCount(matches, e => e.recipient)).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return `<div class="chart-box" style="flex:1; min-width:220px;"><b>${name}</b><ul>` +
        (top.length ? top.map(([r, c]) => `<li>${r} (${c})</li>`).join('') : '<li>—</li>') + '</ul></div>';
    }).join('') + '</div>';
}

// ---------------------------------------------------------------------
// Documente
// ---------------------------------------------------------------------

function renderDocumenteFilters() {
  const regionSel = document.getElementById('doc-filter-region');
  const themeSel = document.getElementById('doc-filter-theme');
  regionSel.innerHTML = '<option value="">Toate regiunile</option>' + Object.keys(REGION_TERMS).map(r => `<option value="${r}">${r}</option>`).join('')
    + Object.keys(FORTRESS_TERMS).map(f => `<option value="${f}">${f}</option>`).join('');
  themeSel.innerHTML = '<option value="">Toate temele</option>' + Object.keys(THEME_TERMS).map(t => `<option value="${t}">${t}</option>`).join('');
}

function currentDocuments() {
  if (!hasPdf()) return null;
  let docs = corpusEntries();
  const region = document.getElementById('doc-filter-region').value;
  const theme = document.getElementById('doc-filter-theme').value;
  const q = document.getElementById('doc-search').value.trim();
  if (region) docs = docs.filter(e => e.regions.includes(region) || e.fortresses.includes(region));
  if (theme) docs = docs.filter(e => e.themes.includes(theme));
  if (q) docs = docs.filter(e => findFlexible(q, e.summary + ' ' + e.fullText));
  return docs;
}

function renderDocumente() {
  const table = document.getElementById('table-documente');
  const detailBox = document.getElementById('doc-detail-box');
  if (hasPdf()) {
    const docs = currentDocuments();
    table.innerHTML = '<tr><th>Nr.</th><th>Destinatar</th><th>Regiuni</th><th>Cetăți</th><th>Teme</th><th>An</th><th>Volum</th><th>Pag.</th></tr>' +
      docs.map((e, i) => `<tr data-idx="${i}" style="cursor:pointer;"><td>${e.num}</td><td>${e.recipient}</td><td>${e.regions.join(', ') || '—'}</td><td>${e.fortresses.join(', ') || '—'}</td><td>${e.themes.join(', ') || '—'}</td><td>${e.year != null ? e.year : '—'}</td><td>${e.volume}</td><td>${e.page}</td></tr>`).join('');
    table.querySelectorAll('tr[data-idx]').forEach(tr => {
      tr.addEventListener('click', () => {
        const doc = docs[parseInt(tr.dataset.idx, 10)];
        detailBox.innerHTML = `<div class="doc-detail">
          <h3>Fișa hükümului — #${doc.num}</h3>
          <p><b>Volum:</b> ${doc.volume} &nbsp; <b>Pagina:</b> ${doc.page} &nbsp; <b>An:</b> ${doc.year != null ? doc.year : 'necunoscut'}</p>
          <p><b>Regiuni:</b> ${doc.regions.join(', ') || '—'} &nbsp; <b>Cetăți:</b> ${doc.fortresses.join(', ') || '—'} &nbsp; <b>Teme:</b> ${doc.themes.join(', ') || '—'}</p>
          <p><b>Rezumat:</b> ${doc.summary}</p>
          <div class="fulltext">${escapeHtml(doc.fullText.slice(0, 3000))}</div>
          <h4 style="margin-top:14px;">Traducere (aproximativă, AI)</h4>
          <button id="translate-btn" type="button">Tradu în română</button>
          <div id="translate-result" style="margin-top:8px;"></div>
        </div>`;
        document.getElementById('translate-btn').addEventListener('click', async () => {
          const resultEl = document.getElementById('translate-result');
          resultEl.innerHTML = '<span class="spinner"></span>Se traduce (poate apărea o fereastră de autentificare Puter, la prima folosire)...';
          try {
            const translation = await translateToRomanian(doc.fullText.slice(0, 3000));
            resultEl.innerHTML = `<p>${escapeHtml(translation).replace(/\n/g, '<br>')}</p>
              <p class="hint">Traducere automată AI, aproximativă — necesită verificare filologică.</p>`;
          } catch (err) {
            resultEl.innerHTML = `<p class="status err">Eroare la traducere: ${escapeHtml(err.message || String(err))}</p>`;
          }
        });
      });
    });
  } else {
    const q = document.getElementById('doc-search').value.trim().toLowerCase();
    const rows = DEMO_DATA.filter(r => r.rezumat.toLowerCase().includes(q));
    table.innerHTML = '<tr><th>ID</th><th>An</th><th>Teritoriu</th><th>Localitate</th><th>Temă</th><th>Rezumat</th></tr>' +
      rows.map(r => `<tr data-id="${r.id}" style="cursor:pointer"><td>${r.id}</td><td>${r.an}</td><td>${r.principat}</td><td>${r.localitate}</td><td>${r.tema}</td><td>${r.rezumat}</td></tr>`).join('');
    table.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const doc = DEMO_DATA.find(r => r.id === tr.dataset.id);
        detailBox.innerHTML = `<div class="doc-detail">
          <h3>Fișa documentului — ${doc.id}</h3>
          <p><b>Registru:</b> ${doc.registru} &nbsp; <b>An:</b> ${doc.an} &nbsp; <b>Teritoriu:</b> ${doc.principat} &nbsp;
             <b>Localitate:</b> ${doc.localitate} &nbsp; <b>Temă:</b> ${doc.tema}</p>
          <p><b>Rezumat:</b> ${doc.rezumat}</p>
          <p class="rel"><b>${doc.actor_principal}</b> → <b>${doc.tip_decizie}</b> → <b>${doc.actor_secundar}</b></p>
        </div>`;
      });
    });
  }
}

['doc-filter-region', 'doc-filter-theme', 'doc-search'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderDocumente);
});

// ---------------------------------------------------------------------
// Volum PDF (viewer + raw search across ALL entries, unscoped)
// ---------------------------------------------------------------------

function renderVolum() {
  const empty = document.getElementById('volum-empty');
  const content = document.getElementById('volum-content');
  if (!state.volumes.length) { empty.style.display = 'block'; content.style.display = 'none'; return; }
  empty.style.display = 'none';
  content.style.display = 'block';

  const sel = document.getElementById('volum-select');
  sel.innerHTML = state.volumes.map(v => `<option value="${v.name}">${v.name}</option>`).join('');
  const chosen = state.volumes.find(v => v.name === sel.value) || state.volumes[0];
  document.getElementById('pdf-viewer-frame').src = chosen.objectUrl;

  sel.onchange = () => {
    const v = state.volumes.find(v => v.name === sel.value);
    document.getElementById('pdf-viewer-frame').src = v.objectUrl;
  };

  const searchInput = document.getElementById('volum-search');
  searchInput.oninput = () => {
    const q = searchInput.value.trim();
    const results = document.getElementById('volum-search-results');
    if (!q) { results.innerHTML = ''; return; }
    const matches = allEntries().filter(e => findFlexible(q, e.summary + ' ' + e.fullText));
    results.innerHTML = `<p><b>${matches.length} hükümuri</b> conțin „${q}”.</p>` +
      matches.slice(0, 50).map(e => `<details class="entry-card"><summary>#${e.num} — ${e.recipient} (${e.volume}, p. ${e.page})</summary>
        <p><b>Rezumat:</b> ${e.summary}</p><div class="fulltext">${escapeHtml(e.fullText.slice(0, 1500))}</div></details>`).join('') +
      (matches.length > 50 ? `<p class="hint">Se afișează primele 50 din ${matches.length}.</p>` : '');
  };
}

// Initial render (demo mode)
renderAll();
