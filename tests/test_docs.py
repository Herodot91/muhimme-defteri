import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def listed_suites():
    text = (ROOT / "explain.js").read_text(encoding="utf-8")
    literal = re.search(r"const TEST_SUITES = (\[.*?\n\]);", text, re.S).group(1)
    out = subprocess.run(["node", "-e", f"process.stdout.write(JSON.stringify({literal}))"],
                         capture_output=True, text=True, encoding="utf-8", timeout=30, check=True)
    return {name: count for name, count, _ in json.loads(out.stdout)}


def test_the_test_counts_in_the_explanation_match_the_real_suite():
    out = subprocess.run([sys.executable, "-m", "pytest", "--collect-only", "-q", str(ROOT / "tests")],
                         capture_output=True, text=True, encoding="utf-8", cwd=ROOT, timeout=120)
    real = Counter(line.split("::")[0].replace("\\", "/").split("/")[-1] for line in out.stdout.splitlines() if "::" in line)
    assert dict(real) == listed_suites()


def test_every_explanation_link_points_to_an_explanation():
    text = (ROOT / "explain.js").read_text(encoding="utf-8")
    block = text[text.index("const EXPLAIN = {"):text.index("function ensureExplainDialog")]
    keys = set(re.findall(r"^  (\w+): \{$", block, re.M))
    used = set()
    for name in ("index.html", "updates.js", "explain.js", "report.js", "app.js"):
        used |= set(re.findall(r'data-explain="(\w+)"', (ROOT / name).read_text(encoding="utf-8")))
    assert used, "no explanation links found"
    assert used <= keys, f"links without an explanation: {sorted(used - keys)}"
