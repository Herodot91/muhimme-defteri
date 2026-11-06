import json

import pytest


def J(value):
    return json.dumps(value, ensure_ascii=False)


def graph(js, nodes, edges, center="null"):
    return js(f"buildGraphData({J(nodes)}, {J(edges)}, {center})")


def test_nodes_carry_weight_degree_and_kind(js):
    nodes = {"Poarta Otomană (Sultan)": 10, "Eflak voyvodasına": 6, "Kadı": 4}
    edges = {"Poarta Otomană (Sultan)§§Eflak voyvodasına": 6, "Poarta Otomană (Sultan)§§Kadı": 4}
    g = graph(js, nodes, edges, J("Poarta Otomană (Sultan)"))
    by = {n["id"]: n for n in g["nodes"]}
    assert by["Poarta Otomană (Sultan)"]["kind"] == "center" and by["Poarta Otomană (Sultan)"]["degree"] == 2
    assert by["Eflak voyvodasına"]["kind"] == "recipient" and by["Eflak voyvodasına"]["weight"] == 6
    assert by["Kadı"]["degree"] == 1


def test_regions_and_fortresses_get_their_own_kinds(js):
    nodes = {"Eflak (Țara Românească)": 5, "Kili (Chilia)": 3}
    g = graph(js, nodes, {"Eflak (Țara Românească)§§Kili (Chilia)": 2})
    kinds = {n["id"]: n["kind"] for n in g["nodes"]}
    assert kinds == {"Eflak (Țara Românească)": "region", "Kili (Chilia)": "fortress"}
    assert g["links"] == [{"source": "Eflak (Țara Românească)", "target": "Kili (Chilia)", "weight": 2}]


def test_links_to_unknown_nodes_and_self_links_are_dropped(js):
    nodes = {"A": 1, "B": 1}
    edges = {"A§§B": 3, "A§§C": 1, "B§§B": 2}
    g = graph(js, nodes, edges)
    assert g["links"] == [{"source": "A", "target": "B", "weight": 3}]
    assert {n["id"]: n["degree"] for n in g["nodes"]} == {"A": 1, "B": 1}


def test_an_empty_network_is_empty(js):
    g = graph(js, {}, {})
    assert g == {"nodes": [], "links": []}
