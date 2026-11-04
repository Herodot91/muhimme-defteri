// Actualizări: working tools on top of the uploaded volume (evidence, corrections,
// name register, collaboration, version history, accuracy sample).
// Pure logic lives in engine.js; this file is the browser UI and storage.

const STORE_KEYS = {
  annotations: 'muhimme.annotations.v1',
  colleagues: 'muhimme.colleagues.v1',
  variants: 'muhimme.variants.v1',
  annotator: 'muhimme.annotator.v1',
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function cleanName(raw) {
  return String(raw || '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 40);
}

function cleanVariants(raw) {
  const out = {};
  const known = new Set([...Object.keys(REGION_TERMS), ...Object.keys(FORTRESS_TERMS)]);
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(raw).forEach(([label, list]) => {
    if (!known.has(label) || !Array.isArray(list)) return;
    const ok = list.map(normalizeVariant).filter(Boolean);
    if (ok.length) out[label] = [...new Set(ok)];
  });
  return out;
}

const review = {
  annotations: sanitizeAnnotations(loadJSON(STORE_KEYS.annotations, {})),
  colleagues: (loadJSON(STORE_KEYS.colleagues, []) || []).slice(0, 20).map(c => ({
    name: cleanName(c && c.name) || 'Coleg',
    engineVersion: String((c && c.engineVersion) || '').slice(0, 20),
    importedAt: String((c && c.importedAt) || '').slice(0, 30),
    items: sanitizeAnnotations(c && c.items),
  })),
  variants: cleanVariants(loadJSON(STORE_KEYS.variants, {})),
  annotator: cleanName(loadJSON(STORE_KEYS.annotator, '')),
  storageOk: true,
};

function persistReview() {
  review.storageOk = [
    saveJSON(STORE_KEYS.annotations, review.annotations),
    saveJSON(STORE_KEYS.colleagues, review.colleagues),
    saveJSON(STORE_KEYS.variants, review.variants),
    saveJSON(STORE_KEYS.annotator, review.annotator),
  ].every(Boolean);
}

const KP = { regions: 'r', fortresses: 'f', themes: 't' };
const KIND_NAME = { regions: 'Regiune', fortresses: 'Cetate', themes: 'Temă' };
const esc = escapeHtml;
const escAttr = s => escapeHtml(String(s)).replace(/"/g, '&quot;');

function labelId(kind, label) { return KP[kind] + ':' + label; }
function kindOfId(id) { return LABEL_KINDS[id[0]]; }
function labelOfId(id) { return id.slice(2); }
function labelGroups() {
  return [['regions', Object.keys(REGION_TERMS)], ['fortresses', Object.keys(FORTRESS_TERMS)], ['themes', Object.keys(THEME_TERMS)]];
}

function entryKey(e) { return e.volume + '#' + e.num + '#' + e.page; }
const ridMap = new Map();
let ridCounter = 0;
function entryRid(e) {
  if (e.rid === undefined) { e.rid = ++ridCounter; ridMap.set(e.rid, e); }
  return e.rid;
}
function textFor(e) { return e.summary + ' ' + e.fullText.slice(0, 2500); }
function hasVolume() { return state.volumes.length > 0; }

const evidenceCache = new Map();
function evidenceFor(e) {
  const key = entryKey(e);
  if (!evidenceCache.has(key)) evidenceCache.set(key, classifyText(textFor(e), review.variants).evidence);
  return evidenceCache.get(key);
}

// Sets the labels every other tab reads (e.regions, e.fortresses, e.themes) from
// the automatic labels plus the researcher's verdicts. `reclassify` re-runs the
// automatic step, needed after a place-name variant changes.
function applyReview(reclassify) {
  const hasVariants = Object.keys(review.variants).length > 0;
  if (reclassify) evidenceCache.clear();
  allEntries().forEach(e => {
    if (!e.auto || reclassify) {
      if (hasVariants || reclassify) {
        const c = classifyText(textFor(e), review.variants);
        e.auto = { regions: c.regions, fortresses: c.fortresses, themes: c.themes };
      } else {
        e.auto = { regions: e.regions.slice(), fortresses: e.fortresses.slice(), themes: e.themes.slice() };
      }
    }
    const eff = effectiveLabels(e.auto, review.annotations[entryKey(e)]);
    e.regions = eff.regions;
    e.fortresses = eff.fortresses;
    e.themes = eff.themes;
  });
}

let renderTimer = null;
function commitReview(reclassify) {
  persistReview();
  applyReview(!!reclassify);
  renderEffects();
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const open = [...document.querySelectorAll('details.entry-card[open][data-rid]')].map(d => d.dataset.rid);
    renderAll();
    open.forEach(rid => {
      const d = document.querySelector('details.entry-card[data-rid="' + rid + '"]');
      if (d) d.open = true;
    });
  }, 350);
}

function annotation(key, create) {
  if (!review.annotations[key] && create) {
    review.annotations[key] = { verdicts: {}, added: { regions: [], fortresses: [], themes: [] }, note: '' };
  }
  return review.annotations[key] || null;
}

function pruneAnnotation(key) {
  const a = review.annotations[key];
  if (!a) return;
  const empty = !Object.keys(a.verdicts).length && !a.note && !a.added.regions.length && !a.added.fortresses.length && !a.added.themes.length;
  if (empty) delete review.annotations[key];
}

function setVerdict(key, id, verdict) {
  const a = annotation(key, true);
  if (a.verdicts[id] === verdict) delete a.verdicts[id];
  else a.verdicts[id] = verdict;
  pruneAnnotation(key);
}

function setVerdictExact(key, id, verdict) {
  if (verdict) annotation(key, true).verdicts[id] = verdict;
  else if (annotation(key, false)) delete annotation(key, false).verdicts[id];
  pruneAnnotation(key);
}

let lastAction = null;

function addLabel(key, id) {
  const a = annotation(key, true);
  const kind = kindOfId(id), label = labelOfId(id);
  if (!a.added[kind].includes(label)) a.added[kind].push(label);
  delete a.verdicts[id];
}

function removeAddedLabel(key, id) {
  const a = annotation(key, false);
  if (!a) return;
  const kind = kindOfId(id), label = labelOfId(id);
  a.added[kind] = a.added[kind].filter(l => l !== label);
  pruneAnnotation(key);
}

function reviewTotals() {
  let ok = 0, no = 0, added = 0, notes = 0;
  Object.values(review.annotations).forEach(a => {
    Object.values(a.verdicts).forEach(v => { if (v === 'ok') ok++; else no++; });
    added += a.added.regions.length + a.added.fortresses.length + a.added.themes.length;
    if (a.note) notes++;
  });
  return { ok, no, added, notes, entries: Object.keys(review.annotations).length };
}

function downloadFile(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }

// ---------------------------------------------------------------------
// Evidence snippets (also used by the map and Documente tabs)
// ---------------------------------------------------------------------

function snippetHtml(text, ev) {
  const from = Math.max(0, ev.index - 70);
  const to = Math.min(text.length, ev.index + ev.match.length + 70);
  const clean = s => esc(s.replace(/\s+/g, ' '));
  return (from > 0 ? '…' : '') + clean(text.slice(from, ev.index)) + '<mark>' + clean(ev.match) + '</mark>' +
    clean(text.slice(ev.index + ev.match.length, to)) + (to < text.length ? '…' : '');
}

function evidenceItemHtml(e, ev, actions) {
  const id = labelId(ev.kind, ev.label);
  const a = review.annotations[entryKey(e)];
  const v = a && a.verdicts[id];
  const verdictTag = v === 'ok' ? '<span class="rv-verdict ok">confirmat</span>' : v === 'no' ? '<span class="rv-verdict no">respins</span>' : '';
  const buttons = actions
    ? `<div class="rv-actions">
         <button type="button" class="rv-btn ok${v === 'ok' ? ' on' : ''}" data-act="ok" data-id="${escAttr(id)}" aria-pressed="${v === 'ok'}">Corect</button>
         <button type="button" class="rv-btn no${v === 'no' ? ' on' : ''}" data-act="no" data-id="${escAttr(id)}" aria-pressed="${v === 'no'}">Greșit</button>
       </div>`
    : '';
  return `<li class="rv-item${v === 'no' ? ' rejected' : ''}">
    <div class="rv-item-head"><b>${esc(ev.label)}</b>
      <span class="rv-term">termen: ${esc(ev.term)}</span>
      <span class="rv-tag ${ev.wholeWord ? 'whole' : 'partial'}">${ev.wholeWord ? 'cuvânt întreg' : 'potrivire parțială'}</span>${verdictTag}</div>
    <div class="rv-snippet">${snippetHtml(textFor(e), ev)}</div>${buttons}</li>`;
}

// "Why was this labelled" block with Corect / Greșit buttons, used directly on
// the map cards and the Documente card. It lists the automatic labels, so a
// rejected one stays visible and can be restored.
function evidenceHtml(e, kinds) {
  const evs = evidenceFor(e).filter(ev => !kinds || kinds.includes(ev.kind));
  if (!evs.length) return '';
  return `<div class="rv-inline" data-rid="${entryRid(e)}" data-kinds="${escAttr((kinds || []).join(','))}"><b>Dovezi pentru etichete — verifică direct aici</b><ul class="rv-items">${evs.map(ev => evidenceItemHtml(e, ev, true)).join('')}</ul></div>`;
}

document.addEventListener('click', ev => {
  const btn = ev.target.closest('.rv-inline .rv-btn[data-act]');
  if (!btn) return;
  const box = btn.closest('.rv-inline');
  const e = ridMap.get(parseInt(box.dataset.rid, 10));
  if (!e || (btn.dataset.act !== 'ok' && btn.dataset.act !== 'no')) return;
  const key = entryKey(e);
  const before = review.annotations[key];
  const prev = (before && before.verdicts[btn.dataset.id]) || null;
  setVerdict(key, btn.dataset.id, btn.dataset.act);
  lastAction = { rid: e.rid, key, id: btn.dataset.id, prev, verdict: btn.dataset.act === prev ? null : btn.dataset.act };
  commitReview(false);
  box.outerHTML = evidenceHtml(e, box.dataset.kinds ? box.dataset.kinds.split(',') : null);
});

// ---------------------------------------------------------------------
// Review list (tools 01, 02 and the sample in 06)
// ---------------------------------------------------------------------

const rvState = { label: '', partialOnly: false, unreviewedOnly: false, q: '', limit: 30, sample: null };

function reviewSource() {
  return allEntries().filter(e => (e.auto && (e.auto.regions.length || e.auto.fortresses.length)) || review.annotations[entryKey(e)]);
}

function reviewFilter() {
  let list = reviewSource();
  if (rvState.sample) list = list.filter(e => rvState.sample.has(entryKey(e)));
  if (rvState.label) {
    list = list.filter(e => evidenceFor(e).some(ev => labelId(ev.kind, ev.label) === rvState.label) ||
      (e[kindOfId(rvState.label)] || []).includes(labelOfId(rvState.label)));
  }
  if (rvState.partialOnly) {
    list = list.filter(e => evidenceFor(e).some(ev => !ev.wholeWord && (!rvState.label || labelId(ev.kind, ev.label) === rvState.label)));
  }
  if (rvState.unreviewedOnly) {
    list = list.filter(e => {
      const a = review.annotations[entryKey(e)];
      return !evidenceFor(e).some(ev => a && a.verdicts[labelId(ev.kind, ev.label)]);
    });
  }
  if (rvState.q.trim()) list = list.filter(e => findFlexible(rvState.q.trim(), textFor(e)));
  return list;
}

function cardHtml(e, annotate, idx) {
  const key = entryKey(e);
  const a = review.annotations[key];
  let evs = evidenceFor(e);
  if (rvState.label) evs = evs.filter(ev => labelId(ev.kind, ev.label) === rvState.label);
  if (rvState.partialOnly) evs = evs.filter(ev => !ev.wholeWord);
  let extra = '';
  if (annotate) {
    const present = new Set(evidenceFor(e).map(ev => labelId(ev.kind, ev.label)));
    const addedChips = a ? ['regions', 'fortresses', 'themes'].flatMap(kind => a.added[kind].map(l => {
      const id = labelId(kind, l);
      return `<span class="rv-chip">${esc(l)} <button type="button" class="rv-x" data-act="rm-added" data-id="${escAttr(id)}" aria-label="Elimină eticheta ${escAttr(l)}">×</button></span>`;
    })).join('') : '';
    const options = labelGroups().map(([kind, labels]) => `<optgroup label="${KIND_NAME[kind]}">` +
      labels.filter(l => !present.has(labelId(kind, l)) && !(a && a.added[kind].includes(l)))
        .map(l => `<option value="${escAttr(labelId(kind, l))}">${esc(l)}</option>`).join('') + '</optgroup>').join('');
    extra = `<div class="rv-extra">
      <div class="rv-added"><b>Etichete adăugate:</b> ${addedChips || '<span class="rv-none">niciuna</span>'}</div>
      <div class="rv-add-row">
        <select class="rv-add-select" aria-label="Etichetă lipsă">${options}</select>
        <button type="button" class="rv-btn" data-act="add">Adaugă eticheta lipsă</button>
      </div>
      <label class="rv-note-label">Notă <textarea class="rv-note" rows="2" maxlength="500" placeholder="Observație despre acest hüküm">${esc(a ? a.note : '')}</textarea></label>
    </div>`;
  }
  return `<article class="rv-card" data-i="${idx}">
    <header class="rv-card-head"><b>#${esc(e.num)}</b> — ${esc(e.recipient)} <span class="rv-meta">${esc(e.volume)}, p. ${esc(e.page)}</span></header>
    <p class="rv-summary">${esc(e.summary.replace(/\s+/g, ' ').slice(0, 240))}</p>
    <ul class="rv-items">${evs.map(ev => evidenceItemHtml(e, ev, annotate)).join('') || '<li class="rv-none">Nicio dovadă automată pentru filtrul ales.</li>'}</ul>
    ${extra}
  </article>`;
}

function labelOptionsHtml(selected) {
  return '<option value="">Toate etichetele</option>' + labelGroups().map(([kind, labels]) =>
    `<optgroup label="${KIND_NAME[kind]}">` + labels.map(l => {
      const id = labelId(kind, l);
      return `<option value="${escAttr(id)}"${id === selected ? ' selected' : ''}>${esc(l)}</option>`;
    }).join('') + '</optgroup>').join('');
}

function needVolume(box) {
  if (hasVolume()) return true;
  box.innerHTML = '<p class="rv-empty">Încarcă un volum PDF din bara laterală pentru a folosi această unealtă pe date reale.</p>';
  return false;
}

function evidenceOverviewHtml() {
  const stats = new Map();
  reviewSource().forEach(e => evidenceFor(e).forEach(ev => {
    const id = labelId(ev.kind, ev.label);
    if (!stats.has(id)) stats.set(id, { id, total: 0, partial: 0 });
    const s = stats.get(id);
    s.total++;
    if (!ev.wholeWord) s.partial++;
  }));
  const rows = [...stats.values()].sort((a, b) => b.partial / b.total - a.partial / a.total || b.total - a.total);
  return `<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Etichetă</th><th>Hükümuri cu dovezi</th><th>Potriviri parțiale</th><th>Pondere</th></tr></thead><tbody>` +
    rows.map(s => `<tr><td>${esc(labelOfId(s.id))} <span class="rv-meta">${KIND_NAME[kindOfId(s.id)]}</span></td><td>${s.total}</td><td>${s.partial}</td><td>${pct(s.partial / s.total)}</td></tr>`).join('') +
    '</tbody></table></div>';
}

function countersHtml() {
  const t = reviewTotals();
  return `<div class="rv-counters"><span><b>${t.ok}</b> confirmate</span><span><b>${t.no}</b> respinse</span><span><b>${t.added}</b> etichete adăugate</span><span><b>${t.notes}</b> note</span><span><b>${t.entries}</b> hükümuri revizuite</span></div>` +
    (review.storageOk ? '' : '<p class="rv-warn">Browserul nu a putut salva corecțiile. Exportă-le ca să nu le pierzi (actualizarea 04).</p>');
}

function renderReviewTool(box, annotate, options) {
  if (!needVolume(box)) return;
  const opts = options || {};
  let current = [];
  box.innerHTML = `
    ${annotate ? '<div id="rv-counters"></div>' : `<p class="rv-help">Pentru fiecare etichetă, aplicația arată termenul găsit și fragmentul în care apare. O potrivire parțială înseamnă că termenul este lipit de alte litere (de exemplu într-o formă flexionată sau într-un alt cuvânt) și merită verificată.</p>
      <h4 class="rv-sub">Unde sunt potrivirile parțiale</h4>${evidenceOverviewHtml()}`}
    <div class="rv-controls">
      <label>Etichetă <select id="rv-label">${labelOptionsHtml(rvState.label)}</select></label>
      <label class="rv-check"><input type="checkbox" id="rv-partial"${rvState.partialOnly ? ' checked' : ''}> Doar potriviri parțiale</label>
      ${annotate ? `<label class="rv-check"><input type="checkbox" id="rv-unrev"${rvState.unreviewedOnly ? ' checked' : ''}> Doar nerevizuite</label>` : ''}
      <label>Caută <input type="text" id="rv-q" value="${escAttr(rvState.q)}" placeholder="termen în text"></label>
    </div>
    <p id="rv-count" class="rv-meta"></p>
    <div id="rv-list"></div>
    <div id="rv-more"></div>`;
  const listEl = box.querySelector('#rv-list');
  const refreshCounters = () => { const c = box.querySelector('#rv-counters'); if (c) c.innerHTML = countersHtml() + (annotate ? '<button type="button" class="rv-btn danger" id="rv-clear">Șterge toate corecțiile</button>' : ''); };
  const draw = () => {
    current = reviewFilter();
    const shown = current.slice(0, rvState.limit);
    box.querySelector('#rv-count').textContent = `${current.length} hükümuri se potrivesc filtrelor${rvState.sample ? ' (din eșantion)' : ''}; se afișează ${shown.length}.`;
    listEl.innerHTML = shown.map((e, i) => cardHtml(e, annotate, i)).join('') || '<p class="rv-empty">Niciun hüküm nu se potrivește filtrelor.</p>';
    box.querySelector('#rv-more').innerHTML = current.length > shown.length ? '<button type="button" class="rv-btn" id="rv-more-btn">Arată mai multe</button>' : '';
    refreshCounters();
  };
  box.querySelector('#rv-label').addEventListener('change', ev => { rvState.label = ev.target.value; rvState.limit = 30; draw(); });
  box.querySelector('#rv-partial').addEventListener('change', ev => { rvState.partialOnly = ev.target.checked; rvState.limit = 30; draw(); });
  const unrev = box.querySelector('#rv-unrev');
  if (unrev) unrev.addEventListener('change', ev => { rvState.unreviewedOnly = ev.target.checked; rvState.limit = 30; draw(); });
  box.querySelector('#rv-q').addEventListener('input', ev => { rvState.q = ev.target.value; rvState.limit = 30; draw(); });
  box.addEventListener('click', ev => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.id === 'rv-more-btn') { rvState.limit += 30; draw(); return; }
    if (btn.id === 'rv-clear') {
      if (window.confirm('Ștergi toate corecțiile salvate în acest browser? Acțiunea nu poate fi anulată.')) {
        review.annotations = {};
        commitReview(false);
        draw();
      }
      return;
    }
    const card = btn.closest('.rv-card');
    if (!card || !annotate) return;
    const e = current[parseInt(card.dataset.i, 10)];
    if (!e) return;
    const key = entryKey(e);
    const act = btn.dataset.act;
    if (act === 'ok' || act === 'no') setVerdict(key, btn.dataset.id, act);
    else if (act === 'rm-added') removeAddedLabel(key, btn.dataset.id);
    else if (act === 'add') {
      const sel = card.querySelector('.rv-add-select');
      if (!sel || !sel.value) return;
      addLabel(key, sel.value);
    } else return;
    commitReview(false);
    card.outerHTML = cardHtml(e, annotate, card.dataset.i);
    refreshCounters();
  });
  box.addEventListener('change', ev => {
    if (!ev.target.classList.contains('rv-note')) return;
    const card = ev.target.closest('.rv-card');
    const e = card && current[parseInt(card.dataset.i, 10)];
    if (!e) return;
    const a = annotation(entryKey(e), true);
    a.note = ev.target.value.slice(0, 500);
    pruneAnnotation(entryKey(e));
    commitReview(false);
    refreshCounters();
  });
  draw();
  if (opts.afterDraw) opts.afterDraw();
}

// ---------------------------------------------------------------------
// 03 Name register
// ---------------------------------------------------------------------

function mentionCount(label, type) {
  const kind = type === 'region' ? 'regions' : 'fortresses';
  return allEntries().filter(e => e[kind].includes(label)).length;
}

function renderRegistryTool(box) {
  const rows = NAME_REGISTRY.map(p => {
    const names = p.names.map(n => `<li>${esc(n.form)} <span class="rv-meta">${esc(n.lang)}${n.period ? ', ' + esc(n.period) : ''}</span></li>`).join('');
    const variants = (review.variants[p.label] || []).map(v => `<span class="rv-chip">${esc(v)} <button type="button" class="rv-x" data-act="rm-variant" data-label="${escAttr(p.label)}" data-v="${escAttr(v)}" aria-label="Elimină varianta ${escAttr(v)}">×</button></span>`).join('');
    return `<tr>
      <td><b>${esc(p.label)}</b><br><span class="rv-meta">${p.type === 'region' ? 'Regiune' : 'Cetate'}</span></td>
      <td><ul class="rv-names">${names}</ul></td>
      <td>${p.terms.map(t => `<code>${esc(t)}</code>`).join(' ')}${variants ? '<div class="rv-variants">' + variants + '</div>' : ''}
        <form class="rv-variant-form" data-label="${escAttr(p.label)}"><input type="text" name="v" placeholder="variantă nouă" aria-label="Variantă nouă pentru ${escAttr(p.label)}" maxlength="40"><button type="submit" class="rv-btn">Adaugă</button></form></td>
      <td>${p.exclude ? esc(p.exclude) : '—'}</td>
      <td>${hasVolume() ? mentionCount(p.label, p.type) : '—'}</td>
    </tr>`;
  }).join('');
  box.innerHTML = `<p class="rv-help">Motorul caută exact termenii din această listă. O variantă nouă (litere latine, fără diacritice) este căutată imediat în volumul încărcat, iar hărțile, graficele și tabelele se recalculează.</p>
    <div id="rv-registry-msg" class="rv-msg" role="status"></div>
    <div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Loc</th><th>Alte nume</th><th>Termeni căutați</th><th>Excluderi</th><th>Hükümuri</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const msg = box.querySelector('#rv-registry-msg');
  const labelType = label => (NAME_REGISTRY.find(p => p.label === label) || {}).type;
  box.onsubmit = ev => {
    const form = ev.target.closest('.rv-variant-form');
    if (!form) return;
    ev.preventDefault();
    const label = form.dataset.label;
    const entry = NAME_REGISTRY.find(p => p.label === label);
    const raw = form.elements.v.value;
    const v = normalizeVariant(raw);
    if (!v) { msg.textContent = 'Varianta trebuie să aibă 3–40 de litere latine (fără cifre sau semne).'; return; }
    if (entry.terms.includes(v) || (review.variants[label] || []).includes(v)) { msg.textContent = `Varianta „${v}” există deja pentru ${label}.`; return; }
    const before = mentionCount(label, labelType(label));
    review.variants[label] = (review.variants[label] || []).concat(v);
    commitReview(true);
    const after = mentionCount(label, labelType(label));
    renderRegistryTool(box);
    box.querySelector('#rv-registry-msg').textContent = hasVolume()
      ? `Varianta „${v}” a fost adăugată pentru ${label}: ${before} → ${after} hükümuri în volumul încărcat.`
      : `Varianta „${v}” a fost adăugată pentru ${label}; va fi folosită la următorul volum încărcat.`;
  };
  box.onclick = ev => {
    const btn = ev.target.closest('button[data-act="rm-variant"]');
    if (!btn) return;
    const label = btn.dataset.label;
    review.variants[label] = (review.variants[label] || []).filter(x => x !== btn.dataset.v);
    if (!review.variants[label].length) delete review.variants[label];
    commitReview(true);
    renderRegistryTool(box);
    box.querySelector('#rv-registry-msg').textContent = `Varianta „${btn.dataset.v}” a fost eliminată.`;
  };
}

// ---------------------------------------------------------------------
// 04 Collaboration: export, import, compare
// ---------------------------------------------------------------------

function csvCell(value) {
  let s = String(value == null ? '' : value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function splitKey(key) {
  const last = key.lastIndexOf('#'), prev = key.lastIndexOf('#', last - 1);
  return { volume: key.slice(0, prev), num: key.slice(prev + 1, last), page: key.slice(last + 1) };
}

function exportAnnotationsJson() {
  const payload = {
    format: 'muhimme-annotations', version: 1, engineVersion: ENGINE_VERSION,
    annotator: review.annotator || 'anonim', exportedAt: new Date().toISOString(),
    volumes: state.volumes.map(v => v.name), items: review.annotations, variants: review.variants,
  };
  downloadFile('corectii-muhimme.json', 'application/json', JSON.stringify(payload, null, 2));
}

function exportAnnotationsCsv() {
  const byKey = new Map(allEntries().map(e => [entryKey(e), e]));
  const lines = [['volum', 'numar', 'pagina', 'destinatar', 'tip', 'eticheta', 'verdict', 'nota'].map(csvCell).join(',')];
  Object.entries(review.annotations).forEach(([key, a]) => {
    const { volume, num, page } = splitKey(key);
    const e = byKey.get(key);
    const base = [volume, num, page, e ? e.recipient : ''];
    const vm = verdictMap(a);
    Object.entries(vm).forEach(([id, v]) => {
      lines.push([...base, KIND_NAME[kindOfId(id)], labelOfId(id), v === 'ok' ? 'corect' : v === 'no' ? 'greșit' : 'adăugat', a.note].map(csvCell).join(','));
    });
    if (!Object.keys(vm).length && a.note) lines.push([...base, '', '', '', a.note].map(csvCell).join(','));
  });
  downloadFile('corectii-muhimme.csv', 'text/csv;charset=utf-8', '﻿' + lines.join('\n'));
}

function importAnnotationFiles(files, done) {
  const notes = [];
  let pending = files.length;
  const finish = () => { if (--pending === 0) { persistReview(); done(notes); } };
  files.forEach(file => {
    if (file.size > 5 * 1024 * 1024) { notes.push(`„${file.name}” este prea mare (peste 5 MB).`); finish(); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || obj.format !== 'muhimme-annotations' || typeof obj.items !== 'object') throw new Error('format');
        let name = cleanName(obj.annotator) || `Coleg ${review.colleagues.length + 1}`;
        while (review.colleagues.some(c => c.name === name) || name === (review.annotator || 'Eu')) name += ' (2)';
        const items = sanitizeAnnotations(obj.items);
        review.colleagues.push({ name, engineVersion: String(obj.engineVersion || '').slice(0, 20), importedAt: new Date().toISOString(), items });
        const n = Object.keys(items).length;
        notes.push(`„${file.name}”: ${n} hükümuri revizuite de ${name}` +
          (obj.engineVersion && obj.engineVersion !== ENGINE_VERSION ? `; atenție, a fost făcut cu versiunea ${String(obj.engineVersion).slice(0, 20)} a motorului, iar aceasta este ${ENGINE_VERSION}.` : '.'));
      } catch (err) {
        notes.push(`„${file.name}” nu este un fișier de corecții valid.`);
      }
      finish();
    };
    reader.onerror = () => { notes.push(`„${file.name}” nu a putut fi citit.`); finish(); };
    reader.readAsText(file);
  });
}

function verdictText(v) { return v === 'ok' ? 'corect' : v === 'no' ? 'greșit' : v === 'add' ? 'adăugat' : '—'; }

function adoptVerdict(key, id, verdict) {
  if (verdict === 'add') addLabel(key, id);
  else if (verdict === 'no' && (annotation(key, false) || { added: { regions: [], fortresses: [], themes: [] } }).added[kindOfId(id)].includes(labelOfId(id))) removeAddedLabel(key, id);
  else {
    const a = annotation(key, true);
    a.verdicts[id] = verdict;
  }
  pruneAnnotation(key);
}

function renderCollaborationTool(box) {
  const me = review.annotator || 'Eu';
  const sets = [{ name: me, items: review.annotations }, ...review.colleagues];
  const withData = sets.filter(s => Object.keys(s.items).length);
  const cmp = compareAnnotators(sets);
  const byKey = new Map(allEntries().map(e => [entryKey(e), e]));
  const describe = key => {
    const e = byKey.get(key);
    if (e) return `#${esc(e.num)} — ${esc(e.recipient)} <span class="rv-meta">p. ${esc(e.page)}</span>`;
    const k = splitKey(key);
    return `#${esc(k.num)} <span class="rv-meta">${esc(k.volume)} (volum neîncărcat)</span>`;
  };
  const colleaguesHtml = review.colleagues.map((c, i) => `<li><b>${esc(c.name)}</b> — ${Object.keys(c.items).length} hükümuri revizuite
      <span class="rv-meta">(versiunea motorului ${esc(c.engineVersion || 'necunoscută')})</span>
      <button type="button" class="rv-x" data-act="rm-colleague" data-i="${i}" aria-label="Elimină fișierul lui ${escAttr(c.name)}">×</button></li>`).join('');
  const rows = cmp.disagreements.map((d, idx) => {
    const key = d.key;
    const cells = sets.map((s, i) => `<td>${verdictText(d.verdicts[i])}</td>`).join('');
    const adopt = sets.map((s, i) => (i > 0 && d.verdicts[i] && byKey.has(key))
      ? `<button type="button" class="rv-btn" data-act="adopt" data-d="${idx}" data-i="${i}">Adoptă verdictul lui ${esc(s.name)}</button>` : '').join(' ');
    return `<tr><td>${describe(key)}</td><td>${esc(labelOfId(d.id))}</td>${cells}<td>${adopt}</td></tr>`;
  }).join('');
  box.innerHTML = `
    <p class="rv-help">Corecțiile tale rămân în acest browser. Fiecare cercetător le exportă într-un fișier, iar aici se pot încărca fișierele colegilor ca să se vadă unde verdictele diferă.</p>
    <div class="rv-controls">
      <label>Numele tău <input type="text" id="rv-name" value="${escAttr(review.annotator)}" maxlength="40" placeholder="ex. Ana"></label>
      <button type="button" class="rv-btn" data-act="export-json">Exportă corecțiile (JSON)</button>
      <button type="button" class="rv-btn" data-act="export-csv">Exportă corecțiile (CSV)</button>
      <label class="rv-file">Importă fișiere de la colegi <input type="file" id="rv-import" accept="application/json,.json" multiple></label>
    </div>
    <div id="rv-collab-msg" class="rv-msg" role="status"></div>
    ${countersHtml()}
    <h4 class="rv-sub">Fișiere importate</h4>
    ${colleaguesHtml ? `<ul class="rv-list">${colleaguesHtml}</ul>` : '<p class="rv-none">Niciun fișier importat.</p>'}
    <h4 class="rv-sub">Comparare</h4>
    ${withData.length < 2
      ? '<p class="rv-none">Comparația apare când cel puțin două persoane (tu și un coleg, sau doi colegi) au verificat aceleași etichete.</p>'
      : `<p><b>${cmp.judged}</b> etichete verificate de cel puțin două persoane; <b>${cmp.agree}</b> la fel (${pct(cmp.judged ? cmp.agree / cmp.judged : null)}); <b>${cmp.disagreements.length}</b> cu verdicte diferite.</p>
         ${rows ? `<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Hüküm</th><th>Etichetă</th>${sets.map(s => `<th>${esc(s.name)}</th>`).join('')}<th></th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}`}`;
  const msg = box.querySelector('#rv-collab-msg');
  box.querySelector('#rv-name').addEventListener('change', ev => {
    review.annotator = cleanName(ev.target.value);
    persistReview();
    renderCollaborationTool(box);
  });
  box.querySelector('#rv-import').addEventListener('change', ev => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    importAnnotationFiles(files, notes => {
      renderCollaborationTool(box);
      box.querySelector('#rv-collab-msg').innerHTML = notes.map(esc).join('<br>');
    });
  });
  box.onclick = ev => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'export-json') exportAnnotationsJson();
    else if (act === 'export-csv') exportAnnotationsCsv();
    else if (act === 'rm-colleague') {
      review.colleagues.splice(parseInt(btn.dataset.i, 10), 1);
      persistReview();
      renderCollaborationTool(box);
    } else if (act === 'adopt') {
      const d = cmp.disagreements[parseInt(btn.dataset.d, 10)];
      const v = d.verdicts[parseInt(btn.dataset.i, 10)];
      adoptVerdict(d.key, d.id, v);
      commitReview(false);
      renderCollaborationTool(box);
      box.querySelector('#rv-collab-msg').textContent = 'Verdictul a fost adoptat.';
    }
  };
  if (!hasVolume() && msg) msg.textContent = 'Poți exporta și importa corecții și fără un volum încărcat; adoptarea verdictelor cere volumul încărcat.';
}

// ---------------------------------------------------------------------
// 05 Version history
// ---------------------------------------------------------------------

const HISTORY = [
  ['9–11 aug. 2026', 'Prima versiune (Streamlit) și traducerea opțională în română.'],
  ['31 aug. 2026', 'Versiune statică pentru GitHub Pages: motorul de analiză rescris în JavaScript, extragerea PDF în browser, PDF.js găzduit local, traducere prin Puter.js, afișarea textului otoman pe pergament.'],
  ['11 sept. 2026', 'Zoom și deplasare pe grafice, animații, rețele mai mari cu noduri mutabile, axe cu numere întregi.'],
  ['21 sept. 2026', 'Tema Anexare / Istimalet; potrivire corectă pentru vocalele lungi î și û; „ilhak” și „himaye” excluse.'],
  ['7 oct. 2026', 'Hărți istorice (Moldova în 1483, harta lui Cantelli da Vignola din 1686) legate de volumul încărcat; corectarea numărului pentru Kili (88 devine 7).'],
  ['27 oct. 2026', 'Redesenarea paginii și teste automate pentru motor.'],
  ['2 nov. 2026', 'Actualizările devin funcționale: dovezi pentru etichete, corecții ale cercetătorului, registru de nume, comparare între cercetători, măsurarea acurateței.'],
];

const RESULT_CHANGES = [
  ['Hükümuri despre Kili (volumul 3)', '88', '7', 'Potrivirea „kili” prindea și kilise, Kırkkilise, Kilis, kılıç.'],
  ['Hükümuri reale în corpus (volumul 3)', '258', '185', 'Consecința corectării de mai sus: multe hükümuri intrau în corpus doar prin Kili.'],
];

function renderHistoryTool(box) {
  const live = hasVolume()
    ? `<div class="rv-table-wrap"><table class="rv-table"><tbody>
        <tr><td>Hükümuri identificate în total</td><td>${allEntries().length}</td></tr>
        <tr><td>Hükümuri în corpus (cu regiune sau cetate)</td><td>${corpusEntries().length}</td></tr>
        <tr><td>Hükümuri despre Kili</td><td>${mentionCount('Kili (Chilia)', 'fortress')}</td></tr>
      </tbody></table></div>`
    : '<p class="rv-none">Încarcă un volum ca să vezi cifrele actuale.</p>';
  box.innerHTML = `
    <p class="rv-version">Versiunea motorului: <b>${esc(ENGINE_VERSION)}</b> <span class="rv-meta">(se înscrie în fiecare export de corecții)</span></p>
    <h4 class="rv-sub">Cifrele actuale pentru volumul încărcat</h4>${live}
    <h4 class="rv-sub">Schimbări care au modificat rezultatele</h4>
    <div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Cifră</th><th>Înainte</th><th>După</th><th>Motiv</th></tr></thead><tbody>
      ${RESULT_CHANGES.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}
    </tbody></table></div>
    <h4 class="rv-sub">Cronologia modificărilor</h4>
    <ul class="update-timeline">${HISTORY.map(([d, t]) => `<li><time>${esc(d)}</time><span>${esc(t)}</span></li>`).join('')}</ul>
    <p style="margin-top:14px;"><a href="https://github.com/Herodot91/muhimme-defteri/commits/main" target="_blank" rel="noopener">Istoricul complet în depozitul proiectului</a></p>`;
}

// ---------------------------------------------------------------------
// 06 Accuracy sample and roadmap
// ---------------------------------------------------------------------

function accuracyTableHtml() {
  const rows = accuracyByLabel(review.annotations);
  if (!rows.length) return '<p class="rv-none">Nicio etichetă verificată încă. Verifică hükümuri din eșantion cu butoanele Corect / Greșit.</p>';
  let ok = 0, no = 0;
  rows.forEach(r => { ok += r.ok; no += r.no; });
  return `<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Etichetă</th><th>Corecte</th><th>Greșite</th><th>Adăugate (lipsă)</th><th>Precizie</th><th>Acoperire estimată</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(labelOfId(r.id))} <span class="rv-meta">${KIND_NAME[kindOfId(r.id)]}</span></td><td>${r.ok}</td><td>${r.no}</td><td>${r.added}</td><td>${pct(r.precision)}</td><td>${pct(r.recall)}</td></tr>`).join('')}
    <tr class="rv-total"><td>Total</td><td>${ok}</td><td>${no}</td><td></td><td>${pct(ok + no ? ok / (ok + no) : null)}</td><td></td></tr>
  </tbody></table></div>
  <p class="rv-help">Precizia = etichete corecte din cele verificate. Acoperirea estimată = etichete corecte raportate la corecte plus cele adăugate manual ca lipsă. Cifrele valorează cât eșantionul: puține hükümuri verificate dau cifre nesigure.</p>`;
}

function renderFutureTool(box) {
  if (!needVolume(box)) return;
  const sampleCount = rvState.sample ? rvState.sample.size : 0;
  box.innerHTML = `
    <h4 class="rv-sub">1. Eșantion de verificare</h4>
    <p class="rv-help">Extrage la întâmplare câteva hükümuri din corpus, verifică-le de mână, iar aplicația măsoară cât de bune sunt etichetele automate.</p>
    <div class="rv-controls">
      <label>Mărime eșantion <input type="number" id="rv-sample-size" min="5" max="200" value="${sampleCount || 20}"></label>
      <button type="button" class="rv-btn" id="rv-sample-draw">Extrage un eșantion aleator</button>
      ${rvState.sample ? '<button type="button" class="rv-btn" id="rv-sample-drop">Renunță la eșantion</button>' : ''}
    </div>
    <div id="rv-sample-area"></div>
    <h4 class="rv-sub">Acuratețe măsurată</h4>
    <div id="rv-accuracy">${accuracyTableHtml()}</div>
    <h4 class="rv-sub">Restul planului</h4>
    <ul class="rv-roadmap">
      <li><b>Mai multe volume.</b> Poți încărca mai multe PDF-uri deodată, iar fila Comparație le pune alături. Până acum a fost testat doar volumul 3.</li>
      <li><b>Registru de nume și excluderi.</b> Funcțional, vezi actualizarea 03.</li>
      <li><b>Straturi de hartă pentru mai multe perioade.</b> Parțial: există două hărți (1483 și 1686).</li>
      <li><b>Teste automate.</b> Parțial: testele rulează pe motor și pe logica de verificare; lipsesc încă teste pe fragmente din alte volume.</li>
    </ul>`;
  const area = box.querySelector('#rv-sample-area');
  const drawSample = () => {
    if (!rvState.sample) { area.innerHTML = ''; return; }
    renderReviewTool(area, true);
    area.addEventListener('click', () => { box.querySelector('#rv-accuracy').innerHTML = accuracyTableHtml(); });
    area.addEventListener('change', () => { box.querySelector('#rv-accuracy').innerHTML = accuracyTableHtml(); });
  };
  box.querySelector('#rv-sample-draw').addEventListener('click', () => {
    const size = Math.min(200, Math.max(5, parseInt(box.querySelector('#rv-sample-size').value, 10) || 20));
    const pool = reviewSource().map(entryKey);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    rvState.sample = new Set(pool.slice(0, size));
    rvState.label = ''; rvState.partialOnly = false; rvState.unreviewedOnly = false; rvState.q = ''; rvState.limit = 30;
    renderFutureTool(box);
  });
  const drop = box.querySelector('#rv-sample-drop');
  if (drop) drop.addEventListener('click', () => { rvState.sample = null; renderFutureTool(box); });
  drawSample();
}

// ---------------------------------------------------------------------
// Effect of the updates, shown on the main page
// ---------------------------------------------------------------------

function naiveLabels(e) {
  if (!e.naive) e.naive = classifyNaive(textFor(e));
  return e.naive;
}

function placeCounts(label, type) {
  const kind = type === 'region' ? 'regions' : 'fortresses';
  const all = allEntries();
  return {
    simple: all.filter(e => naiveLabels(e)[kind].includes(label)).length,
    engine: all.filter(e => e.auto && e.auto[kind].includes(label)).length,
    final: all.filter(e => e[kind].includes(label)).length,
  };
}

function corpusCounts() {
  const all = allEntries();
  return {
    simple: all.filter(e => { const n = naiveLabels(e); return n.regions.length || n.fortresses.length; }).length,
    engine: all.filter(e => e.auto && (e.auto.regions.length || e.auto.fortresses.length)).length,
    final: all.filter(e => e.regions.length || e.fortresses.length).length,
  };
}

function deltaHtml(from, to) {
  const d = to - from;
  if (d === 0) return '<span class="fx-delta same">fără schimbare</span>';
  return `<span class="fx-delta ${d < 0 ? 'down' : 'up'}">${d > 0 ? '+' : '−'}${Math.abs(d)} față de căutarea simplă</span>`;
}

function effectLine(label) {
  const c = placeCounts(label, REGION_TERMS[label] ? 'region' : 'fortress');
  return `<p class="rv-effect-line">În tot volumul încărcat: căutare simplă <b>${c.simple}</b> → cu dovezi și registru <b>${c.engine}</b> → după corecții <b>${c.final}</b></p>`;
}

function reviewBadge(e) {
  const a = review.annotations[entryKey(e)];
  const parts = [];
  if (a) {
    let ok = 0, no = 0;
    Object.values(a.verdicts).forEach(v => { if (v === 'ok') ok++; else no++; });
    const added = a.added.regions.length + a.added.fortresses.length + a.added.themes.length;
    if (ok) parts.push(`<span class="rv-verdict ok">${ok} confirmat</span>`);
    if (no) parts.push(`<span class="rv-verdict no">${no} respins</span>`);
    if (added) parts.push(`<span class="rv-tag whole">${added} adăugat</span>`);
  }
  const unreviewedPartial = evidenceFor(e).some(ev => (ev.kind === 'regions' || ev.kind === 'fortresses') && !ev.wholeWord && !(a && a.verdicts[labelId(ev.kind, ev.label)]));
  if (unreviewedPartial) parts.push('<span class="rv-tag partial">de verificat</span>');
  return parts.join(' ') || '<span class="rv-meta">—</span>';
}

function openTool(key, label) {
  if (label !== undefined) {
    rvState.label = label; rvState.limit = 30; rvState.partialOnly = false;
    rvState.unreviewedOnly = false; rvState.q = ''; rvState.sample = null;
  }
  document.querySelector('nav.tabs button[data-tab="actualizari"]').click();
  showUpdate(key);
  document.getElementById('update-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function lastActionHtml() {
  if (!lastAction) return '';
  const e = ridMap.get(lastAction.rid);
  const what = lastAction.verdict === 'ok' ? 'confirmat' : lastAction.verdict === 'no' ? 'respins' : 'verdict șters';
  return `<p class="fx-last" role="status">Ultima verificare: <b>${esc(labelOfId(lastAction.id))}</b> ${what}${e ? ' la hükümul #' + esc(e.num) : ''}.
    <button type="button" class="fx-link" data-fx-undo>Anulează</button></p>`;
}

function renderEffects() {
  const box = document.getElementById('effects');
  if (!box) return;
  if (!hasVolume()) {
    box.innerHTML = `<div class="fx-head"><h2>Efectul actualizărilor asupra mențiunilor</h2></div>
      <p class="fx-empty">Încarcă un volum PDF și vezi aici, pentru fiecare regiune și cetate, cum se schimbă numărul de mențiuni între căutarea simplă din prima versiune, motorul actual și corecțiile tale.</p>`;
    return;
  }
  const rows = NAME_REGISTRY.map(p => ({ p, c: placeCounts(p.label, p.type) }))
    .filter(r => !(r.p.label === 'Yedikule' && !r.c.simple && !r.c.engine && !r.c.final));
  const max = Math.max(1, ...rows.map(r => r.c.simple));
  const total = corpusCounts();
  let partial = 0, items = 0;
  allEntries().forEach(e => { if (!(e.auto && (e.auto.regions.length || e.auto.fortresses.length))) return;
    evidenceFor(e).forEach(ev => { if (ev.kind === 'themes') return; items++; if (!ev.wholeWord) partial++; }); });
  const t = reviewTotals();
  const bar = (n, cls) => `<span class="fx-bar ${cls}" style="width:${Math.round(100 * n / max)}%"></span>`;
  box.innerHTML = `
    <div class="fx-head">
      <h2>Efectul actualizărilor asupra mențiunilor</h2>
      <span class="fx-version">motor ${esc(ENGINE_VERSION)}</span>
    </div>
    <p class="fx-lead">Aceleași hükümuri, numărate în trei moduri: <b>căutarea simplă</b> din prima versiune (fragment de cuvânt, fără excluderi), <b>motorul actual</b> (cuvânt întreg pentru nume scurte, dovezi, registru de nume) și <b>după corecțiile tale</b>.</p>
    <div class="fx-table-wrap"><table class="fx-table">
      <thead><tr><th>Loc</th><th>Căutare simplă</th><th>Motor actual</th><th>După corecții</th><th>Efect</th><th></th></tr></thead>
      <tbody>
        ${rows.map(({ p, c }) => `<tr>
          <th scope="row">${esc(p.label)}</th>
          <td><span class="fx-num">${c.simple}</span>${bar(c.simple, 'simple')}</td>
          <td><span class="fx-num">${c.engine}</span>${bar(c.engine, 'engine')}</td>
          <td><span class="fx-num">${c.final}</span>${bar(c.final, 'final')}</td>
          <td>${deltaHtml(c.simple, c.final)}</td>
          <td><button type="button" class="fx-link" data-fx-open="${escAttr(labelId(p.type === 'region' ? 'regions' : 'fortresses', p.label))}">Dovezi</button></td>
        </tr>`).join('')}
        <tr class="fx-total">
          <th scope="row">Hükümuri în corpus</th>
          <td><span class="fx-num">${total.simple}</span></td><td><span class="fx-num">${total.engine}</span></td><td><span class="fx-num">${total.final}</span></td>
          <td>${deltaHtml(total.simple, total.final)}</td><td></td>
        </tr>
      </tbody></table></div>
    <p class="fx-foot">
      <span><b>${items ? Math.round(100 * partial / items) : 0}%</b> din potrivirile de regiuni și cetăți sunt parțiale (de verificat)</span>
      <span><b>${t.ok}</b> confirmate · <b>${t.no}</b> respinse · <b>${t.added}</b> adăugate</span>
      <span><b>${review.colleagues.length}</b> fișiere de la colegi</span>
      <button type="button" class="fx-link" data-fx-tool="annotation">Verifică hükümuri</button>
      <button type="button" class="fx-link" data-fx-tool="future">Eșantion și acuratețe</button>
      <button type="button" class="fx-link" data-fx-tool="names">Registru de nume</button>
    </p>
    ${lastActionHtml()}`;
}

document.addEventListener('click', ev => {
  const open = ev.target.closest('[data-fx-open]');
  if (open) { openTool('evidence', open.dataset.fxOpen); return; }
  const tool = ev.target.closest('[data-fx-tool]');
  if (tool) { openTool(tool.dataset.fxTool); return; }
  if (ev.target.closest('[data-fx-undo]') && lastAction) {
    setVerdictExact(lastAction.key, lastAction.id, lastAction.prev);
    lastAction = null;
    commitReview(false);
  }
});

// ---------------------------------------------------------------------
// The Actualizări tab
// ---------------------------------------------------------------------

const UPDATES = {
  evidence: {
    title: 'Dovezi pentru clasificarea automată',
    status: 'Funcțional în aplicație',
    problem: 'Aplicația spune că un hüküm menționează o cetate sau aparține unei teme, dar nu arată de ce. Clasificarea se face prin căutarea unor cuvinte-cheie, iar un cuvânt scurt poate apărea în alte cuvinte.',
    solution: 'Pentru fiecare atribuire, aplicația păstrează termenul găsit și fragmentul din text în care apare, îl evidențiază și arată dacă potrivirea a fost pe cuvânt întreg sau parțială. Dovezile apar și în fișele de pe hartă și din fila Documente.',
    effect: 'Cercetătorul poate verifica o atribuire în câteva secunde, iar potrivirile greșite ies la iveală înainte să ajungă în cifre.',
    example: '<strong>Exemplu din volumul 3.</strong> Numărul hükümurilor despre Kili a coborât de la 88 la 7 după ce am observat, tocmai cu aceste fragmente, că „kili” era găsit în <em>kilise</em> (biserică), <em>Kırkkilise</em> (oraș din Tracia), <em>Kilis</em> și chiar în <em>kılıç</em> (sabie). Din același motiv, corpusul real a scăzut de la 258 la 185 de hükümuri.',
    tool: box => renderReviewTool(box, false),
  },
  annotation: {
    title: 'Adnotare și corectare istorică',
    status: 'Funcțional în aplicație',
    problem: 'Extragerea automată este euristică și nu a fost validată filologic. O eroare descoperită azi se corectează doar în codul aplicației, nu de către cercetător.',
    solution: 'Pentru fiecare hüküm, cercetătorul confirmă sau respinge etichetele găsite automat, poate adăuga una lipsă și poate scrie o notă. Corecțiile se păstrează în acest browser, se pot exporta, iar toate cifrele, hărțile și graficele se recalculează din datele corectate.',
    effect: 'Cifrele publicate pornesc de la atribuiri verificate de om, iar diferența dintre extragerea automată și versiunea corectată poate fi raportată ca măsură a acurateței.',
    tool: box => renderReviewTool(box, true),
  },
  names: {
    title: 'Registru de nume istorice',
    status: 'Funcțional în aplicație',
    problem: 'Același loc apare sub mai multe nume și grafii, iar unele nume se confundă cu alte cuvinte. Listele de termeni erau scrise direct în cod.',
    solution: 'Un registru citit de motor, cu variantele fiecărui loc, limba și perioada fiecărei forme și regulile de excludere pentru omonime. Cercetătorul poate adăuga variante noi, care se caută imediat în volum.',
    effect: 'Căutările găsesc un loc indiferent de numele sub care apare, iar nume noi se adaugă fără modificarea codului.',
    tool: box => renderRegistryTool(box),
  },
  collaboration: {
    title: 'Verificare colaborativă',
    status: 'Funcțional în aplicație',
    problem: 'Site-ul este static și rulează doar în browser, deci nu are server în care mai mulți cercetători să-și păstreze corecțiile. Verificarea rămânea munca unei singure persoane.',
    solution: 'Fiecare cercetător își exportă corecțiile într-un fișier. Aici se pot încărca fișierele colegilor, iar aplicația arată unde verdictele diferă și permite adoptarea verdictului unui coleg.',
    effect: 'Verificarea poate fi împărțită pe volume, iar dezacordurile dintre cercetători devin vizibile și se pot discuta, în loc să rămână ascunse în cifre.',
    tool: box => renderCollaborationTool(box),
  },
  history: {
    title: 'Istoricul modificărilor',
    status: 'Funcțional în aplicație',
    problem: 'Cifrele din aplicație se schimbă când se corectează motorul (de exemplu 258 devine 185), iar cine citează un rezultat trebuie să știe cu ce versiune a fost obținut.',
    solution: 'Aplicația arată versiunea motorului, o înscrie în orice export, afișează schimbările care au modificat rezultatele și cronologia completă. Istoricul tehnic este public, cu data fiecărei modificări, în depozitul proiectului.',
    effect: 'Un rezultat citat poate fi reprodus și comparat cu versiunile următoare.',
    tool: box => renderHistoryTool(box),
  },
  future: {
    title: 'Dezvoltarea viitoare',
    status: 'Parțial funcțional',
    problem: 'Testele de până acum au folosit un singur volum (volumul 3). Nu știm cât de bine se potrivesc regulile pe celelalte volume sau pe alte perioade.',
    solution: 'Primul pas este funcțional: un eșantion aleator de hükümuri pe care le verifici de mână, iar aplicația calculează precizia pentru fiecare etichetă. Celelalte etape (mai multe volume, straturi de hartă pentru alte perioade, mai multe teste) sunt listate cu starea lor.',
    effect: 'Concluziile despre Eflak, Boğdan și Erdel pot fi susținute cu o acuratețe măsurată, nu doar cu cifre brute.',
    tool: box => renderFutureTool(box),
  },
};

function showUpdate(key) {
  const u = UPDATES[key];
  if (!u) return;
  document.querySelectorAll('.update-button').forEach(b => {
    const on = b.dataset.update === key;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('active', on);
  });
  document.getElementById('update-detail').innerHTML = `<h3>${u.title}</h3><span class="update-status">${u.status}</span>
    <details class="update-about"><summary>Problemă, soluție și efect</summary>
      <div class="update-grid">
        <div><h4>Problema identificată</h4><p>${u.problem}</p></div>
        <div><h4>Soluția</h4><p>${u.solution}</p></div>
        <div><h4>Efect asupra cercetării</h4><p>${u.effect}</p></div>
      </div>
      ${u.example ? `<div class="update-example">${u.example}</div>` : ''}
    </details>
    <div id="update-tool" class="update-tool"></div>`;
  const box = document.getElementById('update-tool');
  u.tool(box);
}

document.querySelectorAll('.update-button').forEach(b => b.addEventListener('click', () => showUpdate(b.dataset.update)));

// Corrections saved in an earlier visit apply as soon as a volume is loaded
// (the upload handler calls applyReview); nothing to do before then.

renderEffects();
