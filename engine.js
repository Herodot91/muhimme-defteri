// Ottoman-Turkish text engine — JS port of the Python muhimme_app.py engine.
// Same regex-based flexible matching + hüküm parsing, running client-side.

const TR_VARIANTS = {
  a: '[aàâ]', e: '[eê]', i: '[iıİI]', o: '[oö]',
  u: '[uü]', g: '[gğ]', s: '[sş]', c: '[cç]'
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

const REGION_TERMS = {
  "Eflak (Țara Românească)": ["eflak"],
  "Boğdan (Moldova)": ["bogdan"],
  "Erdel (Ardeal / Transilvania)": ["erdel"],
};

const FORTRESS_TERMS = {
  "Kili (Chilia)": ["kili"],
  "Akkerman (Cetatea Albă)": ["akkerman"],
  "Yedikule": ["yedikule"],
  "Bender (Tighina)": ["bender"],
  "Hotin (Khotyn)": ["hotin"],
  "Silistre": ["silistre"],
};

const THEME_TERMS = {
  "Comerț": ["ticaret", "gumruk", "bac", "kervan", "tuccar", "bezirgan", "koyun", "davar"],
  "Administrație": ["nizam", "tahrir", "tevzi", "kadi", "sancak", "iskan", "reaya", "tayin", "azl", "voyvoda"],
  "Militar / Securitate": ["asker", "ceng", "cenk", "harb", "sefer", "kale", "muhafaza", "lesker", "yenicer", "dusman"],
  "Diplomație": ["elci", "ahidname", "sulh", "musalaha", "mektub"],
};

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
    const regions = Object.entries(REGION_TERMS).filter(([, vs]) => vs.some(v => findFlexible(v, textAll))).map(([n]) => n);
    const fortresses = Object.entries(FORTRESS_TERMS).filter(([, vs]) => vs.some(v => findFlexible(v, textAll))).map(([n]) => n);
    const themes = Object.entries(THEME_TERMS).filter(([, vs]) => vs.some(v => findFlexible(v, textAll))).map(([n]) => n);

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
