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
const WHOLE_WORD_TERMS = new Set(['kili', 'bender']);

// "bender" is also the Persian word for a port (Basra benderine, Katîf benderi,
// Bender-i Şihr, Bender-i Kili), so the fortress Bender (Tighina) must be a
// capitalised whole word that is not followed by the izafet "-i".
function termRegex(term) {
  if (term === 'bender') return /(?<![\p{L}])Bender(?![\p{L}])(?!\s*[-‑]\s*[iıî](?![\p{L}]))/u;
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

const ENGINE_VERSION = '2026-11-04';

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

// The first version's search: the first term of each place, matched as a
// fragment of a word with no exclusions. Kept only as a baseline to show what
// the later corrections changed.
function classifyNaive(text) {
  const hit = table => Object.entries(table).filter(([, terms]) => findFlexible(terms[0], text)).map(([label]) => label);
  return { regions: hit(REGION_TERMS), fortresses: hit(FORTRESS_TERMS) };
}

const PERIOD_RE = /(\d{3,4})\s*[–\-]\s*(\d{3,4})\s*\/\s*(\d{4})\s*[–\-]\s*(\d{4})/;
// Other title-page forms: "973 / 1565–1566" and "H. 1056 / M. 1646-1647".
const PERIOD_SINGLE_RE = /(?:H\.?\s*)?(\d{3,4})\s*\/\s*(?:M\.?\s*)?(\d{4})\s*[–\-]\s*(\d{4})/;

const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

function detectPeriod(pages) {
  const front = pages.slice(0, 6).join('\n');
  let m = PERIOD_RE.exec(front);
  let hijriStart, hijriEnd, gregStart, gregEnd;
  if (m) {
    [hijriStart, hijriEnd, gregStart, gregEnd] = [m[1], m[2], m[3], m[4]].map(x => parseInt(x, 10));
  } else {
    m = PERIOD_SINGLE_RE.exec(front);
    if (!m) return null;
    hijriStart = hijriEnd = parseInt(m[1], 10);
    gregStart = parseInt(m[2], 10);
    gregEnd = parseInt(m[3], 10);
  }
  const century = Math.floor((gregStart - 1) / 100) + 1;
  return {
    hijriStart,
    hijriEnd,
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

// ---------------------------------------------------------------------
// "Özet ve İndeks" volumes: summaries only, no transliteration. Each page has
// a header ("ÖZETLER 11" or "12 5 NUMARALI MÜHİMME DEFTERİ"), then for every
// order a recipient line and a summary paragraph, with exact dates on their
// own lines and, at the bottom of the page, the numbers of the orders that
// start on it. A printed index follows ("İNDEKS").
// ---------------------------------------------------------------------

// Page headers are matched with all whitespace removed: PDF.js sometimes
// returns them letter-spaced ("Ö Z E T L E R 11").
const compactTester = re => ({ test: line => re.test(String(line).replace(/\s+/g, '')) });
const OZET_HEADER_RE = compactTester(/^ÖZETLER\d+/);
const OZET_EVEN_HEADER_RE = compactTester(/^\d+NUMARALIM[ÜU]H[İI]MMEDEFTER[İI]/i);
const INDEX_HEADER_RE = compactTester(/^İNDEKS\d+/);
// "11 Muharrem 973 (8 Ağustos 1565)", "Selh-i Muharrem 973 (27 Ağustos 1565)" or the spaced "Selh - i …".
const OZET_DATE_RE = /^\s*(.{1,40}?)\s+(\d{3,4})\s*\(\s*(\d{1,2})\s+([^\d\s()]+)\s+(\d{4})\s*\)\s*$/;
const NOT_A_SENTENCE_END_RE = /\b(?:vs|vb|bkz|bk|yy|sn|nr|Hz|Bk)\.$/;

function firstLine(page) {
  return (page.split('\n').find(l => l.trim()) || '');
}

// 'transkripsiyon' (summary + transliteration, like volume 3), 'ozet' (summary
// and index only), or 'scanned' (pages are images without a text layer).
function detectVolumeFormat(pages) {
  const chars = pages.reduce((n, p) => n + p.trim().length, 0);
  if (pages.length > 20 && chars < pages.length * 20) return 'scanned';
  if (pages.some(p => p.includes('ÖZET VE TRANSKR'))) return 'transkripsiyon';
  const headers = pages.filter(p => OZET_HEADER_RE.test(firstLine(p))).length;
  return headers >= 10 ? 'ozet' : 'transkripsiyon';
}

function parseVolume(pages, volumeLabel) {
  return detectVolumeFormat(pages) === 'ozet' ? parseSummaryVolume(pages, volumeLabel) : parseEntries(pages, volumeLabel);
}

function isUnitEnd(line) {
  const t = line.trim();
  return /[.)"”]$/.test(t) && /\.[)"”]?$/.test(t) && !NOT_A_SENTENCE_END_RE.test(t);
}

// A recipient line that can end the recipient ("…beylerbeyine", "…Bey'e",
// "…nâme-i hümâyun"); a trailing comma or "ve" means the recipient goes on.
function recipientLooksComplete(line) {
  const t = line.trim().replace(/\*+$/, '');
  if (/[,;:\-–]$/.test(t) || /\s(?:ve|ile)$/i.test(t)) return false;
  return /[aeâêAE]$/.test(t) || /(?:hümâyun|şerif|nâme|name|hüküm|mektup|arz)$/i.test(t);
}

function splitRecipient(lines) {
  const recipient = [lines[0]];
  let k = 1;
  while (k < lines.length - 1 && recipient.length < 4 && !recipientLooksComplete(recipient[recipient.length - 1])) {
    recipient.push(lines[k]);
    k++;
  }
  return { recipient: recipient.join(' ').replace(/\s+/g, ' ').replace(/\*+$/, '').trim(), summary: lines.slice(k).join(' ').replace(/\s+/g, ' ').trim() };
}

// Lines inside a unit where a new order probably starts (a capitalised line
// that reads like a recipient, after a line that ended a sentence's worth of text).
function splitCandidates(units) {
  const found = [];
  units.forEach((u, ui) => u.lines.forEach((line, li) => {
    if (li < 1) return;
    const t = line.trim();
    if (!/^[A-ZÇĞİÖŞÜÂÎÛ]/.test(t)) return;
    const prev = u.lines[li - 1].trim();
    if (/[,;:\-–]$|\s(?:ve|ile)$/.test(prev)) return;
    const single = recipientLooksComplete(t) && t.length <= 130;
    const opens = !single && t.length <= 110 && /,$|\s(?:ve|ile)$/.test(t);
    if (!single && !opens) return;
    found.push({ ui, li, score: (single ? 2000 : 1000) - t.length });
  }));
  return found.sort((a, b) => b.score - a.score);
}

// Units that probably belong to the previous one (they start in lower case, or
// are a stray fragment).
function mergeCandidates(units) {
  const found = [];
  units.forEach((u, ui) => {
    if (ui === 0) return;
    const t = u.lines[0].trim();
    let score = 0;
    if (/^[a-zçğıöşüâîû]/.test(t)) score += 1000;
    if (!recipientLooksComplete(t) && t.length > 100) score += 500;
    if (u.lines.length === 1 && !recipientLooksComplete(t)) score += 100;
    if (score) found.push({ ui, score });
  });
  return found.sort((a, b) => b.score - a.score);
}

function parseSummaryVolume(pages, volumeLabel) {
  const bodyStart = pages.findIndex(p => OZET_HEADER_RE.test(firstLine(p)));
  if (bodyStart < 0) return [];
  let bodyEnd = pages.findIndex((p, i) => i > bodyStart && INDEX_HEADER_RE.test(firstLine(p)));
  if (bodyEnd < 0) bodyEnd = pages.length;

  const entries = [];
  const stats = { pages: 0, numbered: 0, misaligned: 0 };
  let open = null;
  let date = null;
  let lastNum = 0;
  let footnote = false;

  for (let i = bodyStart; i < bodyEnd; i++) {
    const lines = pages[i].split('\n').map(l => l.replace(/\s+$/, ''));
    let from = 0;
    while (from < lines.length && !lines[from].trim()) from++;
    if (from < lines.length && (OZET_HEADER_RE.test(lines[from]) || OZET_EVEN_HEADER_RE.test(lines[from]))) from++;

    const numbers = [];
    let to = lines.length;
    while (to > from && (/^\s*\d{1,4}\s*$/.test(lines[to - 1]) || !lines[to - 1].trim())) {
      if (lines[to - 1].trim()) numbers.unshift(parseInt(lines[to - 1], 10));
      to--;
    }

    const startedHere = [];
    for (let j = from; j < to; j++) {
      const line = lines[j];
      if (!line.trim() || /^[*\s]+$/.test(line)) continue;
      if (footnote) { if (isUnitEnd(line)) footnote = false; continue; }
      if (!open && /^\s*\*\s/.test(line)) { footnote = !isUnitEnd(line); continue; }
      const dm = open ? null : OZET_DATE_RE.exec(line);
      if (dm) {
        date = { text: line.trim(), hicriDay: parseInt(dm[1], 10) || null, hicriMonth: dm[1].replace(/^\d+\s*/, ''), hicriYear: +dm[2], gregDay: +dm[3], gregMonth: dm[4], gregYear: +dm[5] };
        continue;
      }
      if (!open) {
        open = { lines: [], page: i + 1, date };
        startedHere.push(open);
        entries.push(open);
      }
      open.lines.push(line.trim());
      if (isUnitEnd(line)) open = null;
    }

    stats.pages++;
    if (numbers.length && numbers.length !== startedHere.length) {
      const before = startedHere.length;
      if (startedHere.length < numbers.length) {
        const picks = splitCandidates(startedHere).slice(0, numbers.length - startedHere.length)
          .sort((a, b) => b.ui - a.ui || b.li - a.li);
        picks.forEach(({ ui, li }) => {
          const u = startedHere[ui];
          const tail = { lines: u.lines.splice(li), page: u.page, date: u.date };
          startedHere.splice(ui + 1, 0, tail);
          entries.splice(entries.indexOf(u) + 1, 0, tail);
          if (open === u) open = tail;
        });
      } else {
        const picks = mergeCandidates(startedHere).slice(0, startedHere.length - numbers.length)
          .sort((a, b) => b.ui - a.ui);
        picks.forEach(({ ui }) => {
          const u = startedHere[ui], prev = startedHere[ui - 1];
          prev.lines.push(...u.lines);
          startedHere.splice(ui, 1);
          entries.splice(entries.indexOf(u), 1);
          if (open === u) open = prev;
        });
      }
      if (startedHere.length === numbers.length) stats.repaired = (stats.repaired || 0) + 1;
      else stats.unrepaired = (stats.unrepaired || 0) + before;
    }
    if (numbers.length === startedHere.length) {
      startedHere.forEach((u, k) => { u.num = numbers[k]; });
      stats.numbered += numbers.length;
    } else {
      stats.misaligned++;
      (stats.misalignedPages = stats.misalignedPages || []).push({ page: i + 1, numbers: numbers.length, units: startedHere.length });
      startedHere.forEach((u, k) => { u.num = numbers.length ? numbers[Math.min(k, numbers.length - 1)] + Math.max(0, k - numbers.length + 1) : lastNum + k + 1; });
    }
    if (startedHere.length) lastNum = startedHere[startedHere.length - 1].num;
  }

  const out = entries.filter(u => u.lines.length).map(u => {
    const { recipient, summary } = splitRecipient(u.lines);
    const cls = classifyText(recipient + ' ' + summary);
    return {
      volume: volumeLabel, format: 'ozet', num: String(u.num), recipient, summary, fullText: '',
      page: u.page, regions: cls.regions, fortresses: cls.fortresses, themes: cls.themes,
      year: u.date ? u.date.gregYear : null, hicriYear: u.date ? u.date.hicriYear : null,
      dateText: u.date ? u.date.text : '',
    };
  });
  out.stats = stats;
  return out;
}

// The text an entry is classified from (the same everywhere in the app).
function entryText(e) {
  if (e.format === 'ozet') return e.recipient + ' ' + e.summary;
  if (e.format === 'icindekiler') return e.summary;
  return e.summary + ' ' + e.fullText.slice(0, 2500);
}

// ---- printed index ----------------------------------------------------

function foldTurkish(s) {
  const map = { 'â': 'a', 'î': 'i', 'û': 'u', 'ê': 'e', 'ş': 's', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ü': 'u', 'ç': 'c', 'İ': 'i', 'Â': 'a', 'Î': 'i', 'Û': 'u', 'Ş': 's', 'Ğ': 'g', 'Ö': 'o', 'Ü': 'u', 'Ç': 'c', 'ª': '', '‘': '', '’': '' };
  return s.replace(/[âîûêşğıöüçİÂÎÛŞĞÖÜÇª‘’]/g, ch => map[ch]).toLowerCase();
}

// Reads the "İNDEKS" pages: each entry is "head : n1, n2; — sub : n3 …" with
// continuation lines that start with a digit, a dash or a space. Returns
// [{ head, numbers: Set }] where numbers collects every order number listed
// under the head, sub-entries included.
function parseIndexEntries(pages) {
  const start = pages.findIndex(p => INDEX_HEADER_RE.test(firstLine(p)));
  if (start < 0) return [];
  const raw = [];
  for (let i = start; i < pages.length; i++) {
    const lines = pages[i].split('\n').map(l => l.replace(/\s+$/, ''));
    let from = 0;
    while (from < lines.length && !lines[from].trim()) from++;
    if (from < lines.length && (INDEX_HEADER_RE.test(lines[from]) || OZET_EVEN_HEADER_RE.test(lines[from]))) from++;
    for (let j = from; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) continue;
      // A line continues the previous entry when it starts with a dash or a digit,
      // or when the previous line ended mid-list (comma, semicolon, dash, colon).
      const previous = raw.length ? raw[raw.length - 1] : '';
      const continuation = /^[\s—–-]/.test(line) || /^\d/.test(line.trim()) || /[,;:—–-]$/.test(previous);
      if (continuation && raw.length) raw[raw.length - 1] += ' ' + line.trim();
      else raw.push(line.trim());
    }
  }
  return raw.map(text => {
    const colon = text.indexOf(':');
    const semi = text.indexOf(';');
    const cut = [colon, semi].filter(x => x >= 0);
    const head = (cut.length ? text.slice(0, Math.min(...cut)) : text).trim();
    const numbers = new Set((text.slice(colon >= 0 ? colon : 0).match(/\b\d{1,4}\b/g) || []).map(Number));
    return { head, numbers, text };
  });
}

// Which hüküm numbers the printed index lists for a place. `names` are folded
// first words that name the place; only capitalised heads count (lower-case
// "bender" is the common word for a port).
function indexNumbersFor(indexEntries, names) {
  const nums = new Set();
  indexEntries.forEach(e => {
    const word = e.head.replace(/[(\[].*$/, '').trim().split(/[\s,]+/)[0] || '';
    if (!/^[A-ZÇĞİÖŞÜÂÎÛ]/.test(word)) return;
    if (names.includes(foldTurkish(word).replace(/[^a-z]/g, ''))) e.numbers.forEach(n => nums.add(n));
  });
  return nums;
}

// The Ottoman-form names the printed index would use for a place.
function registryIndexNames(label) {
  const p = NAME_REGISTRY.find(x => x.label === label);
  if (!p) return [];
  return [...new Set(p.names.filter(n => n.lang.startsWith('otomană'))
    .map(n => foldTurkish(n.form.split(/[\s\/]+/)[0]).replace(/[^a-z]/g, '')))];
}

// For each place: how many orders the printed index lists, and how many of them
// the engine labelled. `labelsOf` picks the labels to judge (the automatic ones
// by default). Only recall is meaningful: the index lists what the text says,
// not every order addressed to a place's governor.
function compareWithIndex(entries, indexEntries, labelsOf) {
  const get = labelsOf || (e => e);
  const byNum = new Map(entries.map(e => [parseInt(e.num, 10), e]));
  return NAME_REGISTRY.map(p => {
    const kind = p.type === 'region' ? 'regions' : 'fortresses';
    const gold = indexNumbersFor(indexEntries, registryIndexNames(p.label));
    const found = [...gold].filter(n => byNum.has(n) && get(byNum.get(n))[kind].includes(p.label));
    const missed = [...gold].filter(n => !found.includes(n)).sort((a, b) => a - b);
    return { label: p.label, gold: gold.size, found: found.length, recall: gold.size ? found.length / gold.size : null, missed };
  });
}

// ---------------------------------------------------------------------
// Scanned volumes: after OCR, the printed contents list ("İÇİNDEKİLER") has one
// entry per order: its number and a one-line summary, then dotted leaders and
// the page. OCR garbles the leaders and sometimes the numbers, so entries are
// found by their expected sequence number.
// ---------------------------------------------------------------------

const CONTENTS_START_RE = /^\s*([0-9lI|OoSBZ]{1,4})(?:\s*[-–]\s*(\d{1,4}))?\s+(?=[A-ZÇĞİÖŞÜÂÎÛ"“'‘(])/;

// Reads an OCR'd number token (l/I for 1, O for 0, S for 5 …); null if it is
// not made of digits.
function mapOcrDigits(token) {
  const map = { l: '1', I: '1', '|': '1', O: '0', o: '0', S: '5', B: '8', Z: '2' };
  const mapped = token.replace(/[lI|OoSBZ]/g, ch => map[ch]);
  return /^\d+$/.test(mapped) ? parseInt(mapped, 10) : null;
}

function cleanContentsSummary(text) {
  let t = text.replace(/\s+/g, ' ').trim();
  const leader = t.search(/(?:\.\s*){3,}/);
  let tail = '';
  if (leader >= 0) { tail = t.slice(leader); t = t.slice(0, leader); }
  else {
    // no dotted leader survived: drop trailing short garbage tokens and a page number
    const tokens = t.split(' ');
    while (tokens.length > 3 && /^(?:[A-Z]{1,6}|[a-zçğıöşü]{1,3}|\d{1,3}\)?|[^\p{L}\d]+)$/u.test(tokens[tokens.length - 1])) tail = tokens.pop() + ' ' + tail;
    t = tokens.join(' ');
  }
  const pageMatch = /(\d{1,3})\D{0,3}$/.exec(tail);
  return { summary: t.replace(/[\s.…_-]+$/, '').trim(), bookPage: pageMatch ? parseInt(pageMatch[1], 10) : null };
}

function isContentsList(pages) {
  return pages.filter(p => (p.match(/^\s*\d{1,4}\s+[A-ZÇĞİÖŞÜ]/gm) || []).length >= 8).length >= 3;
}

// Candidate lines (a number then a capital letter) are collected first. The
// longest increasing run of numbers is trusted; candidates between two trusted
// ones take the numbers in between when the counts agree (OCR misread them);
// anything else is text of the previous entry.
function parseContentsList(pages, volumeLabel) {
  const isHeader = l => /^[\s|\d]*$/.test(l) || /^\s*[IVXLT]{1,4}\.?\s*B[ÖO]L[ÜU]M/i.test(l) || /^\s*İ?ÇİNDEKİLER/i.test(l);
  const starts = p => (p.match(/^\s*\d{1,4}\s+[A-ZÇĞİÖŞÜ]/gm) || []).length;
  const first = pages.findIndex(p => starts(p) >= 8);
  if (first < 0) return [];
  let last = first;
  while (last + 1 < pages.length && starts(pages[last + 1]) > 0) last++;

  const lines = [];
  const cands = [];
  for (let i = first; i <= last; i++) {
    for (const raw of pages[i].split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = CONTENTS_START_RE.exec(line);
      const value = m ? mapOcrDigits(m[1]) : null;
      const rec = { page: i + 1, line, text: m && value !== null ? line.slice(m[0].length) : line, cand: m && value !== null, value, rangeEnd: m && m[2] ? parseInt(m[2], 10) : null };
      if (rec.cand && value >= 1 && value <= 3000) cands.push(rec); else rec.cand = false;
      lines.push(rec);
    }
  }

  // longest strictly increasing run of candidate numbers
  const n = cands.length;
  const len = new Array(n).fill(1), prev = new Array(n).fill(-1);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < a; b++) {
      if (cands[b].value < cands[a].value && len[b] + 1 > len[a]) { len[a] = len[b] + 1; prev[a] = b; }
    }
  }
  let bestEnd = 0;
  for (let a = 1; a < n; a++) if (len[a] > len[bestEnd]) bestEnd = a;
  const keep = new Set();
  for (let a = n ? bestEnd : -1; a >= 0; a = prev[a]) keep.add(a);
  const trusted = [...keep].sort((x, y) => x - y);

  // candidates that were not kept: fill the gaps between trusted neighbours
  for (let t = 0; t + 1 <= trusted.length; t++) {
    const from = trusted[t], to = t + 1 < trusted.length ? trusted[t + 1] : n;
    const between = [];
    for (let k = from + 1; k < to; k++) between.push(k);
    if (!between.length) continue;
    const gap = t + 1 < trusted.length ? cands[to].value - cands[from].value - 1 : between.length;
    if (between.length <= gap) between.forEach((k, j) => { cands[k].fixed = cands[from].value + 1 + j; });
  }

  const entries = [];
  const notes = [];
  let cur = null;
  const finish = () => {
    if (!cur) return;
    const { summary, bookPage } = cleanContentsSummary(cur.lines.join(' '));
    // numbers skipped when the volume was catalogued ("…hüküm kaydı bulunmamaktadır")
    if (cur.skip || /hüküm kayd[ıi][^.]{0,60}(?:bulunmamaktadır|mevcut değil)|bu numara sehven/i.test(summary)) { notes.push(cur.num); cur = null; return; }
    const cls = classifyText(summary);
    entries.push({
      volume: volumeLabel, format: 'icindekiler', num: String(cur.num), recipient: '', summary, fullText: '',
      page: cur.page, bookPage, regions: cls.regions, fortresses: cls.fortresses, themes: cls.themes, year: null,
    });
    cur = null;
  };
  const keptRecs = new Set([...keep].map(k => cands[k]));
  for (const rec of lines) {
    const num = rec.cand ? (keptRecs.has(rec) ? rec.value : rec.fixed) : undefined;
    if (num !== undefined) {
      finish();
      cur = { num, page: rec.page, lines: [rec.text], skip: rec.rangeEnd !== null && rec.rangeEnd > num };
    } else if (cur && !isHeader(rec.line)) {
      cur.lines.push(rec.line);
    }
  }
  finish();
  const have = new Set(entries.map(x => +x.num).concat(notes));
  const lastNum = entries.length ? Math.max(...entries.map(x => +x.num)) : 0;
  const rangeNotes = lines.filter(r => r.cand && r.rangeEnd !== null && r.rangeEnd > r.value);
  rangeNotes.forEach(r => { for (let k = r.value; k <= r.rangeEnd; k++) have.add(k); });
  const missing = [];
  for (let k = 1; k <= lastNum; k++) if (!have.has(k)) missing.push(k);
  entries.stats = { entries: entries.length, gaps: missing.length, missing, lastNum, notes };
  return entries;
}

function attachYears(entries, period) {
  const hijriStart = period ? period.hijriStart : null;
  const gregStart = period ? period.gregStart : null;
  let lastHicri = hijriStart;
  for (const e of entries) {
    if (e.year != null && e.format === 'ozet') { lastHicri = e.hicriYear != null ? e.hicriYear : lastHicri; continue; }
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
