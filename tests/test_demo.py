import json

import pytest


def J(value):
    return json.dumps(value, ensure_ascii=False)


def test_the_demo_pool_is_fixed_and_uses_only_known_labels(js):
    pool = js("demoPool()")
    assert pool == js("demoPool()")
    assert len(pool) == 36 and len({p["key"] for p in pool}) == 36
    known = set(js("[...allLabelIds()]"))
    assert all(it["id"] in known for p in pool for it in p["items"])


def test_three_named_fictitious_researchers_are_produced(js):
    sets = js("demoSets(demoPool())")
    assert [s["name"] for s in sets] == ["Demonstrativ A fictiv", "Demonstrativ B fictiv", "Demonstrativ C fictiv"]
    assert all(len(s["items"]) == 36 for s in sets)


def test_demo_data_is_deterministic(js):
    assert js("demoSets(demoPool())") == js("demoSets(demoPool())")


def test_demo_verdicts_give_a_realistic_mix_of_agreement(js):
    result = js("compareAnnotators(demoSets(demoPool()))")
    ratio = result["agree"] / result["judged"]
    assert result["judged"] > 50
    assert 0.4 < ratio < 0.95
    assert len(result["byLabel"]) >= 8
    assert result["disagreements"]


def test_every_demo_researcher_has_a_precision_between_zero_and_one(js):
    for i in range(3):
        rows = js(f"accuracyByLabel(demoSets(demoPool())[{i}].items)")
        precisions = [r["precision"] for r in rows if r["precision"] is not None]
        assert precisions and all(0 <= p <= 1 for p in precisions)


def test_the_demo_survives_a_trip_through_an_exported_file(js):
    items = js("demoSets(demoPool())[2].items")
    again = js(f"sanitizeAnnotations(JSON.parse({J(json.dumps(items))}))")
    assert again == items


def test_a_demo_pool_can_be_built_from_a_real_volume_shape(js):
    pool = [{"key": "v#1#1", "items": [{"id": "f:Kili (Chilia)", "strong": True}, {"id": "r:Eflak (Țara Românească)", "strong": False}]}]
    sets = js(f"demoSets({J(pool)})")
    first = sets[0]["items"]["v#1#1"]["verdicts"]
    assert first == {"f:Kili (Chilia)": "ok", "r:Eflak (Țara Românească)": "no"}
