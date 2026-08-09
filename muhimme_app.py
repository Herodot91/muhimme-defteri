import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import networkx as nx
from collections import Counter
import io
import re
import base64
from pypdf import PdfReader

# -------------------------------------------------------
# PAGE CONFIG
# -------------------------------------------------------

st.set_page_config(
    page_title="Mühimme Defterleri — Instrument de cercetare",
    page_icon="📜",
    layout="wide"
)

# -------------------------------------------------------
# TITLE
# -------------------------------------------------------

st.title("📜 Moldova, Țara Românească și Erdel în Mühimme Defterleri")
st.subheader("Instrument de cercetare istorică — metode digitale aplicate arhivelor otomane")

st.markdown(
    """
    **Rezultat final al comunicării științifice** *„Metode digitale în
    cercetarea surselor din arhivele otomane: cazul Mühimme Defterleri”*.

    Aceasta nu este o demonstrație tehnică — este un instrument gândit
    pentru folosirea directă de către istoric: transformă informațiile din
    **Mühimme Defterleri** într-un corpus structurat care permite analiza
    cronologică, geografică, tematică și relațională, cu revenire
    permanentă la textul original pentru verificare.

    ⚠️ **Fără niciun volum PDF încărcat, tot ce vezi mai jos (cele 12
    înregistrări marcate „Exemplu demonstrativ") este fictiv** și servește
    doar la ilustrarea mecanismelor aplicației (filtre, cronologie, hartă,
    rețea).

    **De îndată ce încarci un volum Mühimme Defterleri (PDF) din bara
    laterală**, toate filele de mai jos — „🏠 Corpus”, „⏳ Cronologie”,
    „🏷️ Teme”, „🗺️ Hartă”, „🕸️ Rețele”, „⚖️ Comparație”, „📄 Documente” —
    comută automat la datele reale: fiecare hüküm este extras direct din
    textul original al volumului/volumelor încărcate, nu este inventat.
    Este un singur tablou de bord, nu două — fila „📕 Volum PDF” rămâne
    doar pentru gestionarea volumelor (listă, vizualizare, căutare brută).
    Clasificarea pe teme și regiuni (Eflak / Boğdan / Erdel) este automată,
    pe bază de cuvinte-cheie și potrivire flexibilă a diacriticelor, deci
    rămâne o extragere euristică, nu o adnotare filologică validată manual
    — de aceea fiecare rezultat afișează rezumatul și textul integral,
    pentru verificare la sursă.
    """
)

st.divider()

# -------------------------------------------------------
# DEMO DATA
# -------------------------------------------------------

@st.cache_data
def load_demo_data():

    data = [
        {
            "id": "MD-001",
            "registru": "MD Demo 1",
            "an": 1552,
            "data_document": "1552-04-12",
            "principat": "Moldova",
            "localitate": "Suceava",
            "lat": 47.6514,
            "lon": 26.2556,
            "tema": "Diplomație",
            "tip_decizie": "Ordin",
            "actor_principal": "Domnul Moldovei",
            "actor_secundar": "Poarta Otomană",
            "institutie": "Divan-ı Hümayun",
            "rezumat": "Exemplu demonstrativ privind comunicarea dintre administrația centrală otomană și Moldova.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-002",
            "registru": "MD Demo 1",
            "an": 1553,
            "data_document": "1553-08-21",
            "principat": "Țara Românească",
            "localitate": "Târgoviște",
            "lat": 44.9254,
            "lon": 25.4567,
            "tema": "Fiscalitate",
            "tip_decizie": "Dispoziție",
            "actor_principal": "Domnul Țării Românești",
            "actor_secundar": "Poarta Otomană",
            "institutie": "Divan-ı Hümayun",
            "rezumat": "Exemplu demonstrativ privind o problemă fiscală.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-003",
            "registru": "MD Demo 1",
            "an": 1554,
            "data_document": "1554-02-15",
            "principat": "Moldova",
            "localitate": "Iași",
            "lat": 47.1585,
            "lon": 27.6014,
            "tema": "Securitate",
            "tip_decizie": "Avertizare",
            "actor_principal": "Domnul Moldovei",
            "actor_secundar": "Sangeacul Silistra",
            "institutie": "Administrație provincială",
            "rezumat": "Exemplu demonstrativ referitor la securitate și circulație regională.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-004",
            "registru": "MD Demo 2",
            "an": 1555,
            "data_document": "1555-06-09",
            "principat": "Țara Românească",
            "localitate": "București",
            "lat": 44.4268,
            "lon": 26.1025,
            "tema": "Administrație",
            "tip_decizie": "Ordin",
            "actor_principal": "Domnul Țării Românești",
            "actor_secundar": "Beylerbey de Rumelia",
            "institutie": "Divan-ı Hümayun",
            "rezumat": "Exemplu demonstrativ privind coordonarea administrativă.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-005",
            "registru": "MD Demo 2",
            "an": 1556,
            "data_document": "1556-09-18",
            "principat": "Moldova",
            "localitate": "Chilia",
            "lat": 45.4559,
            "lon": 29.2634,
            "tema": "Comerț",
            "tip_decizie": "Reglementare",
            "actor_principal": "Autorități locale",
            "actor_secundar": "Negustori",
            "institutie": "Administrație provincială",
            "rezumat": "Exemplu demonstrativ privind activitatea comercială în regiunea Dunării de Jos.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-006",
            "registru": "MD Demo 2",
            "an": 1557,
            "data_document": "1557-03-11",
            "principat": "Țara Românească",
            "localitate": "Giurgiu",
            "lat": 43.9037,
            "lon": 25.9699,
            "tema": "Securitate",
            "tip_decizie": "Ordin",
            "actor_principal": "Sangeacul Giurgiu",
            "actor_secundar": "Domnul Țării Românești",
            "institutie": "Administrație provincială",
            "rezumat": "Exemplu demonstrativ privind securitatea zonei dunărene.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-007",
            "registru": "MD Demo 3",
            "an": 1558,
            "data_document": "1558-07-26",
            "principat": "Moldova",
            "localitate": "Cetatea Albă",
            "lat": 46.1855,
            "lon": 30.3415,
            "tema": "Militar",
            "tip_decizie": "Mobilizare",
            "actor_principal": "Sangeacul Akkerman",
            "actor_secundar": "Poarta Otomană",
            "institutie": "Administrație militară",
            "rezumat": "Exemplu demonstrativ privind măsuri cu caracter militar.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-008",
            "registru": "MD Demo 3",
            "an": 1559,
            "data_document": "1559-01-14",
            "principat": "Țara Românească",
            "localitate": "Târgoviște",
            "lat": 44.9254,
            "lon": 25.4567,
            "tema": "Diplomație",
            "tip_decizie": "Instrucțiune",
            "actor_principal": "Domnul Țării Românești",
            "actor_secundar": "Poarta Otomană",
            "institutie": "Divan-ı Hümayun",
            "rezumat": "Exemplu demonstrativ privind relațiile politico-diplomatice.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-009",
            "registru": "MD Demo 3",
            "an": 1560,
            "data_document": "1560-05-03",
            "principat": "Moldova",
            "localitate": "Iași",
            "lat": 47.1585,
            "lon": 27.6014,
            "tema": "Fiscalitate",
            "tip_decizie": "Solicitare",
            "actor_principal": "Domnul Moldovei",
            "actor_secundar": "Poarta Otomană",
            "institutie": "Divan-ı Hümayun",
            "rezumat": "Exemplu demonstrativ privind obligațiile fiscale.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-010",
            "registru": "MD Demo 3",
            "an": 1561,
            "data_document": "1561-11-23",
            "principat": "Țara Românească",
            "localitate": "București",
            "lat": 44.4268,
            "lon": 26.1025,
            "tema": "Comerț",
            "tip_decizie": "Reglementare",
            "actor_principal": "Negustori",
            "actor_secundar": "Domnul Țării Românești",
            "institutie": "Administrație locală",
            "rezumat": "Exemplu demonstrativ privind reglementarea unor activități comerciale.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-011",
            "registru": "MD Demo 4",
            "an": 1562,
            "data_document": "1562-03-04",
            "principat": "Moldova",
            "localitate": "Suceava",
            "lat": 47.6514,
            "lon": 26.2556,
            "tema": "Administrație",
            "tip_decizie": "Instrucțiune",
            "actor_principal": "Domnul Moldovei",
            "actor_secundar": "Autorități locale",
            "institutie": "Divan-ı Hümayun",
            "rezumat": "Exemplu demonstrativ privind administrația teritorială.",
            "referinta": "Exemplu demonstrativ"
        },
        {
            "id": "MD-012",
            "registru": "MD Demo 4",
            "an": 1563,
            "data_document": "1563-10-17",
            "principat": "Țara Românească",
            "localitate": "Giurgiu",
            "lat": 43.9037,
            "lon": 25.9699,
            "tema": "Militar",
            "tip_decizie": "Ordin",
            "actor_principal": "Sangeacul Giurgiu",
            "actor_secundar": "Poarta Otomană",
            "institutie": "Administrație militară",
            "rezumat": "Exemplu demonstrativ privind probleme militare în regiunea Dunării.",
            "referinta": "Exemplu demonstrativ"
        }
    ]

    df = pd.DataFrame(data)
    df["data_document"] = pd.to_datetime(df["data_document"], format='%Y-%m-%d')

    return df


demo_df = load_demo_data()

# -------------------------------------------------------
# PDF SOURCE VOLUME
# -------------------------------------------------------

@st.cache_data(show_spinner="Se extrage textul din PDF...")
def extract_pdf_pages(file_bytes):
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        pages.append(text)
    return pages

# ---------------------------------------------------------------------
# Ottoman-Turkish text engine.
#
# These published transcriptions (Devlet Arşivleri Mühimme Defterleri
# series) insert stray spaces around Turkish diacritics when their text
# layer is extracted (e.g. "Boğdan" -> "Bo ğdan"). TR_VARIANTS lets every
# search below tolerate that, plus common spelling variants (â/a, ı/i…),
# so region/theme detection isn't silently missing most real matches.
# ---------------------------------------------------------------------

TR_VARIANTS = {
    'a': '[aàâ]', 'e': '[eê]', 'i': '[iıİI]', 'o': '[oö]',
    'u': '[uü]', 'g': '[gğ]', 's': '[sş]', 'c': '[cç]',
}

def flexible_pattern(term):
    return r'\s*'.join(TR_VARIANTS.get(ch, re.escape(ch)) for ch in term.lower())

def find_flexible(term, text):
    return re.search(flexible_pattern(term), text, re.IGNORECASE) is not None

# Ottoman-Turkish administrative names used in Mühimme Defterleri for the
# three principalities/regions.
REGION_TERMS = {
    "Eflak (Țara Românească)": ["eflak"],
    "Boğdan (Moldova)": ["bogdan"],
    "Erdel (Ardeal / Transilvania)": ["erdel"],
}

# Frontier fortresses / annexed territories along the Danube–Black Sea–
# Dniester line frequently addressed in the same hükümler.
FORTRESS_TERMS = {
    "Kili (Chilia)": ["kili"],
    "Akkerman (Cetatea Albă)": ["akkerman"],
    "Yedikule": ["yedikule"],
    "Bender (Tighina)": ["bender"],
    "Hotin (Khotyn)": ["hotin"],
    "Silistre": ["silistre"],
}

THEME_TERMS = {
    "Comerț": ["ticaret", "gumruk", "bac", "kervan", "tuccar", "bezirgan", "koyun", "davar"],
    "Administrație": ["nizam", "tahrir", "tevzi", "kadi", "sancak", "iskan", "reaya", "tayin", "azl", "voyvoda"],
    "Militar / Securitate": ["asker", "ceng", "cenk", "harb", "sefer", "kale", "muhafaza", "lesker", "yenicer", "dusman"],
    "Diplomație": ["elci", "ahidname", "sulh", "musalaha", "mektub"],
}

# Title-page date range, e.g. "966–968 / 1558–1560" (Hijri / Gregorian).
PERIOD_RE = re.compile(r'(\d{3,4})\s*[–\-]\s*(\d{3,4})\s*/\s*(\d{4})\s*[–\-]\s*(\d{4})')

ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
                   "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"]

def detect_period(pages):
    front = "\n".join(pages[:6])
    m = PERIOD_RE.search(front)
    if not m:
        return None
    greg_start, greg_end = int(m.group(3)), int(m.group(4))
    century = (greg_start - 1) // 100 + 1
    return {
        "hijri": f"{m.group(1)}–{m.group(2)}",
        "greg_start": greg_start,
        "greg_end": greg_end,
        "century": century,
        "century_roman": ROMAN_NUMERALS[century] if 0 < century < len(ROMAN_NUMERALS) else str(century),
    }

# Each hüküm (order) in these volumes follows a very regular shape:
#   "<no> <Recipient>'<suffix>: <summary...> \n\n Yazıldı. \n ... \n Fî <date> \n <full Ottoman text>"
# The header line only ever repeats mid-body as "<hicri-year> <Recipient> hüküm ki:"
# (the re-address before the order text) — _BOGUS_RE filters that duplicate out.
_ENTRY_START_RE = re.compile(r'(?:^|\s)(\d{1,4})\s+([A-ZÇĞİÖŞÜ][^\n:]{2,110}?):\s')
_BOGUS_RE = re.compile(r'h[üu]\s?k[üu]m\s?ki$|hükm-i', re.IGNORECASE)
_YAZILDI_RE = re.compile(flexible_pattern('yazildi'), re.IGNORECASE)

@st.cache_data(show_spinner="Se analizează hükümurile din volum...")
def parse_entries(pages, volume_label):
    full_text = "\n".join(pages)

    start_marker = "ÖZET VE TRANSKR"
    idx_start = full_text.find(start_marker)
    body = full_text[idx_start:] if idx_start != -1 else full_text
    idx_marker_pos = body.rfind("\nİNDEKS")
    if idx_marker_pos != -1 and idx_marker_pos > len(body) * 0.5:
        body = body[:idx_marker_pos]

    body_clean = re.sub(r'ÖZET VE TRANSKR[İI]PS[İI]YON\s*\d*', ' ', body)
    body_flat = re.sub(r'[ \t]+', ' ', body_clean)

    raw_starts = list(_ENTRY_START_RE.finditer(body_flat))
    starts = [m for m in raw_starts if not _BOGUS_RE.search(' '.join(m.group(2).split()))]

    # Approximate page lookup (proportional offset mapping back into the
    # original page-joined text) — good enough as a "verify near page N"
    # pointer, not pixel-exact.
    page_bounds = []
    off = 0
    for i, p in enumerate(pages):
        page_bounds.append((off, i + 1))
        off += len(p) + 1

    def page_for(flat_offset):
        approx = int(flat_offset * len(full_text) / max(1, len(body_flat)))
        best = 1
        for start_off, pnum in page_bounds:
            if start_off <= approx:
                best = pnum
            else:
                break
        return best

    entries = []
    for i, m in enumerate(starts):
        num = m.group(1)
        recipient = ' '.join(m.group(2).split())
        block_start = m.end()
        block_end = starts[i + 1].start() if i + 1 < len(starts) else len(body_flat)
        raw = body_flat[block_start:block_end].strip()

        ya = _YAZILDI_RE.search(raw)
        if ya:
            summary, rest = raw[:ya.start()].strip(), raw[ya.start():].strip()
        else:
            summary, rest = raw[:300].strip(), raw

        text_all = summary + " " + rest[:2500]
        regions = [n for n, vs in REGION_TERMS.items() if any(find_flexible(v, text_all) for v in vs)]
        fortresses = [n for n, vs in FORTRESS_TERMS.items() if any(find_flexible(v, text_all) for v in vs)]
        themes = [n for n, vs in THEME_TERMS.items() if any(find_flexible(v, text_all) for v in vs)]

        entries.append({
            "volume": volume_label,
            "num": num,
            "recipient": recipient,
            "summary": summary,
            "full_text": rest[:4000],
            "page": page_for(m.start()),
            "regions": regions,
            "fortresses": fortresses,
            "themes": themes,
        })
    return entries

# "Fî 13 Ramazân sene 966" — carries forward to undated entries ("Bu dahı.",
# "Fî yevm-i mezbûr.") since these registers are kept in chronological order.
HICRI_YEAR_RE = re.compile(r'sene\s+(\d{3,4})', re.IGNORECASE)

def attach_years(entries, period):
    hijri_start = int(period["hijri"].split("–")[0]) if period else None
    greg_start = period["greg_start"] if period else None
    last_hicri = hijri_start
    for e in entries:
        m = HICRI_YEAR_RE.search(e["full_text"])
        if m:
            last_hicri = int(m.group(1))
        e["hicri_year"] = last_hicri
        if last_hicri is not None and hijri_start is not None and greg_start is not None:
            e["year"] = greg_start + (last_hicri - hijri_start)
        else:
            e["year"] = None
    return entries

def build_region_rows(entries):
    rows = []
    for e in entries:
        for r in e["regions"]:
            rows.append({"an": e["year"], "regiune": r, "num": e["num"], "recipient": e["recipient"], "volum": e["volume"]})
    return pd.DataFrame(rows, columns=["an", "regiune", "num", "recipient", "volum"])

def build_theme_rows(entries):
    rows = []
    for e in entries:
        for t in (e["themes"] or ["Neclasificat"]):
            rows.append({"an": e["year"], "tema": t, "num": e["num"], "recipient": e["recipient"], "volum": e["volume"]})
    return pd.DataFrame(rows, columns=["an", "tema", "num", "recipient", "volum"])

def render_network_graph(G, title, chart_key):
    """Draws the graph and returns the node label the user clicked, if any."""
    if G.number_of_nodes() == 0:
        st.write("Niciun rezultat pentru acest grafic.")
        return None

    pos = nx.spring_layout(G, seed=42, k=1.2)

    edge_x, edge_y = [], []
    for u, v in G.edges():
        x0, y0 = pos[u]
        x1, y1 = pos[v]
        edge_x += [x0, x1, None]
        edge_y += [y0, y1, None]

    edge_trace = go.Scatter(x=edge_x, y=edge_y, line=dict(width=1), hoverinfo="none", mode="lines")

    node_labels = list(G.nodes())
    node_x, node_y, node_text, node_size = [], [], [], []
    for n in node_labels:
        x, y = pos[n]
        node_x.append(x)
        node_y.append(y)
        degree = G.degree(n)
        weight = G.nodes[n].get("weight", degree)
        node_text.append(f"{n}<br>Legături: {degree}<br>Menționări: {weight}")
        node_size.append(16 + degree * 6)

    node_trace = go.Scatter(
        x=node_x, y=node_y, mode="markers+text", hoverinfo="text",
        hovertext=node_text, text=node_labels, textposition="top center",
        customdata=node_labels,
        marker=dict(size=node_size, line=dict(width=1))
    )

    fig = go.Figure(data=[edge_trace, node_trace])
    fig.update_layout(
        title=title, showlegend=False, hovermode="closest", height=600,
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
    )
    event = st.plotly_chart(
        fig, use_container_width=True, key=chart_key,
        on_select="rerun", selection_mode="points"
    )
    st.caption("💡 Dă clic pe un nod pentru a vedea hükümurile asociate mai jos.")

    points = (event or {}).get("selection", {}).get("points", [])
    if points:
        cd = points[0].get("customdata")
        if isinstance(cd, list):
            return cd[0] if cd else None
        return cd
    return None

def render_node_details(clicked_node, entries_for_node, empty_hint):
    if not clicked_node:
        return
    st.markdown(f"#### 📌 {clicked_node}")
    if not entries_for_node:
        st.write(empty_hint)
        return
    st.write(f"**{len(entries_for_node)} hükümuri** asociate acestui nod.")
    for e in entries_for_node[:20]:
        header = f"#{e['num']} — {e['recipient']} ({e['volume']}, p. {e['page']})"
        with st.expander(header):
            st.write(f"**Rezumat:** {e['summary']}")
            st.text(e["full_text"][:1200])
    if len(entries_for_node) > 20:
        st.caption(
            f"Se afișează primele 20 din {len(entries_for_node)}. Vezi și "
            "fila „📄 Documente” pentru filtrare completă."
        )

# -------------------------------------------------------
# DATA UPLOAD
# -------------------------------------------------------

st.sidebar.header("🗃️ Corpus")

uploaded_file = st.sidebar.file_uploader(
    "Încarcă propriul corpus CSV",
    type=["csv"]
)

if uploaded_file is not None:
    try:
        df = pd.read_csv(uploaded_file)

        if "data_document" in df.columns:
            df["data_document"] = pd.to_datetime(
                df["data_document"],
                errors="coerce",
                format='%Y-%m-%d' # Added format for uploaded files as well
            )

        st.sidebar.success("Corpus încărcat.")
    except Exception as e:
        st.sidebar.error(f"Eroare la citirea fișierului: {e}")
        df = demo_df.copy()
else:
    df = demo_df.copy()

st.sidebar.header("📕 Volume sursă (PDF)")

uploaded_pdfs = st.sidebar.file_uploader(
    "Încarcă unul sau mai multe volume Mühimme Defterleri (PDF)",
    type=["pdf"],
    accept_multiple_files=True,
    key="pdf_volumes"
)

volumes = []

if uploaded_pdfs:
    for up in uploaded_pdfs:
        pdf_bytes = up.getvalue()
        try:
            pages = extract_pdf_pages(pdf_bytes)
            period = detect_period(pages)
            if period:
                century_label = f"secolul {period['century_roman']} ({period['greg_start']}–{period['greg_end']})"
            else:
                century_label = "secol necunoscut (dată neidentificată pe pagina de titlu)"
            entries = parse_entries(pages, up.name)
            entries = attach_years(entries, period)
            for e in entries:
                e["century_label"] = century_label
                e["century"] = period["century"] if period else None
            volumes.append({
                "name": up.name,
                "bytes": pdf_bytes,
                "pages": pages,
                "period": period,
                "century_label": century_label,
                "entries": entries,
            })
        except Exception as e:
            st.sidebar.error(f"Eroare la citirea „{up.name}”: {e}")

    if volumes:
        st.sidebar.success(
            f"{len(volumes)} volum(e) încărcate — "
            f"{sum(len(v['entries']) for v in volumes)} hükümuri identificate."
        )

all_entries = [e for v in volumes for e in v["entries"]]

# The unified real corpus: hükümuri that actually concern Eflak / Boğdan /
# Erdel or one of the annexed fortresses. This is what tabs 1-7 switch to
# once any PDF is uploaded, so there is only ever ONE dashboard, not two.
pdf_corpus_entries = [e for e in all_entries if e["regions"] or e["fortresses"]]
has_pdf = len(pdf_corpus_entries) > 0

# -------------------------------------------------------
# FILTERS
# -------------------------------------------------------

st.sidebar.header("🔎 Filtre")

if has_pdf:
    st.sidebar.caption(
        "Aceste filtre se aplică corpusului demonstrativ. Pentru datele "
        "reale din PDF, folosește filtrele din fila „📄 Documente”."
    )

principates = st.sidebar.multiselect(
    "Teritoriu",
    options=sorted(df["principat"].dropna().unique()),
    default=sorted(df["principat"].dropna().unique())
)

themes = st.sidebar.multiselect(
    "Temă",
    options=sorted(df["tema"].dropna().unique()),
    default=sorted(df["tema"].dropna().unique())
)

registers = st.sidebar.multiselect(
    "Registru",
    options=sorted(df["registru"].dropna().unique()),
    default=sorted(df["registru"].dropna().unique())
)

min_year = int(df["an"].min())
max_year = int(df["an"].max())

year_range = st.sidebar.slider(
    "Interval cronologic",
    min_value=min_year,
    max_value=max_year,
    value=(min_year, max_year)
)

filtered = df[
    (df["principat"].isin(principates)) &
    (df["tema"].isin(themes)) &
    (df["registru"].isin(registers)) &
    (df["an"] >= year_range[0]) &
    (df["an"] <= year_range[1])
].copy()

# -------------------------------------------------------
# TABS
# -------------------------------------------------------

tabs = st.tabs([
    "🏠 Corpus",
    "⏳ Cronologie",
    "🏷️ Teme",
    "🗺️ Hartă",
    "🕸️ Rețele",
    "⚖️ Comparație",
    "📄 Documente",
    "📕 Volum PDF"
])

# =======================================================
# TAB 1 - CORPUS
# =======================================================

with tabs[0]:

    st.header("Corpusul cercetării")

    if has_pdf:

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Hükümuri (Eflak / Boğdan / Erdel + cetăți)", len(pdf_corpus_entries))
        c2.metric("Volume încărcate", len(volumes))
        c3.metric("Regiuni distincte", len(set(r for e in pdf_corpus_entries for r in e["regions"])))
        c4.metric("Destinatari distincți", len(set(e["recipient"] for e in pdf_corpus_entries)))

        st.divider()

        left, right = st.columns([2, 1])

        region_rows = build_region_rows(pdf_corpus_entries)

        with left:
            dated = region_rows.dropna(subset=["an"])
            if not dated.empty:
                yearly = dated.groupby(["an", "regiune"]).size().reset_index(name="hükümuri")
                fig = px.bar(
                    yearly, x="an", y="hükümuri", color="regiune", barmode="group",
                    title="Hükümuri identificate pe ani (an aproximativ)"
                )
                st.plotly_chart(fig, use_container_width=True, key="corpus_yearly_bar")
            else:
                st.write("Anul nu a putut fi determinat pentru hükümurile curente.")

        with right:
            theme_rows = build_theme_rows(pdf_corpus_entries)
            theme_counts = theme_rows["tema"].value_counts().reset_index()
            theme_counts.columns = ["tema", "hükümuri"]
            fig = px.pie(theme_counts, names="tema", values="hükümuri", title="Structura tematică")
            st.plotly_chart(fig, use_container_width=True, key="corpus_theme_pie")

        st.info(
            """
            Acesta este corpusul real, extras din volumul/volumele Mühimme
            Defterleri încărcate — hükümurile care menționează Eflak,
            Boğdan, Erdel sau una dintre cetățile anexate (Kili, Akkerman,
            Bender, Hotin, Silistre). Anul este aproximativ (dedus din anul
            hicrî al hükümului, raportat la intervalul gregorian de pe
            pagina de titlu a volumului).
            """
        )

        st.divider()

        st.subheader("Repere tematice")
        st.caption(
            "Nu doar cifre — câte un exemplu real, cu referință arhivistică, "
            "pentru fiecare regiune. Textul integral e disponibil în fila "
            "„📄 Documente”."
        )

        highlight_cols = st.columns(3)
        for col, name in zip(highlight_cols, REGION_TERMS):
            matches = [e for e in pdf_corpus_entries if name in e["regions"]]
            with col:
                st.markdown(f"**{name}**")
                if not matches:
                    st.write("Niciun hüküm găsit pentru această regiune.")
                    continue
                theme_counter = Counter(t for e in matches for t in e["themes"])
                top_theme = theme_counter.most_common(1)[0][0] if theme_counter else "teme neclasificate"
                st.write(f"{len(matches)} hükümuri · temă dominantă: **{top_theme}**")
                example = matches[0]
                st.caption(
                    f"Exemplu — #{example['num']} către {example['recipient']} "
                    f"({example['volume']}, p. {example['page']}):"
                )
                st.write(f"_{example['summary'][:220]}_")

    else:

        c1, c2, c3, c4 = st.columns(4)

        c1.metric(
            "Documente",
            len(filtered)
        )

        c2.metric(
            "Registre",
            filtered["registru"].nunique()
        )

        c3.metric(
            "Localități",
            filtered["localitate"].nunique()
        )

        c4.metric(
            "Actori principali",
            filtered["actor_principal"].nunique()
        )

        st.divider()

        left, right = st.columns([2, 1])

        with left:

            yearly = (
                filtered.groupby(["an", "principat"])
                .size()
                .reset_index(name="documente")
            )

            fig = px.bar(
                yearly,
                x="an",
                y="documente",
                color="principat",
                barmode="group",
                title="Documente identificate pe ani"
            )

            st.plotly_chart(fig, use_container_width=True)

        with right:

            theme_counts = (
                filtered["tema"]
                .value_counts()
                .reset_index()
            )

            theme_counts.columns = ["tema", "documente"]

            fig = px.pie(
                theme_counts,
                names="tema",
                values="documente",
                title="Structura tematică"
            )

            st.plotly_chart(fig, use_container_width=True)

        st.info(
            """
            În cercetarea reală, această secțiune arată dimensiunea corpusului
            și distribuția documentelor, nu doar o listă de surse. Cercetătorul
            poate observa imediat perioadele și temele mai bine reprezentate.
            """
        )

# =======================================================
# TAB 2 - TIMELINE
# =======================================================

with tabs[1]:

    st.header("Evoluția cronologică")

    if has_pdf:

        theme_rows = build_theme_rows(pdf_corpus_entries).dropna(subset=["an"])

        if not theme_rows.empty:
            yearly_theme = theme_rows.groupby(["an", "tema"]).size().reset_index(name="hükümuri")
            fig = px.line(
                yearly_theme, x="an", y="hükümuri", color="tema", markers=True,
                title="Evoluția temelor în timp (an aproximativ)"
            )
            st.plotly_chart(fig, use_container_width=True, key="cronologie_line")
        else:
            st.write("Anul nu a putut fi determinat pentru hükümurile curente.")

        st.markdown(
            """
            ### Notă despre cronologie

            Anul fiecărui hüküm este dedus din anul hicrî menționat în text
            (ex. „Fî 13 Ramazân sene 966”), raportat proporțional la
            intervalul gregorian de pe pagina de titlu a volumului — deci
            este **aproximativ**, nu o conversie calendaristică exactă.
            Hükümurile fără dată proprie preiau anul ultimei date întâlnite
            în volum (registrele sunt ținute cronologic).
            """
        )

    else:

        yearly_theme = (
            filtered.groupby(["an", "tema"])
            .size()
            .reset_index(name="documente")
        )

        fig = px.line(
            yearly_theme,
            x="an",
            y="documente",
            color="tema",
            markers=True,
            title="Evoluția temelor în timp"
        )

        st.plotly_chart(fig, use_container_width=True)

        st.markdown(
            """
            ### Întrebarea empirică

            Putem identifica **perioade de intensificare a anumitor tipuri de
            comunicare** între administrația otomană și cele două principate?

            De exemplu, într-un corpus real s-ar putea observa dacă documentele
            privind securitatea, fiscalitatea sau problemele militare devin mai
            frecvente într-un anumit interval.
            """
        )

# =======================================================
# TAB 3 - THEMES
# =======================================================

with tabs[2]:

    st.header("Analiza tematică")

    if has_pdf:

        cross_rows = []
        for e in pdf_corpus_entries:
            for r in (e["regions"] or ["(doar cetate, fără regiune)"]):
                for t in (e["themes"] or ["Neclasificat"]):
                    cross_rows.append({"regiune": r, "tema": t})
        cross_df = pd.DataFrame(cross_rows, columns=["regiune", "tema"])

        thematic = cross_df.groupby(["tema", "regiune"]).size().reset_index(name="hükümuri")

        fig = px.bar(
            thematic, x="tema", y="hükümuri", color="regiune", barmode="group",
            title="Eflak / Boğdan / Erdel – comparație tematică"
        )
        st.plotly_chart(fig, use_container_width=True, key="teme_bar")

        st.subheader("Teme dominante")

        ranking = build_theme_rows(pdf_corpus_entries)["tema"].value_counts().reset_index()
        ranking.columns = ["Temă", "Număr hükümuri"]

        st.dataframe(ranking, use_container_width=True, hide_index=True)

    else:

        thematic = (
            filtered.groupby(["tema", "principat"])
            .size()
            .reset_index(name="documente")
        )

        fig = px.bar(
            thematic,
            x="tema",
            y="documente",
            color="principat",
            barmode="group",
            title="Moldova și Țara Românească – comparație tematică"
        )

        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Teme dominante")

        ranking = (
            filtered["tema"]
            .value_counts()
            .reset_index()
        )

        ranking.columns = ["Temă", "Număr documente"]

        st.dataframe(
            ranking,
            use_container_width=True,
            hide_index=True
        )

# =======================================================
# TAB 4 - MAP
# =======================================================

with tabs[3]:

    st.header("Geografia documentelor")

    if has_pdf:

        st.caption(
            "Hartă stilizată de epocă, desenată ilustrativ — nu există o "
            "hartă istorică reală disponibilă de încărcat, așa că regiunile "
            "și cetățile sunt poziționate aproximativ unele față de altele, "
            "nu pe o proiecție geografică exactă."
        )

        detected_centuries = sorted(set(v["period"]["century"] for v in volumes if v["period"]))
        if detected_centuries:
            century_note = "Volume încărcate: " + ", ".join(
                f"secolul {ROMAN_NUMERALS[c]}" for c in detected_centuries
            )
        else:
            century_note = "Secolul volumelor încărcate nu a putut fi identificat automat."

        map_counts = {name: len([e for e in pdf_corpus_entries if name in e["regions"]]) for name in REGION_TERMS}
        for name in FORTRESS_TERMS:
            if name != "Yedikule":
                map_counts[name] = len([e for e in pdf_corpus_entries if name in e["fortresses"]])

        def _map_radius(c):
            return 12 + min(c, 80) * 0.5

        MAP_POSITIONS = {
            "Boğdan (Moldova)": (560, 120),
            "Eflak (Țara Românească)": (420, 300),
            "Erdel (Ardeal / Transilvania)": (270, 210),
            "Kili (Chilia)": (640, 310),
            "Akkerman (Cetatea Albă)": (690, 210),
            "Bender (Tighina)": (630, 150),
            "Hotin (Khotyn)": (560, 55),
            "Silistre": (470, 390),
        }

        markers_svg = []
        for name, (mx, my) in MAP_POSITIONS.items():
            c = map_counts.get(name, 0)
            r = _map_radius(c)
            short = name.split(" ")[0]
            fill = "#8b3a2f" if name in REGION_TERMS else "#4a5a3a"
            markers_svg.append(
                f'<circle cx="{mx}" cy="{my}" r="{r}" fill="{fill}" fill-opacity="0.75" '
                f'stroke="#2b2013" stroke-width="1.5" />'
                f'<text x="{mx}" y="{my - r - 6}" text-anchor="middle" font-family="Georgia, serif" '
                f'font-size="15" fill="#2b2013" font-weight="bold">{short}</text>'
                f'<text x="{mx}" y="{my + 4}" text-anchor="middle" font-family="Georgia, serif" '
                f'font-size="11" fill="#f5ecd8">{c}</text>'
            )

        svg = f'''
        <svg viewBox="0 0 820 460" xmlns="http://www.w3.org/2000/svg"
             style="width:100%; max-width:820px; height:auto; background:#f0e2c0;
                    border:6px solid #6b4a2f; border-radius:4px;">
          <defs>
            <radialGradient id="parchment" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stop-color="#f5ecd8" />
              <stop offset="100%" stop-color="#e3d2a5" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="820" height="460" fill="url(#parchment)" />

          <path d="M 650 260 Q 780 260 800 350 Q 780 440 680 440 Q 620 400 630 330 Q 630 280 650 260 Z"
                fill="#5b7c8c" fill-opacity="0.55" stroke="#2b2013" stroke-width="1" />
          <text x="700" y="360" font-family="Georgia, serif" font-size="14" fill="#1d2a30" font-style="italic">Marea Neagră</text>

          <path d="M 120 380 Q 260 370 350 360 Q 460 350 560 340 Q 620 335 650 310"
                fill="none" stroke="#4a6b7a" stroke-width="5" stroke-linecap="round" opacity="0.8" />
          <text x="160" y="400" font-family="Georgia, serif" font-size="12" fill="#2b2013" font-style="italic">Dunărea</text>

          <path d="M 560 60 Q 600 110 620 150 Q 660 180 690 210"
                fill="none" stroke="#4a6b7a" stroke-width="4" stroke-linecap="round" opacity="0.7" />
          <text x="595" y="95" font-family="Georgia, serif" font-size="11" fill="#2b2013" font-style="italic">Nistru</text>

          <path d="M 230 120 Q 300 200 260 320 Q 250 360 300 400"
                fill="none" stroke="#6b5a3a" stroke-width="6" stroke-dasharray="2 6" stroke-linecap="round" opacity="0.6" />

          {''.join(markers_svg)}

          <text x="20" y="30" font-family="Georgia, serif" font-size="20" fill="#2b2013" font-weight="bold">Eflak · Boğdan · Erdel</text>
          <text x="20" y="52" font-family="Georgia, serif" font-size="13" fill="#4a3a20">{century_note}</text>
          <text x="20" y="440" font-family="Georgia, serif" font-size="11" fill="#6b5a3a">Diametrul cercurilor = nr. de mențiuni în corpusul curent. Nu este o proiecție geografică exactă.</text>
        </svg>
        '''

        st.markdown(svg, unsafe_allow_html=True)

        yedikule_count = len([e for e in all_entries if "Yedikule" in e["fortresses"]])
        st.caption(
            f"Notă: Yedikule este o cetate din Istanbul (nu de pe frontiera "
            f"dunăreană), de aceea nu apare pe hartă — {yedikule_count} "
            f"mențiuni găsite în volumele încărcate până acum."
        )

    else:

        location_counts = (
            filtered.groupby(
                ["localitate", "lat", "lon", "principat"],
                as_index=False
            )
            .size()
            .rename(columns={"size": "documente"})
        )

        if not location_counts.empty:

            fig = px.scatter_map(
                location_counts,
                lat="lat",
                lon="lon",
                size="documente",
                color="principat",
                hover_name="localitate",
                hover_data={
                    "documente": True,
                    "lat": False,
                    "lon": False
                },
                zoom=5,
                height=650,
                title="Localități menționate în corpus"
            )

            st.plotly_chart(fig, use_container_width=True)

        st.markdown(
            """
            Harta permite trecerea de la întrebarea **„ce spune documentul?”**
            la întrebarea **„unde se concentrează problemele menționate de
            administrația otomană?”**.

            Într-un corpus mai mare pot deveni vizibile:

            - zone de frontieră;
            - porturi și cetăți;
            - centre politice;
            - coridoare comerciale;
            - regiuni care apar repetat în contexte de securitate.
            """
        )

# =======================================================
# TAB 5 - NETWORK
# =======================================================

with tabs[4]:

    st.header("Rețeaua actorilor")

    if has_pdf:

        st.caption(
            "Ambele rețele de mai jos sunt construite exclusiv din textul "
            "volumelor Mühimme Defterleri încărcate — niciun actor "
            "demonstrativ."
        )

        st.subheader("Cu cine a corespondat Poarta Otomană")

        recipient_counts = Counter(e["recipient"] for e in pdf_corpus_entries)
        top_n = st.slider("Număr de destinatari afișați", 5, 40, 20, key="recipient_top_n")

        G1 = nx.Graph()
        G1.add_node("Poarta Otomană (Sultan)", weight=len(pdf_corpus_entries))
        for recipient, cnt in recipient_counts.most_common(top_n):
            G1.add_edge("Poarta Otomană (Sultan)", recipient, weight=cnt)
            G1.nodes[recipient]["weight"] = cnt

        clicked1 = render_network_graph(G1, "Destinatarii hükümurilor (din document)", "recipient_network")
        if clicked1:
            node_entries1 = (
                pdf_corpus_entries if clicked1 == "Poarta Otomană (Sultan)"
                else [e for e in pdf_corpus_entries if e["recipient"] == clicked1]
            )
            render_node_details(clicked1, node_entries1, "Niciun hüküm găsit pentru acest destinatar.")

        st.subheader("Co-menționări: Eflak / Boğdan / Erdel și cetăți")
        st.caption(
            "O muchie leagă două regiuni/cetăți dacă apar în același "
            "hüküm — de exemplu un ordin ca voievodul Eflak să acționeze "
            "împreună cu cel al Boğdanului."
        )

        G2 = nx.Graph()
        for e in pdf_corpus_entries:
            ents = list(dict.fromkeys(e["regions"] + e["fortresses"]))
            for x in ents:
                if not G2.has_node(x):
                    G2.add_node(x, weight=0)
                G2.nodes[x]["weight"] += 1
            for a in range(len(ents)):
                for b in range(a + 1, len(ents)):
                    u, v = ents[a], ents[b]
                    if G2.has_edge(u, v):
                        G2[u][v]["weight"] += 1
                    else:
                        G2.add_edge(u, v, weight=1)

        clicked2 = render_network_graph(G2, "Co-menționări regiuni și cetăți", "region_cooccurrence_network")
        if clicked2:
            node_entries2 = [
                e for e in pdf_corpus_entries
                if clicked2 in e["regions"] or clicked2 in e["fortresses"]
            ]
            render_node_details(clicked2, node_entries2, "Niciun hüküm găsit pentru acest nod.")

    else:

        st.caption(
            "Legăturile sunt construite din co-apariția actorului principal "
            "și a actorului secundar în același document."
        )

        if len(filtered) > 0:

            G = nx.Graph()

            for _, row in filtered.iterrows():

                source = str(row["actor_principal"])
                target = str(row["actor_secundar"])

                if G.has_edge(source, target):
                    G[source][target]["weight"] += 1
                else:
                    G.add_edge(source, target, weight=1)

            pos = nx.spring_layout(
                G,
                seed=42,
                k=1.2
            )

            edge_x = []
            edge_y = []

            for edge in G.edges():

                x0, y0 = pos[edge[0]]
                x1, y1 = pos[edge[1]]

                edge_x += [x0, x1, None]
                edge_y += [y0, y1, None]

            edge_trace = go.Scatter(
                x=edge_x,
                y=edge_y,
                line=dict(width=1),
                hoverinfo="none",
                mode="lines"
            )

            node_x = []
            node_y = []
            node_text = []
            node_size = []

            for node in G.nodes():

                x, y = pos[node]

                node_x.append(x)
                node_y.append(y)

                degree = G.degree(node)

                node_text.append(
                    f"{node}<br>Legături: {degree}"
                )

                node_size.append(
                    18 + degree * 7
                )

            node_trace = go.Scatter(
                x=node_x,
                y=node_y,
                mode="markers+text",
                hoverinfo="text",
                hovertext=node_text,
                text=list(G.nodes()),
                textposition="top center",
                marker=dict(
                    size=node_size,
                    line=dict(width=1)
                )
            )

            fig = go.Figure(
                data=[edge_trace, node_trace]
            )

            fig.update_layout(
                title="Rețeaua relațiilor identificate în documente",
                showlegend=False,
                hovermode="closest",
                height=650,
                xaxis=dict(
                    showgrid=False,
                    zeroline=False,
                    showticklabels=False
                ),
                yaxis=dict(
                    showgrid=False,
                    zeroline=False,
                    showticklabels=False
                )
            )

            st.plotly_chart(
                fig,
                use_container_width=True
            )

            # CENTRALITY
            centrality = nx.degree_centrality(G)

            centrality_df = pd.DataFrame(
                centrality.items(),
                columns=["Actor", "Centralitate"]
            ).sort_values(
                "Centralitate",
                ascending=False
            )

            st.subheader("Actori mai conectați în corpus")

            st.dataframe(
                centrality_df,
                use_container_width=True,
                hide_index=True
            )

# =======================================================
# TAB 6 - COMPARISON
# =======================================================

with tabs[5]:

    if has_pdf:

        st.header("Eflak vs. Boğdan vs. Erdel")
        st.caption("Comparație bazată exclusiv pe hükümurile din volumele Mühimme Defterleri încărcate.")

        region_names = list(REGION_TERMS.keys())
        cols = st.columns(3)
        for col, name in zip(cols, region_names):
            col.metric(name, len([e for e in pdf_corpus_entries if name in e["regions"]]))

        st.divider()

        theme_rows = []
        for name in region_names:
            matches = [e for e in pdf_corpus_entries if name in e["regions"]]
            theme_counter = Counter(t for e in matches for t in e["themes"])
            for theme in THEME_TERMS:
                theme_rows.append({"regiune": name, "temă": theme, "hükümuri": theme_counter.get(theme, 0)})

        theme_df = pd.DataFrame(theme_rows)
        if theme_df["hükümuri"].sum() > 0:
            fig = px.bar(
                theme_df, x="temă", y="hükümuri", color="regiune", barmode="group",
                title="Profil tematic: Eflak vs. Boğdan vs. Erdel"
            )
            st.plotly_chart(fig, use_container_width=True, key="region_theme_comparison")
        else:
            st.write("Nicio temă clasificată încă pentru volumele încărcate.")

        st.subheader("Cei mai frecvenți destinatari, pe regiune")
        rec_cols = st.columns(3)
        for col, name in zip(rec_cols, region_names):
            matches = [e for e in pdf_corpus_entries if name in e["regions"]]
            top = Counter(e["recipient"] for e in matches).most_common(5)
            with col:
                st.markdown(f"**{name}**")
                if top:
                    for recipient, cnt in top:
                        st.write(f"- {recipient} ({cnt})")
                else:
                    st.write("—")

    else:

        st.header("Moldova vs. Țara Românească")

        comparison = pd.crosstab(
            filtered["tema"],
            filtered["principat"]
        )

        st.dataframe(
            comparison,
            use_container_width=True
        )

        if not comparison.empty:

            comparison_long = (
                comparison.reset_index()
                .melt(
                    id_vars="tema",
                    var_name="principat",
                    value_name="documente"
                )
            )

            fig = px.bar(
                comparison_long,
                x="tema",
                y="documente",
                color="principat",
                barmode="group",
                title="Profilul tematic comparativ"
            )

            st.plotly_chart(
                fig,
                use_container_width=True
            )

        col1, col2 = st.columns(2)

        for col, principality in zip(
            [col1, col2],
            ["Moldova", "Țara Românească"]
        ):

            subset = filtered[
                filtered["principat"] == principality
            ]

            with col:

                st.subheader(principality)

                st.metric(
                    "Documente",
                    len(subset)
                )

                if len(subset):

                    top_theme = subset["tema"].mode()[0]
                    top_place = subset["localitate"].mode()[0]

                    st.write(
                        f"**Tema dominantă:** {top_theme}"
                    )

                    st.write(
                        f"**Localitatea cea mai frecventă:** {top_place}"
                    )

# =======================================================
# TAB 7 - DOCUMENTS
# =======================================================

with tabs[6]:

    if has_pdf:

        st.header("Documentele cercetării")

        st.markdown(
            """
            Analiza digitală trebuie să permită întotdeauna revenirea la
            **documentul original și contextul arhivistic** — fiecare
            rezultat de mai jos afișează textul integral, nu doar un
            rezumat sau un număr de pagină.
            """
        )

        f1, f2, f3 = st.columns(3)
        region_filter = f1.multiselect(
            "Regiune", list(REGION_TERMS.keys()), key="doc_region_filter"
        )
        fortress_filter = f2.multiselect(
            "Cetate / teritoriu anexat", list(FORTRESS_TERMS.keys()), key="doc_fortress_filter"
        )
        theme_filter = f3.multiselect(
            "Temă", list(THEME_TERMS.keys()), key="doc_theme_filter"
        )

        search = st.text_input("🔍 Caută în rezumate și text", "", key="doc_search")

        documents = pdf_corpus_entries
        if region_filter:
            documents = [e for e in documents if any(r in e["regions"] for r in region_filter)]
        if fortress_filter:
            documents = [e for e in documents if any(f in e["fortresses"] for f in fortress_filter)]
        if theme_filter:
            documents = [e for e in documents if any(t in e["themes"] for t in theme_filter)]
        if search:
            documents = [e for e in documents if find_flexible(search, e["summary"] + " " + e["full_text"])]

        st.write(f"**{len(documents)} hükümuri** găsite.")

        table_rows = [
            {
                "Nr.": e["num"],
                "Destinatar": e["recipient"],
                "Regiuni": ", ".join(e["regions"]) or "—",
                "Cetăți": ", ".join(e["fortresses"]) or "—",
                "Teme": ", ".join(e["themes"]) or "—",
                "An (aprox.)": e["year"] if e["year"] is not None else "—",
                "Volum": e["volume"],
                "Pagina": e["page"],
            }
            for e in documents
        ]

        st.dataframe(pd.DataFrame(table_rows), use_container_width=True, hide_index=True)

        if documents:

            st.subheader("Fișa hükümului")

            option_labels = [f"#{e['num']} — {e['recipient']} ({e['volume']})" for e in documents]
            selected_idx = st.selectbox(
                "Selectează hükümul",
                range(len(documents)),
                format_func=lambda i: option_labels[i],
                key="doc_select"
            )

            doc = documents[selected_idx]

            c1, c2 = st.columns([1, 2])

            with c1:

                st.write(f"**Nr.:** {doc['num']}")
                st.write(f"**Volum:** {doc['volume']}")
                st.write(f"**Pagina (aprox.):** {doc['page']}")
                st.write(f"**An (aprox.):** {doc['year'] if doc['year'] is not None else 'necunoscut'}")
                st.write(f"**Regiuni:** {', '.join(doc['regions']) or '—'}")
                st.write(f"**Cetăți:** {', '.join(doc['fortresses']) or '—'}")
                st.write(f"**Teme:** {', '.join(doc['themes']) or '—'}")

            with c2:

                st.markdown("#### Rezumat")
                st.write(doc["summary"])

                st.markdown("#### Text integral")
                st.text(doc["full_text"][:3000])

    else:

        st.header("Înapoi la document")

        st.markdown(
            """
            Analiza digitală trebuie să permită întotdeauna revenirea la
            **documentul original și contextul arhivistic**.
            """
        )

        search = st.text_input(
            "🔍 Caută în rezumatele documentelor",
            ""
        )

        documents = filtered.copy()

        if search:
            documents = documents[
                documents["rezumat"]
                .str.contains(
                    search,
                    case=False,
                    na=False
                )
            ]

        show_columns = [
            "id",
            "registru",
            "data_document",
            "principat",
            "localitate",
            "tema",
            "tip_decizie",
            "actor_principal",
            "actor_secundar",
            "rezumat",
            "referinta"
        ]

        st.dataframe(
            documents[show_columns],
            use_container_width=True,
            hide_index=True
        )

        # Individual document viewer
        if len(documents) > 0:

            st.subheader("Fișa documentului")

            selected_id = st.selectbox(
                "Selectează documentul",
                documents["id"].tolist()
            )

            doc = documents[
                documents["id"] == selected_id
            ].iloc[0]

            c1, c2 = st.columns([1, 2])

            with c1:

                st.write(
                    f"**ID:** {doc['id']}"
                )
                st.write(
                    f"**Registru:** {doc['registru']}"
                )
                st.write(
                    f"**Data:** {doc['data_document'].date()}"
                )
                st.write(
                    f"**Teritoriu:** {doc['principat']}"
                )
                st.write(
                    f"**Localitate:** {doc['localitate']}"
                )
                st.write(
                    f"**Temă:** {doc['tema']}"
                )

            with c2:

                st.markdown("#### Interpretare / rezumat")

                st.write(
                    doc["rezumat"]
                )

                st.markdown("#### Relația codificată")

                st.write(
                    f"""
                    **{doc['actor_principal']}**
                    → **{doc['tip_decizie']}**
                    → **{doc['actor_secundar']}**
                    """
                )

                st.caption(
                    f"Referință arhivistică: {doc['referinta']}"
                )

# =======================================================
# TAB 8 - PDF VOLUME
# =======================================================

with tabs[7]:

    st.header("Volumele sursă (Mühimme Defterleri)")

    if not volumes:

        st.info(
            "Încarcă unul sau mai multe volume Mühimme Defterleri (PDF) din "
            "bara laterală, secțiunea „📕 Volume sursă (PDF)”. Fiecare volum "
            "este analizat automat, iar filele „🏠 Corpus” — „📄 Documente” "
            "de mai sus vor comuta să arate datele reale extrase din el."
        )

    else:

        st.caption(
            "Această filă este doar pentru gestionarea volumelor sursă — "
            "analiza (corpus, cronologie, teme, hartă, rețele, comparație, "
            "documente) se află acum în filele de mai sus, care folosesc "
            "aceleași date reale, nu un tablou de bord separat."
        )

        sub_volumes, sub_view, sub_search = st.tabs([
            "📚 Volume", "📖 Vizualizare", "🔍 Căutare completă"
        ])

        # -----------------------------------------------------------
        # 📚 VOLUMES OVERVIEW
        # -----------------------------------------------------------
        with sub_volumes:

            st.caption(
                "Secolul fiecărui volum este detectat automat de pe pagina "
                "de titlu (interval hicrî / gregorian). Toate analizele din "
                "celelalte sub-file agregă hükümurile din TOATE volumele "
                "încărcate mai jos."
            )

            vol_rows = [
                {
                    "Fișier": v["name"],
                    "Pagini": len(v["pages"]),
                    "Hükümuri identificate": len(v["entries"]),
                    "Secol": v["century_label"],
                }
                for v in volumes
            ]

            st.dataframe(pd.DataFrame(vol_rows), use_container_width=True, hide_index=True)

            centuries_present = sorted(set(v["period"]["century"] for v in volumes if v["period"]))
            if centuries_present:
                st.info(
                    "Secole reprezentate momentan: " +
                    ", ".join(f"secolul {ROMAN_NUMERALS[c]}" for c in centuries_present) +
                    ". Încarcă și volume din secolele XIV–XV (sau altele) și vor "
                    "apărea aici automat, fără nicio schimbare de configurare."
                )
            else:
                st.warning(
                    "Nu s-a putut detecta automat intervalul de date pentru "
                    "niciun volum încărcat (pagina de titlu are alt format)."
                )

        # -----------------------------------------------------------
        # 📖 VIEW
        # -----------------------------------------------------------
        with sub_view:

            vol_names = [v["name"] for v in volumes]
            chosen = st.selectbox("Alege volumul de vizualizat", vol_names, key="view_volume_select")
            chosen_vol = next(v for v in volumes if v["name"] == chosen)

            b64 = base64.b64encode(chosen_vol["bytes"]).decode("utf-8")
            st.markdown(
                f'<iframe src="data:application/pdf;base64,{b64}" '
                f'width="100%" height="800" type="application/pdf"></iframe>',
                unsafe_allow_html=True
            )

        # -----------------------------------------------------------
        # 🔍 SEARCH (real entry text, not page indices)
        # -----------------------------------------------------------
        with sub_search:

            query = st.text_input("Caută un termen (în rezumate și text)", "", key="entry_search_query")

            if query:
                matches = [
                    e for e in all_entries
                    if find_flexible(query, e["summary"] + " " + e["full_text"])
                ]
                st.write(f"**{len(matches)} hükümuri** conțin „{query}”.")
                for e in matches[:50]:
                    with st.expander(f"#{e['num']} — {e['recipient']} ({e['volume']}, p. {e['page']})"):
                        st.write(f"**Rezumat:** {e['summary']}")
                        st.text(e["full_text"][:1500])
                if len(matches) > 50:
                    st.caption(f"Se afișează primele 50 din {len(matches)}.")
            else:
                st.caption("Introdu un termen pentru a căuta în toate volumele încărcate.")

        st.markdown(
            """
            Volumele sursă rămân referința finală: extragerea automată a
            textului și clasificarea pe teme/regiuni sunt euristici bazate
            pe cuvinte-cheie și potrivire flexibilă a diacriticelor, nu
            adnotare manuală validată filologic. Orice interpretare trebuie
            verificată la textul original (sub-fila „📖 Vizualizare”).
            """
        )

# -------------------------------------------------------
# FOOTER
# -------------------------------------------------------

st.divider()

st.caption(
    """
    Mühimme Defterleri — instrument de cercetare istorică, rezultat final al
    comunicării științifice „Metode digitale în cercetarea surselor din
    arhivele otomane: cazul Mühimme Defterleri”. Analiza cantitativă și
    vizualizarea completează, nu înlocuiesc, critica sursei și cercetarea
    arhivistică.
    """
)
