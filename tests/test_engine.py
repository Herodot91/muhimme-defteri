import json

import pytest


def matches(js, term, text):
    return js(f"matchesTerm({json.dumps(term)}, {json.dumps(text)})")


# --- Kili: whole-word, strict dotted i -------------------------------------

@pytest.mark.regression
@pytest.mark.parametrize("text", [
    "Kili kalesi muhafazası",
    "Kili'ye gönderildi",
    "KİLİ kalesi",
    "Kilî kalesi",
    "Silistre ve Hırsova ve Kili ve Brayıl kadıları",
])
def test_kili_matches_the_fortress(js, text):
    assert matches(js, "kili", text)


@pytest.mark.regression
@pytest.mark.parametrize("text", [
    "kilise yapıldı",
    "Kırkkilise beyine",
    "kırkkilisenin kadısı",
    "Azaz ve Kilis Beyi",
    "kılıç ile",
    "kılınup",
    "vekîli",
    "çekilip",
    "tenkili",
])
def test_kili_ignores_look_alike_words(js, text):
    assert not matches(js, "kili", text)


# --- other terms keep their flexible matching ------------------------------

@pytest.mark.parametrize("term,text", [
    ("eflak", "Eflâk'e gönderildi"),
    ("bogdan", "Bo ğ dan voyvodası"),
    ("bogdan", "Boğdan"),
    ("erdel", "Erdel kralı"),
    ("akkerman", "Akkerman Kalesi"),
    ("bender", "Bender'e yetişürler"),
    ("silistre", "Silistre sancağı"),
    ("teshir", "feth u teshîr"),
])
def test_flexible_terms_still_match_diacritic_variants(js, term, text):
    assert matches(js, term, text)


@pytest.mark.parametrize("term,text", [
    ("eflak", "Boğdan voyvodası"),
    ("akkerman", "Kili kalesi"),
    ("erdel", "Eflâk voyvodası"),
])
def test_flexible_terms_do_not_match_other_places(js, term, text):
    assert not matches(js, term, text)


# --- the Anexare / Istimalet theme -----------------------------------------

def themes_for(js, summary):
    pages = ["ÖZET VE TRANSKRİPSİYON 1", f"1 Eflâk voyvodasına: {summary} Yazıldı. metin"]
    entries = js(f"parseEntries({json.dumps(pages)}, 'test.pdf')")
    assert len(entries) == 1
    return entries[0]["themes"]


@pytest.mark.parametrize("summary", [
    "Memleketin feth u teshîr olunması hakkında.",
    "Reâyâya istimâlet gösterilmesi hakkında.",
    "Kalenin istîlâ edilmesi hakkında.",
])
def test_annexation_theme_detected(js, summary):
    assert "Anexare / Istimalet" in themes_for(js, summary)


@pytest.mark.regression
@pytest.mark.parametrize("summary", [
    "Cami suyunun ilhak olunan akçe hesabı hakkında.",
    "Fesat ehlini himaye etmeyüp ele getirmeleri hakkında.",
])
def test_annexation_theme_ignores_generic_ilhak_and_himaye(js, summary):
    assert "Anexare / Istimalet" not in themes_for(js, summary)


# --- entry parsing ----------------------------------------------------------

PAGES = [
    "Mühimme Defteri 966-968 / 1558-1560",
    "ÖZET VE TRANSKRİPSİYON 1\n"
    "1 Eflâk voyvodasına: Eflâk ve Kili kalesinin tamiri hakkında. Yazıldı. Kılıç ve kilise.\n"
    "2 Bo ğ dan voyvodasına: Boğdan ve Akkerman muhafazası hakkında. Yazıldı. sene 967 metin.\n"
    "3 Çorum beyine: Kılıç ve kilise hakkında. Yazıldı. metin.",
]


def test_parse_entries_splits_and_classifies(js):
    entries = js(f"parseEntries({json.dumps(PAGES)}, 'v.pdf')")
    assert [e["num"] for e in entries] == ["1", "2", "3"]
    assert entries[0]["regions"] == ["Eflak (Țara Românească)"]
    assert entries[0]["fortresses"] == ["Kili (Chilia)"]
    assert "Akkerman (Cetatea Albă)" in entries[1]["fortresses"]
    assert entries[2]["regions"] == [] and entries[2]["fortresses"] == []


@pytest.mark.regression
def test_parse_entries_does_not_count_kilic_or_kilise_as_kili(js):
    entries = js(f"parseEntries({json.dumps(PAGES)}, 'v.pdf')")
    assert entries[2]["fortresses"] == []


def test_entries_keep_summary_apart_from_ottoman_text(js):
    entries = js(f"parseEntries({json.dumps(PAGES)}, 'v.pdf')")
    assert entries[0]["summary"].endswith("tamiri hakkında.")
    assert entries[0]["fullText"].startswith("Yazıldı")


def test_bogus_hukum_ki_headers_are_not_entries(js):
    pages = ["ÖZET VE TRANSKRİPSİYON 1", "1 Eflâk voyvodasına: Eflâk hakkında. Yazıldı. metin 2 Kadı'ya hüküm ki: bir şey."]
    entries = js(f"parseEntries({json.dumps(pages)}, 'v.pdf')")
    assert len(entries) == 1


# --- period and year detection ---------------------------------------------

def test_detect_period_reads_hijri_and_gregorian_range(js):
    period = js(f"detectPeriod({json.dumps(PAGES)})")
    assert period["hijriStart"] == 966 and period["gregStart"] == 1558
    assert period["gregEnd"] == 1560
    assert period["centuryRoman"] == "XVI"


def test_detect_period_returns_none_without_a_title_page_range(js):
    assert js("detectPeriod(['nimic aici', 'niciun an'])") is None


def test_attach_years_follows_the_latest_hijri_year(js):
    expr = (
        "(() => { const es = parseEntries(" + json.dumps(PAGES) + ", 'v.pdf');"
        f"attachYears(es, detectPeriod({json.dumps(PAGES)}));"
        " return es.map(e => e.year); })()"
    )
    assert js(expr) == [1558, 1559, 1559]
