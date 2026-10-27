import json
import subprocess
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parent.parent / "engine.js"


def run_js(expression):
    """Evaluate a JS expression with engine.js loaded and return it as parsed JSON."""
    script = ENGINE.read_text(encoding="utf-8") + (
        "\n;process.stdout.write(JSON.stringify(" + expression + "));"
    )
    result = subprocess.run(
        ["node", "-"], input=script, capture_output=True, text=True, encoding="utf-8", timeout=30
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)


@pytest.fixture(scope="session")
def js():
    return run_js


def pytest_configure(config):
    config.addinivalue_line("markers", "regression: guards a bug found while testing the real volume")
