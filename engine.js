// Ottoman-Turkish text engine — JS port of the Python muhimme_app.py engine.
// Same regex-based flexible matching + hüküm parsing, running client-side.

// Long vowels (â, î, û) are used constantly in this scholarly Ottoman
// transliteration (İA/TDV convention) to mark Arabic/Persian vowel length —
// â was already covered, but î and û were missing, silently failing to
// match any term containing a long i or u (e.g. "teşîr" never matched a
// plain "teshir" search until this was added).
const TR_VARIANTS = {
  a: '[aàâ]', e: '[eê]', i: '[iıİIî]', o: '[oö]',
  u: '[uüû]', g: '[gğ]', s: '[sş]', c: '[cç]'
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function flexiblePattern(term) {
  return term.toLowerCase().split('').map(ch => TR_VARIANTS[ch] || escapeRegex(ch)).join('\\s*');
}

function findFlexible(term, text) {
  return new RegExp(flexiblePattern(term), 'i').test(text);
}

// Short names that collide with ordinary words under flexible matching: "kili"
// also matched kilise (church), Kırkkilise (a Thrace town), Kilis (a town near
// Aleppo) and, because ı/i are interchangeable, kılıç (sword) and kılınup.
// These terms must be a whole word and use a strict dotted i.
const WHOLE_WORD_TERMS = new Set(['kili']);

function termRegex(term) {
  if (!WHOLE_WORD_TERMS.has(term)) return new RegExp(flexiblePattern(term), 'i');
  const body = term.split('').map(ch => ch === 'i' ? '[iîİ]' : escapeRegex(ch)).join('');
  return new RegExp('(?<![\\p{L}])' + body + '(?![\\p{L}])', 'iu');
}

function matchesTerm(term, text) {
  return termRegex(term).test(text);
}

// First whole-word occurrence if there is one, otherwise the first occurrence.
function findTermMatch(term, text) {
  const re = termRegex(term);
  const all = new RegExp(re.source, re.flags + 'g');
  let first = null;
  for (const m of text.matchAll(all)) {
    const hit = { index: m.index, text: m[0] };
    if (isWholeWord(text, hit.index, hit.text.length)) return hit;
    if (!first) first = hit;
  }
  return first;
}

// True when the match is not glued to other letters (an inflected form such as
// "Eflâk'e" still counts, because the apostrophe is not a letter).
function isWholeWord(text, index, length) {
  const before = text.slice(Math.max(0, index - 1), index);
  const after = text.slice(index + length, index + length + 1);
  const letter = /\p{L}/u;
  return !(before && letter.test(before)) && !(after && letter.test(after));
}

const ENGINE_VERSION = '2026-11-02';

// Register of historical names. `terms` are what the engine searches for;
// `names` document the other forms of the same place; `exclude` records which
// look-alike words must not match.
const NAME_REGISTRY = [
  { label: "Eflak (Țara Românească)", type: "region", terms: ["eflak"],
    names: [
      { form: "Eflâk", lang: "otomană", period: "" },
      { form: "Țara Românească", lang: "română", period: "" },
      { form: "Valachia", lang: "latină", period: "" },
      { form: "Wallachia", lang: "engleză", period: "" },
    ], exclude: "" },
  { label: "Boğdan (Moldova)", type: "region", terms: ["bogdan"],
    names: [
      { form: "Boğdan", lang: "otomană", period: "" },
      { form: "Moldova", lang: "română", period: "" },
      { form: "Moldavia", lang: "latină", period: "" },
    ], exclude: "" },
  { label: "Erdel (Ardeal / Transilvania)", type: "region", terms: ["erdel"],
    names: [
      { form: "Erdel", lang: "otomană", period: "" },
      { form: "Ardeal", lang: "română", period: "" },
      { form: "Transilvania", lang: "latină", period: "" },
      { form: "Siebenbürgen", lang: "germană", period: "" },
    ], exclude: "" },
  { label: "Kili (Chilia)", type: "fortress", terms: ["kili"],
    names: [
      { form: "Kili", lang: "otomană", period: "" },
      { form: "Chilia / Chilia Nouă", lang: "română", period: "" },
      { form: "Kilia", lang: "latină", period: "" },
      { form: "Licostomo", lang: "italiană", period: "evul mediu" },
    ], exclude: "Doar cuvânt întreg, cu i punctat: exclude kilise, Kırkkilise, Kilis, kılıç." },
  { label: "Akkerman (Cetatea Albă)", type: "fortress", terms: ["akkerman", "akkirman"],
    names: [
      { form: "Akkerman", lang: "otomană", period: "" },
      { form: "Akkirman", lang: "otomană (variantă din text)", period: "" },
      { form: "Cetatea Albă", lang: "română", period: "" },
      { form: "Bielogrod", lang: "slavă (pe harta din 1686)", period: "sec. XVII" },
      { form: "Moncastro", lang: "italiană", period: "evul mediu" },
    ], exclude: "" },
  { label: "Yedikule", type: "fortress", terms: ["yedikule"],
    names: [{ form: "Yedikule", lang: "otomană", period: "" }],
    exclude: "Fortăreață din Istanbul; nu apare pe hărțile din aplicație." },
  { label: "Bender (Tighina)", type: "fortress", terms: ["bender"],
    names: [
      { form: "Bender", lang: "otomană", period: "" },
      { form: "Tighina", lang: "română", period: "" },
      { form: "Bendery", lang: "rusă", period: "" },
    ], exclude: "" },
  { label: "Hotin (Khotyn)", type: "fortress", terms: ["hotin"],
    names: [
      { form: "Hotin", lang: "otomană / română", period: "" },
      { form: "Khotyn", lang: "ucraineană", period: "" },
      { form: "Chocim", lang: "poloneză", period: "" },
    ], exclude: "" },
  { label: "Silistre", type: "fortress", terms: ["silistre"],
    names: [
      { form: "Silistre", lang: "otomană", period: "" },
      { form: "Silistra", lang: "română / bulgară", period: "" },
      { form: "Dârstor", lang: "română (medievală)", period: "evul mediu" },
    ], exclude: "" },
];

function termsByType(type) {
  return Object.fromEntries(NAME_REGISTRY.filter(p => p.type === type).map(p => [p.label, p.terms]));
}

const REGION_TERMS = termsByType('region');
const FORTRESS_TERMS = termsByType('fortress');

const THEME_TERMS = {
  "Comerț": ["ticaret", "gumruk", "bac", "kervan", "tuccar", "bezirgan", "koyun", "davar"],
  "Administrație": ["nizam", "tahrir", "tevzi", "kadi", "sancak", "iskan", "reaya", "tayin", "azl", "voyvoda"],
  "Militar / Securitate": ["asker", "ceng", "cenk", "harb", "sefer", "kale", "muhafaza", "lesker", "yenicer", "dusman"],
  "Diplomație": ["elci", "ahidname", "sulh", "musalaha", "mektub"],
  // Conquest/incorporation of new territory (feth, teshir, istila) together
  // with the conciliatory istimalet policy toward the newly annexed
  // population (istimalet) — kept as one combined theme since the two are
  // historically linked in these orders. Two terms were tried and dropped
  // as too generic for this corpus: "ilhak" mostly means "appended/added
  // [amount]" here (matched a mosque's water-supply accounting), and
  // "himaye" mostly appears in "don't harbor/shelter the rebel" orders
  // (chasing Şehzade Bayezid), a different sense of "protection" than
  // istimalet toward a newly conquered population.
  "Anexare / Istimalet": ["feth", "teshir", "istila", "istimalet"],
};

// Classifies a text and records the evidence for each label: the term that
// matched, where, and whether it is a whole word. `extraTerms` maps a label to
// additional search variants (already normalised with normalizeVariant).
function classifyText(text, extraTerms) {
  const extra = extraTerms || {};
  const evidence = [];
  const pick = (kind, table) => Object.entries(table).filter(([label, terms]) => {
    for (const term of terms.concat(extra[label] || [])) {
      const m = findTermMatch(term, text);
      if (m) {
        evidence.push({ kind, label, term, index: m.index, match: m.text, wholeWord: isWholeWord(text, m.index, m.text.length) });
        return true;
      }
    }
    return false;
  }).map(([label]) => label);
  return {
    regions: pick('regions', REGION_TERMS),
    fortresses: pick('fortresses', FORTRESS_TERMS),
    themes: pick('themes', THEME_TERMS),
    evidence,
  };
}

const PERIOD_RE = /(\d{3,4})\s*[–\-]\s*(\d{3,4})\s*\/\s*(\d{4})\s*[–\-]\s*(\d{4})/;

const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

function detectPeriod(pages) {
  const front = pages.slice(0, 6).join('\n');
  const m = PERIOD_RE.exec(front);
  if (!m) return null;
  const gregStart = parseInt(m[3], 10);
  const gregEnd = parseInt(m[4], 10);
  const century = Math.floor((gregStart - 1) / 100) + 1;
  return {
    hijriStart: parseInt(m[1], 10),
    hijriEnd: parseInt(m[2], 10),
    gregStart, gregEnd, century,
    centuryRoman: (century > 0 && century < ROMAN_NUMERALS.length) ? ROMAN_NUMERALS[century] : String(century),
  };
}

const ENTRY_START_RE = /(?:^|\s)(\d{1,4})\s+([A-ZÇĞİÖŞÜ][^\n:]{2,110}?):\s/g;
const BOGUS_RE = /h[üu]\s?k[üu]m\s?ki$|hükm-i/i;
const YAZILDI_RE = new RegExp(flexiblePattern('yazildi'), 'i');
const HICRI_YEAR_RE = /sene\s+(\d{3,4})/i;

function parseEntries(pages, volumeLabel) {
  const fullText = pages.join('\n');

  const startMarker = "ÖZET VE TRANSKR";
  const idxStart = fullText.indexOf(startMarker);
  let body = idxStart !== -1 ? fullText.slice(idxStart) : fullText;
  const idxMarkerPos = body.lastIndexOf("\nİNDEKS");
  if (idxMarkerPos !== -1 && idxMarkerPos > body.length * 0.5) {
    body = body.slice(0, idxMarkerPos);
  }

  const bodyClean = body.replace(/ÖZET VE TRANSKR[İI]PS[İI]YON\s*\d*/g, ' ');
  const bodyFlat = bodyClean.replace(/[ \t]+/g, ' ');

  const rawStarts = [...bodyFlat.matchAll(ENTRY_START_RE)];
  const starts = rawStarts.filter(m => !BOGUS_RE.test(m[2].trim().split(/\s+/).join(' ')));

  const pageBounds = [];
  let off = 0;
  for (let i = 0; i < pages.length; i++) {
    pageBounds.push([off, i + 1]);
    off += pages[i].length + 1;
  }

  function pageFor(flatOffset) {
    const approx = Math.floor(flatOffset * fullText.length / Math.max(1, bodyFlat.length));
    let best = 1;
    for (const [startOff, pnum] of pageBounds) {
      if (startOff <= approx) best = pnum;
      else break;
    }
    return best;
  }

  const entries = [];
  for (let i = 0; i < starts.length; i++) {
    const m = starts[i];
    const num = m[1];
    const recipient = m[2].trim().split(/\s+/).join(' ');
    const blockStart = m.index + m[0].length;
    const blockEnd = (i + 1 < starts.length) ? starts[i + 1].index : bodyFlat.length;
    const raw = bodyFlat.slice(blockStart, blockEnd).trim();

    const ya = YAZILDI_RE.exec(raw);
    let summary, rest;
    if (ya) {
      summary = raw.slice(0, ya.index).trim();
      rest = raw.slice(ya.index).trim();
    } else {
      summary = raw.slice(0, 300).trim();
      rest = raw;
    }

    const textAll = summary + " " + rest.slice(0, 2500);
    const { regions, fortresses, themes } = classifyText(textAll);

    entries.push({
      volume: volumeLabel,
      num, recipient, summary,
      fullText: rest.slice(0, 4000),
      page: pageFor(m.index),
      regions, fortresses, themes,
    });
  }
  return entries;
}

function attachYears(entries, period) {
  const hijriStart = period ? period.hijriStart : null;
  const gregStart = period ? period.gregStart : null;
  let lastHicri = hijriStart;
  for (const e of entries) {
    const m = HICRI_YEAR_RE.exec(e.fullText);
    if (m) lastHicri = parseInt(m[1], 10);
    e.hicriYear = lastHicri;
    if (lastHicri != null && hijriStart != null && gregStart != null) {
      e.year = gregStart + (lastHicri - hijriStart);
    } else {
      e.year = null;
    }
  }
  return entries;
}

// ---------------------------------------------------------------------
// Review logic: researcher verdicts on the automatic labels (no DOM here,
// so it can be tested on its own).
// ---------------------------------------------------------------------

const LABEL_KINDS = { r: 'regions', f: 'fortresses', t: 'themes' };

function allLabelIds() {
  const ids = new Set();
  [['r', REGION_TERMS], ['f', FORTRESS_TERMS], ['t', THEME_TERMS]].forEach(([p, table]) => {
    Object.keys(table).forEach(label => ids.add(p + ':' + label));
  });
  return ids;
}

// Automatic labels, minus the ones the researcher rejected, plus the ones added.
function effectiveLabels(auto, ann) {
  const verdicts = (ann && ann.verdicts) || {};
  const added = (ann && ann.added) || {};
  const out = {};
  Object.entries(LABEL_KINDS).forEach(([p, kind]) => {
    const kept = (auto[kind] || []).filter(l => verdicts[p + ':' + l] !== 'no');
    const extra = (added[kind] || []).filter(l => !kept.includes(l));
    out[kind] = kept.concat(extra);
  });
  return out;
}

// A place-name variant typed by the user: ASCII letters and spaces only.
function normalizeVariant(raw) {
  const map = { 'ş': 's', 'ğ': 'g', 'ı': 'i', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u', 'ê': 'e', 'ă': 'a', 'ș': 's', 'ț': 't' };
  const t = String(raw || '').toLowerCase().trim().replace(/[şğıüöçâîûêășț]/g, ch => map[ch]);
  return /^[a-z][a-z ]{2,39}$/.test(t) ? t.replace(/\s+/g, ' ') : null;
}

// Cleans annotations coming from outside (imported files): known labels only.
function sanitizeAnnotations(items) {
  const known = allLabelIds();
  const out = {};
  if (!items || typeof items !== 'object') return out;
  let n = 0;
  for (const [key, ann] of Object.entries(items)) {
    if (n >= 20000 || key.length > 300 || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (!ann || typeof ann !== 'object') continue;
    const verdicts = {};
    for (const [id, v] of Object.entries(ann.verdicts || {})) {
      if (known.has(id) && (v === 'ok' || v === 'no')) verdicts[id] = v;
    }
    const added = { regions: [], fortresses: [], themes: [] };
    for (const [p, kind] of Object.entries(LABEL_KINDS)) {
      const list = ann.added && Array.isArray(ann.added[kind]) ? ann.added[kind] : [];
      for (const l of list) {
        if (typeof l === 'string' && known.has(p + ':' + l) && !added[kind].includes(l)) added[kind].push(l);
      }
    }
    const note = typeof ann.note === 'string' ? ann.note.slice(0, 500) : '';
    if (Object.keys(verdicts).length || added.regions.length || added.fortresses.length || added.themes.length || note) {
      out[key] = { verdicts, added, note };
      n++;
    }
  }
  return out;
}

// "r:Label" -> 'ok' | 'no' | 'add'
function verdictMap(ann) {
  const m = {};
  Object.entries((ann && ann.verdicts) || {}).forEach(([id, v]) => { m[id] = v; });
  Object.entries(LABEL_KINDS).forEach(([p, kind]) => {
    ((ann && ann.added && ann.added[kind]) || []).forEach(l => { m[p + ':' + l] = 'add'; });
  });
  return m;
}

// sets: [{ name, items }]. Returns how many labels were judged by at least two
// people, how many of those agree, and the disagreements (verdicts aligned with sets).
function compareAnnotators(sets) {
  const byItem = new Map();
  sets.forEach((set, i) => {
    Object.entries(set.items || {}).forEach(([key, ann]) => {
      Object.entries(verdictMap(ann)).forEach(([id, v]) => {
        const k = key + '||' + id;
        if (!byItem.has(k)) byItem.set(k, { key, id, verdicts: sets.map(() => null) });
        byItem.get(k).verdicts[i] = v;
      });
    });
  });
  let judged = 0, agree = 0;
  const disagreements = [];
  byItem.forEach(item => {
    const vs = item.verdicts.filter(v => v);
    if (vs.length < 2) return;
    judged++;
    const yes = vs.filter(v => v !== 'no').length;
    if (yes === 0 || yes === vs.length) agree++;
    else disagreements.push(item);
  });
  return { judged, agree, disagreements };
}

// Per label: confirmed, rejected and added counts, with precision and a recall estimate.
function accuracyByLabel(items) {
  const rows = new Map();
  const row = id => { if (!rows.has(id)) rows.set(id, { id, ok: 0, no: 0, added: 0 }); return rows.get(id); };
  Object.values(items || {}).forEach(ann => {
    Object.entries(verdictMap(ann)).forEach(([id, v]) => {
      const r = row(id);
      if (v === 'ok') r.ok++; else if (v === 'no') r.no++; else r.added++;
    });
  });
  return [...rows.values()].map(r => ({
    ...r,
    precision: r.ok + r.no ? r.ok / (r.ok + r.no) : null,
    recall: r.ok + r.added ? r.ok / (r.ok + r.added) : null,
  })).sort((a, b) => a.id.localeCompare(b.id));
}
