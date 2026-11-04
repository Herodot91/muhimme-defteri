import json

import pytest


def J(value):
    return json.dumps(value, ensure_ascii=False)


def entry(n, text, page=39):
    """One contents line as OCR returns it: wrapped summary, garbled dotted leader, page."""
    return f"{n} {text}\n\n" + "araştırılması" if False else f"{n} {text} .......rre A AA AAA {page}"


def make_pages():
    """Three OCR'd contents pages with the kinds of noise seen in the real volume."""
    lines = ["İÇİNDEKİLER", "I. BÖLÜM"]
    lines += [entry(1, "Gebze'nin Çerkeşli köyü yakınında iki çobanın öldürülmesi olayının\n\naraştırılması")]
    lines += [entry(2, "Eflak voyvodasının Kili Kalesi müstahfızlarına gönderdiği erzakın verilmesi")]
    lines += [entry(3, "Bender Kalesi'ndeki dizdarın azli")]
    lines += [entry(4, "Basra benderine gelen gemilerin vergisinin toplanması")]
    lines += [entry(5, "Kilise vakfının gelirlerinin tahsil edilmesi")]
    lines += [entry(6, "Boğdan voyvodasına nâme-i hümâyun gönderilmesi")]
    lines += [entry(7, "Silistre sancağı beyinin görevden alınması")]
    lines += [entry(8, "Erdel kralının elçisinin kabul edilmesi")]
    page1 = "\n\n".join(lines)

    lines = []
    lines += [entry(9, "Akkirman kalesinin tamiri için malzeme gönderilmesi")]
    lines += [entry(10, "Rakka valilerinin emirlere aykırı uygulamaları")]
    lines += ["ll Hacı Hüseyin isimli tacirin alacağının tahsil edilmesi .......... 41"]
    lines += [entry(12, "Kütahya sancağında timar bedelinin toplanması")]
    # 13 was lost by OCR; 14 follows
    lines += [entry(14, "Karaman beylerbeyine sefer emri verilmesi")]
    lines += [entry(15, "Tasnif sırasında Defter'deki hüküm kayıtları numaralandırılırken sehven bu numara atlandığından, hüküm kaydı bulunmamaktadır")]
    lines += [entry(16, "Hotin Kalesi'nin muhafazası")]
    lines += ["71 Bender'e gönderilen zahirenin teslim alınması .......... 44"]  # OCR read 17 as 71
    lines += [entry(18, "Sakız adasının defterinin gönderilmesi")]
    lines += [entry(19, "Eğriboz kadısının teftiş edilmesi")]
    page2 = "\n\n".join(lines)

    lines = []
    lines += ["20-29 Tasnif sırasında Defter'deki hüküm kayıtları numaralandırılırken sehven bu numaralar atlandığından, bu numaralara tekabül eden hiçbir hüküm kaydı bulunmamaktadır .......... 46"]
    lines += [entry(30, "Mısır beylerbeyine hazine gönderilmesi")]
    lines += [entry(31, "Şam kadısına emir yazılması")]
    lines += [entry(32, "Halep defterdarının görevden alınması")]
    lines += [entry(33, "Bağdad valisine ferman")]
    lines += [entry(34, "Diyarbekir beylerbeyine sefer hazırlığı")]
    lines += [entry(35, "Van kalesinin tamiri")]
    lines += [entry(36, "Kars sancağının zeametleri")]
    lines += [entry(37, "Erzurum beylerbeyine zahire emri")]
    page3 = "\n\n".join(lines)
    return ["91 NUMARALI MÜHİMME DEFTERİ ( H. 1056 / M. 1646-1647 )", "", "", "", page1, page2, page3, "", "gövde metin"]


@pytest.fixture()
def parsed(js):
    pages = make_pages()
    return js(f"(() => {{ const e = parseContentsList({J(pages)}, 'v91.pdf'); return {{ stats: e.stats, entries: e }}; }})()")


def test_detects_a_contents_list(js):
    assert js(f"isContentsList({J(make_pages())})") is True
    assert js(f"isContentsList({J(make_pages()[:5])})") is False  # one page of entries is not a list
    assert js(f"isContentsList({J(['text normal', 'fără cuprins'])})") is False


def test_every_real_entry_is_found_in_order(parsed):
    nums = [int(e["num"]) for e in parsed["entries"]]
    assert nums == sorted(nums)
    assert 1 in nums and 14 in nums and 37 in nums


def test_ocr_garbled_numbers_are_recovered(parsed):
    nums = [e["num"] for e in parsed["entries"]]
    assert "11" in nums  # "ll" read as eleven
    seventeen = next(e for e in parsed["entries"] if e["num"] == "17")
    assert seventeen["summary"].startswith("Bender'e gönderilen zahirenin")  # "71" read as seventeen


def test_a_line_lost_by_ocr_is_reported_not_invented(parsed):
    assert parsed["stats"]["missing"] == [13]
    assert "13" not in [e["num"] for e in parsed["entries"]]


def test_skipped_numbers_are_notes_not_entries(parsed):
    nums = [e["num"] for e in parsed["entries"]]
    assert "15" not in nums
    assert not any(str(n) in nums for n in range(20, 30))
    assert 15 in parsed["stats"]["notes"] and 20 in parsed["stats"]["notes"]


def test_dotted_leaders_and_page_numbers_are_cut_from_summaries(parsed):
    first = parsed["entries"][0]
    assert first["summary"] == "Gebze'nin Çerkeşli köyü yakınında iki çobanın öldürülmesi olayının araştırılması"
    assert first["bookPage"] == 39
    assert first["recipient"] == "" and first["format"] == "icindekiler" and first["fullText"] == ""


def test_summaries_are_classified_with_the_same_rules(parsed):
    by = {e["num"]: e for e in parsed["entries"]}
    assert by["2"]["regions"] == ["Eflak (Țara Românească)"] and by["2"]["fortresses"] == ["Kili (Chilia)"]
    assert by["3"]["fortresses"] == ["Bender (Tighina)"]
    assert by["4"]["fortresses"] == []          # benderine = port
    assert by["5"]["fortresses"] == []          # Kilise = church
    assert by["6"]["regions"] == ["Boğdan (Moldova)"]
    assert by["9"]["fortresses"] == ["Akkerman (Cetatea Albă)"]
    assert by["16"]["fortresses"] == ["Hotin (Khotyn)"]


def test_the_period_is_read_from_the_ocr_of_the_cover(js):
    p = js(f"detectPeriod({J(make_pages())})")
    assert (p["hijriStart"], p["gregStart"], p["gregEnd"], p["centuryRoman"]) == (1056, 1646, 1647, "XVII")


@pytest.mark.parametrize("token,expected", [("11", 11), ("ll", 11), ("S", 5), ("1O", 10), ("12", 12), ("AB", None), ("2x", None)])
def test_map_ocr_digits(js, token, expected):
    assert js(f"mapOcrDigits({J(token)})") == expected


def test_entry_text_of_contents_entries_is_the_summary(js):
    assert js("entryText({format:'icindekiler', recipient:'', summary:'Eflak taraflarında', fullText:''})") == "Eflak taraflarında"
