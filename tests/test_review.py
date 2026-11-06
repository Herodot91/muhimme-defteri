import json

import pytest


def J(value):
    return json.dumps(value, ensure_ascii=False)


# --- evidence ---------------------------------------------------------------

def test_classify_text_records_the_term_and_position(js):
    text = "kal‘a-i Kili ve Akkerman ve Bender'e yetişürler"
    result = js(f"classifyText({J(text)})")
    assert result["fortresses"] == ["Kili (Chilia)", "Akkerman (Cetatea Albă)", "Bender (Tighina)"]
    kili = next(e for e in result["evidence"] if e["label"] == "Kili (Chilia)")
    assert kili["match"] == "Kili" and kili["wholeWord"] is True
    assert text[kili["index"]:kili["index"] + 4] == "Kili"


def test_inflected_form_with_apostrophe_is_a_whole_word(js):
    ev = js(f"classifyText({J('Eflâk’e gönderildi')})")["evidence"]
    assert ev[0]["label"].startswith("Eflak") and ev[0]["wholeWord"] is True


def test_term_glued_to_letters_is_flagged_as_partial(js):
    ev = js(f"classifyText({J('Eflake gönderildi')})")["evidence"]
    assert ev[0]["wholeWord"] is False


def test_whole_word_occurrence_is_preferred_over_an_earlier_partial_one(js):
    ev = js(f"classifyText({J('Eflake yazıldı. Sonra Eflâk’e gönderildi.')})")["evidence"]
    region = next(e for e in ev if e["kind"] == "regions")
    assert region["wholeWord"] is True


@pytest.mark.regression
@pytest.mark.parametrize("text", ["kilise yapıldı", "Kırkkilise beyine", "Kilis beyi", "kılıç ile"])
def test_classify_text_does_not_report_kili_for_lookalikes(js, text):
    assert js(f"classifyText({J(text)})")["fortresses"] == []


def test_akkirman_spelling_is_found(js):
    assert js(f"classifyText({J('Akkirman kalesi')})")["fortresses"] == ["Akkerman (Cetatea Albă)"]


# --- name register ----------------------------------------------------------

def test_register_drives_the_search_terms(js):
    assert js("Object.keys(REGION_TERMS)") == ["Eflak (Țara Românească)", "Boğdan (Moldova)", "Erdel (Ardeal / Transilvania)"]
    assert js("Object.keys(FORTRESS_TERMS)") == [
        "Kili (Chilia)", "Akkerman (Cetatea Albă)", "Yedikule", "Bender (Tighina)", "Hotin (Khotyn)", "Silistre"]


def test_every_register_entry_documents_its_own_names(js):
    entries = js("NAME_REGISTRY")
    assert all(p["names"] and p["terms"] for p in entries)


def test_custom_variant_extends_matching_without_changing_the_register(js):
    extra = {"Kili (Chilia)": ["kilia"]}
    assert js(f"classifyText('Kilia kalesi', {J(extra)})")["fortresses"] == ["Kili (Chilia)"]
    assert js("classifyText('Kilia kalesi')")["fortresses"] == []


@pytest.mark.parametrize("raw,expected", [
    ("Kilia", "kilia"),
    ("  Cetatea Albă ", "cetatea alba"),
    ("Ak kirman", "ak kirman"),
    ("ab", None),
    ("kili123", None),
    ("<script>", None),
    ("", None),
])
def test_normalize_variant(js, raw, expected):
    assert js(f"normalizeVariant({J(raw)})") == expected


# --- corrections ------------------------------------------------------------

AUTO = {"regions": ["Eflak (Țara Românească)"], "fortresses": ["Kili (Chilia)"], "themes": ["Comerț"]}


def test_effective_labels_without_annotation_equal_the_automatic_ones(js):
    assert js(f"effectiveLabels({J(AUTO)}, null)") == AUTO


def test_rejected_label_is_removed_and_added_label_is_included(js):
    ann = {"verdicts": {"f:Kili (Chilia)": "no", "r:Eflak (Țara Românească)": "ok"},
           "added": {"regions": [], "fortresses": ["Bender (Tighina)"], "themes": []}}
    eff = js(f"effectiveLabels({J(AUTO)}, {J(ann)})")
    assert eff["fortresses"] == ["Bender (Tighina)"]
    assert eff["regions"] == ["Eflak (Țara Românească)"]
    assert eff["themes"] == ["Comerț"]


def test_added_label_already_present_is_not_duplicated(js):
    ann = {"verdicts": {}, "added": {"regions": ["Eflak (Țara Românească)"], "fortresses": [], "themes": []}}
    assert js(f"effectiveLabels({J(AUTO)}, {J(ann)})")["regions"] == ["Eflak (Țara Românească)"]


def test_sanitize_drops_unknown_labels_and_dangerous_keys(js):
    raw = {
        "v#1#1": {"verdicts": {"f:Kili (Chilia)": "no", "f:Inventat": "no", "r:Eflak (Țara Românească)": "poate"},
                  "added": {"regions": ["Boğdan (Moldova)", "Nicăieri"], "fortresses": [], "themes": []}, "note": "x" * 600},
        "constructor": {"verdicts": {"f:Kili (Chilia)": "ok"}},
        "v#2#2": "nu este un obiect",
    }
    clean = js(f"sanitizeAnnotations(JSON.parse({J(json.dumps(raw))}))")
    assert list(clean) == ["v#1#1"]
    item = clean["v#1#1"]
    assert item["verdicts"] == {"f:Kili (Chilia)": "no"}
    assert item["added"]["regions"] == ["Boğdan (Moldova)"]
    assert len(item["note"]) == 500


def test_sanitize_ignores_proto_key_from_json(js):
    payload = '{"__proto__": {"verdicts": {"f:Kili (Chilia)": "no"}}, "k#1#1": {"note": "ok"}}'
    clean = js(f"sanitizeAnnotations(JSON.parse({J(payload)}))")
    assert list(clean) == ["k#1#1"]


# --- comparing researchers --------------------------------------------------

def test_compare_counts_agreement_and_lists_disagreements(js):
    a = {"e1": {"verdicts": {"f:Kili (Chilia)": "ok", "r:Eflak (Țara Românească)": "no"}, "added": {}},
         "e2": {"verdicts": {"f:Kili (Chilia)": "no"}, "added": {}}}
    b = {"e1": {"verdicts": {"f:Kili (Chilia)": "ok", "r:Eflak (Țara Românească)": "ok"}, "added": {}},
         "e3": {"verdicts": {"f:Kili (Chilia)": "ok"}, "added": {}}}
    result = js(f"compareAnnotators([{{name:'A',items:{J(a)}}},{{name:'B',items:{J(b)}}}])")
    assert result["judged"] == 2
    assert result["agree"] == 1
    assert len(result["disagreements"]) == 1
    row = result["disagreements"][0]
    assert row["key"] == "e1" and row["id"] == "r:Eflak (Țara Românească)"
    assert row["verdicts"] == ["no", "ok"]


def test_added_label_counts_as_agreement_with_a_confirmation(js):
    a = {"e1": {"verdicts": {"f:Kili (Chilia)": "ok"}, "added": {}}}
    b = {"e1": {"verdicts": {}, "added": {"fortresses": ["Kili (Chilia)"]}}}
    result = js(f"compareAnnotators([{{name:'A',items:{J(a)}}},{{name:'B',items:{J(b)}}}])")
    assert result["judged"] == 1 and result["agree"] == 1


# --- accuracy ---------------------------------------------------------------

def test_accuracy_by_label_reports_precision_and_recall(js):
    items = {
        "e1": {"verdicts": {"f:Kili (Chilia)": "ok"}, "added": {}},
        "e2": {"verdicts": {"f:Kili (Chilia)": "ok"}, "added": {}},
        "e3": {"verdicts": {"f:Kili (Chilia)": "no"}, "added": {}},
        "e4": {"verdicts": {}, "added": {"fortresses": ["Kili (Chilia)"]}},
    }
    rows = js(f"accuracyByLabel({J(items)})")
    kili = next(r for r in rows if r["id"] == "f:Kili (Chilia)")
    assert (kili["ok"], kili["no"], kili["added"]) == (2, 1, 1)
    assert kili["precision"] == pytest.approx(2 / 3)
    assert kili["recall"] == pytest.approx(2 / 3)


def test_accuracy_is_none_when_nothing_was_judged(js):
    assert js("accuracyByLabel({})") == []


# --- baseline used by the effect panel ---------------------------------------

@pytest.mark.parametrize("text", ["kilise yapıldı", "Kırkkilise beyine", "kılıç ile"])
def test_naive_search_still_counts_the_lookalikes_the_engine_rejects(js, text):
    assert js(f"classifyNaive({J(text)})")["fortresses"] == ["Kili (Chilia)"]
    assert js(f"classifyText({J(text)})")["fortresses"] == []


def test_naive_search_uses_only_the_first_term_of_each_place(js):
    assert js(f"classifyNaive({J('Akkirman kalesi')})")["fortresses"] == []
    assert js(f"classifyText({J('Akkirman kalesi')})")["fortresses"] == ["Akkerman (Cetatea Albă)"]


def test_naive_and_engine_agree_on_plain_mentions(js):
    text = "Eflâk ve Boğdan ve Erdel, Akkerman ve Bender"
    naive = js(f"classifyNaive({J(text)})")
    engine = js(f"classifyText({J(text)})")
    assert naive["regions"] == engine["regions"] and naive["fortresses"] == engine["fortresses"]


# --- numbers for the collaboration report -------------------------------------

def test_agreement_is_reported_per_label(js):
    a = {"e1": {"verdicts": {"f:Kili (Chilia)": "ok", "r:Eflak (Țara Românească)": "no"}, "added": {}},
         "e2": {"verdicts": {"f:Kili (Chilia)": "ok"}, "added": {}}}
    b = {"e1": {"verdicts": {"f:Kili (Chilia)": "ok", "r:Eflak (Țara Românească)": "ok"}, "added": {}},
         "e2": {"verdicts": {"f:Kili (Chilia)": "no"}, "added": {}}}
    result = js(f"compareAnnotators([{{name:'A',items:{J(a)}}},{{name:'B',items:{J(b)}}}])")
    by = {r["id"]: r for r in result["byLabel"]}
    assert by["f:Kili (Chilia)"] == {"id": "f:Kili (Chilia)", "judged": 2, "agree": 1}
    assert by["r:Eflak (Țara Românească)"] == {"id": "r:Eflak (Țara Românească)", "judged": 1, "agree": 0}


def test_annotator_summary_counts_verdicts_added_labels_and_notes(js):
    items = {
        "e1": {"verdicts": {"f:Kili (Chilia)": "ok", "r:Eflak (Țara Românească)": "no"}, "added": {"fortresses": ["Bender (Tighina)"]}, "note": "x"},
        "e2": {"verdicts": {"f:Kili (Chilia)": "ok"}, "added": {}},
    }
    assert js(f"annotatorSummary({J(items)})") == {"ok": 2, "no": 1, "added": 1, "entries": 2, "notes": 1}
    assert js("annotatorSummary({})") == {"ok": 0, "no": 0, "added": 0, "entries": 0, "notes": 0}
