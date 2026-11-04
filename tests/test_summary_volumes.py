import json

import pytest


def J(value):
    return json.dumps(value, ensure_ascii=False)


# A small "Özet ve İndeks" volume: title page, two body pages, then the index.
TITLE = "T.C.\nBAŞBAKANLIK\n5 NUMARALI MÜHİMME DEFTERİ\n(973 / 1565–1566)\n< Özet ve İndeks >"

PAGE_A = """ÖZETLER  11
Budun beylerbeyine
Sakmar Kalesi'ndeki kuşatma hakkında gönderdiği mektubunun alındığı; Erdel'den
çekilinceye kadar harekete kalkışılmaması.
Sol Ulûfeciler ağasına, Sağ Garib Yiğitler ağasına ve Çirmen Beyi Süleyman
Bey'e
Daha önce kendilerine Sirem'e gitmeleri emrolunduğu halde Semendire'ye gidip
beklemeleri.
* Hükmün sonunda bir kayıt vardır.
11 Muharrem 973  (8 Ağustos 1565)
Erdel Kralı İstefan'a nâme-i hümâyun
Beç elçisinin vazgeçtiğini bildirmesi üzerine krala nâme gönderildiği;
askerin hazır tutulması.
Fener kadısına
Kapanış tarihi belli olmadığından pazargâhın kapanış tarihinin
54
55
56
57
"""

PAGE_B = """12 5 NUMARALI MÜHİ MME DEFTER İ
belirlenmesi.
Selh-i Muharrem 973  (27 Ağustos 1565)
Boğdan voyvodasına
Boğdan'dan kaçan eşkıyanın yakalanması; Basra benderine gidilmemesi.
58
"""

INDEX = """İ NDEKS  331
Boğdan (vilâyeti) : 27, 74, 83;
— voyvodası : 20, 25
Eflâk : 12, 13
bender : 500
Bender (Tighina) : 700
"""


def volume(js_expr):
    return js(js_expr)


@pytest.fixture()
def parsed(js):
    pages = [TITLE, PAGE_A, PAGE_B]
    return js(f"(() => {{ const e = parseSummaryVolume({J(pages)}, 'v5.pdf'); return {{ stats: e.stats, entries: e }}; }})()")


def test_numbers_come_from_the_page_number_lists(parsed):
    assert [e["num"] for e in parsed["entries"]] == ["54", "55", "56", "57", "58"]
    assert parsed["stats"]["misaligned"] == 0


def test_footnotes_are_not_entries(parsed):
    assert not any("Hükmün sonunda" in e["summary"] for e in parsed["entries"])


def test_recipient_can_wrap_over_two_lines(parsed):
    sol = parsed["entries"][1]
    assert sol["recipient"] == "Sol Ulûfeciler ağasına, Sağ Garib Yiğitler ağasına ve Çirmen Beyi Süleyman Bey'e"
    assert sol["summary"].startswith("Daha önce kendilerine")


def test_an_order_can_continue_on_the_next_page(parsed):
    fener = parsed["entries"][3]
    assert fener["recipient"] == "Fener kadısına"
    assert fener["summary"].endswith("belirlenmesi.")
    assert fener["page"] == 2


def test_exact_dates_apply_to_the_orders_that_follow(parsed):
    entries = parsed["entries"]
    assert entries[2]["year"] == 1565 and entries[2]["dateText"].startswith("11 Muharrem 973")
    assert entries[4]["dateText"].startswith("Selh-i Muharrem 973")
    assert entries[4]["hicriYear"] == 973
    assert entries[0]["year"] is None


def test_recipient_text_is_classified_as_well(parsed):
    erdel = parsed["entries"][2]
    assert erdel["regions"] == ["Erdel (Ardeal / Transilvania)"]
    assert parsed["entries"][4]["regions"] == ["Boğdan (Moldova)"]


def test_summary_volumes_have_no_ottoman_text(parsed):
    assert all(e["fullText"] == "" and e["format"] == "ozet" for e in parsed["entries"])


def test_entry_text_includes_the_recipient_for_summary_volumes(js):
    assert js("entryText({format:'ozet', recipient:'Boğdan voyvodasına', summary:'x', fullText:''})") == "Boğdan voyvodasına x"
    assert js("entryText({summary:'s', fullText:'t'})") == "s t"


def test_a_page_with_the_wrong_unit_count_is_repaired_from_its_number_list(js):
    # the first summary has no final period, so it would merge with the next order
    page = """ÖZETLER  11
Budun beylerbeyine
Sakmar Kalesi'ndeki kuşatma hakkında gönderdiği mektubunun alındığı ve gerekenin yapılması
Semendire beyine
Belgrad Kalesi'nin tamir edilmesi.
54
55
"""
    entries = js(f"parseSummaryVolume({J([TITLE, page])}, 'v')")
    assert [e["recipient"] for e in entries] == ["Budun beylerbeyine", "Semendire beyine"]
    assert [e["num"] for e in entries] == ["54", "55"]


# --- format detection ---------------------------------------------------------

def test_detects_the_three_kinds_of_volume(js):
    ozet = [TITLE] + [PAGE_A.replace("11", str(i)) for i in range(12)]
    assert js(f"detectVolumeFormat({J(ozet)})") == "ozet"
    assert js(f"detectVolumeFormat({J(['ÖZET VE TRANSKRİPSİYON 1', 'metin'])})") == "transkripsiyon"
    assert js(f"detectVolumeFormat({J([''] * 40)})") == "scanned"


def test_parse_volume_picks_the_parser_by_format(js):
    ozet = [TITLE] + [PAGE_A] * 11
    assert js(f"parseVolume({J(ozet)}, 'v')[0].format") == "ozet"
    transk = ["ÖZET VE TRANSKRİPSİYON 1\n1 Eflâk voyvodasına: Eflâk hakkında. Yazıldı. metin"]
    assert js(f"parseVolume({J(transk)}, 'v')[0].format ?? null") is None


# --- title-page periods -------------------------------------------------------

def test_period_with_a_single_hijri_year(js):
    p = js(f"detectPeriod({J([TITLE])})")
    assert (p["hijriStart"], p["hijriEnd"], p["gregStart"], p["gregEnd"], p["centuryRoman"]) == (973, 973, 1565, 1566, "XVI")


def test_period_written_h_and_m(js):
    p = js(f"detectPeriod({J(['91 NUMARALI MÜHİMME DEFTERİ\\n( H. 1056 / M. 1646-1647 )'])})")
    assert (p["hijriStart"], p["gregStart"], p["gregEnd"], p["centuryRoman"]) == (1056, 1646, 1647, "XVII")


def test_original_period_form_still_works(js):
    p = js(f"detectPeriod({J(['(966-968 / 1558-1560)'])})")
    assert (p["hijriStart"], p["hijriEnd"], p["gregStart"], p["gregEnd"]) == (966, 968, 1558, 1560)


def test_years_of_summary_volumes_are_not_overwritten(js):
    expr = ("(() => { const es = parseSummaryVolume(" + J([TITLE, PAGE_A, PAGE_B]) + ", 'v');"
            f"attachYears(es, detectPeriod({J([TITLE])})); return es.map(e => e.year); }})()")
    assert js(expr) == [1565, 1565, 1565, 1565, 1565]


# --- printed index ------------------------------------------------------------

def test_index_entries_collect_numbers_including_sub_entries(js):
    pages = [TITLE, INDEX]
    nums = js(f"[...indexNumbersFor(parseIndexEntries({J(pages)}), ['bogdan'])].sort((a, b) => a - b)")
    assert nums == [20, 25, 27, 74, 83]


def test_lower_case_index_heads_are_not_places(js):
    pages = [TITLE, INDEX]
    assert js(f"[...indexNumbersFor(parseIndexEntries({J(pages)}), ['bender'])]") == [700]


def test_compare_with_index_reports_recall_and_the_missed_numbers(js):
    entries = [
        {"num": "56", "regions": ["Erdel (Ardeal / Transilvania)"], "fortresses": []},
        {"num": "57", "regions": [], "fortresses": []},
    ]
    index = "İ NDEKS  331\nErdel : 56, 57, 999\n"
    rows = js(f"compareWithIndex({J(entries)}, parseIndexEntries({J([TITLE, index])}))")
    erdel = next(r for r in rows if r["label"].startswith("Erdel"))
    assert (erdel["gold"], erdel["found"]) == (3, 1)
    assert erdel["missed"] == [57, 999]
    assert erdel["recall"] == pytest.approx(1 / 3)


def test_registry_index_names_use_the_ottoman_forms(js):
    assert js("registryIndexNames('Akkerman (Cetatea Albă)')") == ["akkerman", "akkirman"]
    assert js("registryIndexNames('Eflak (Țara Românească)')") == ["eflak"]


# --- Bender: the fortress, not the Persian word for a port ---------------------

@pytest.mark.regression
@pytest.mark.parametrize("text", ["Bender Kalesi'nde bir ev", "Bender'e yetişürler", "Bender sancağı beyi"])
def test_bender_fortress_is_found(js, text):
    assert js(f"classifyText({J(text)})")["fortresses"] == ["Bender (Tighina)"]


@pytest.mark.regression
@pytest.mark.parametrize("text", [
    "Basra benderine cüz’î kimesne", "Katîf benderi bi'l-külliyye", "Bender -i Şihr ve Hadralmûd",
    "Bender-i Kili İskelesi'nde satılan", "Benderli zimmî", "benderlerinde gezüp",
])
def test_bender_port_senses_are_not_the_fortress(js, text):
    assert "Bender (Tighina)" not in js(f"classifyText({J(text)})")["fortresses"]


def test_dates_with_spaces_around_the_hyphen_are_still_dates(js):
    page = """ÖZETLER  11
Budun beylerbeyine
Kalenin tamir edilmesi.
Selh - i Muharrem 973 (27 Ağustos 1565)
Boğdan voyvodasına
Eşkıyanın yakalanması.
54
55
"""
    entries = js(f"parseSummaryVolume({J([TITLE, page])}, 'v')")
    assert [e["recipient"] for e in entries] == ["Budun beylerbeyine", "Boğdan voyvodasına"]
    assert entries[1]["year"] == 1565 and entries[1]["hicriYear"] == 973
