import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("app.py")
spec = importlib.util.spec_from_file_location("fti_app", MODULE_PATH)
fti = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fti)


def failure(inv, started, fp="abc123"):
    return {
        "id": started,
        "investigation_id": inv,
        "status": "failed",
        "fingerprint": fp,
        "signal": "AssertionError: race",
        "started_at": started,
        "concurrency": 4,
        "seed": 42,
        "order": "collected",
        "cwd": "/workspace/demo",
        "stderr": "AssertionError: race",
        "stdout": "",
        "classification": {"kind": "timing_or_race", "label": "时序 / 竞态"},
        "env": {"python": "3.12"},
    }


def test_fingerprint_history_marks_cross_investigation_recurrence():
    db = {"runs": [failure("one", "2026-01-01T00:00:00+00:00"), failure("two", "2026-01-02T00:00:00+00:00")]}
    history = fti.fingerprint_history(db, "one")
    assert history[0]["recurrence"] is True
    assert history[0]["count"] == 2
    assert history[0]["investigations"] == ["one", "two"]


def test_compare_dimensions_reports_failure_rates():
    runs = [failure("one", "1"), {**failure("one", "2"), "status": "passed", "concurrency": 1}]
    comparison = fti.compare_dimensions(runs)
    concurrency = next(item for item in comparison if item["key"] == "concurrency")
    assert {item["value"]: item["rate"] for item in concurrency["values"]} == {"4": 1.0, "1": 0.0}


def test_repro_bundle_contains_evidence_and_reproduction_context():
    inv = {"id": "one", "title": "checkout", "command": "pytest -q", "cwd": "/workspace/demo", "repo": "demo", "framework": "pytest", "notes": ""}
    runs = [failure("one", "2026-01-01T00:00:00+00:00")]
    bundle = fti.repro_bundle(inv, runs, {"runs": runs})
    assert bundle["format"] == "fti-repro-bundle/v1"
    assert bundle["reproduction"]["command"] == "pytest -q"
    assert bundle["evidence"]["failures"] == 1
    assert bundle["evidence"]["history"][0]["fingerprint"] == "abc123"


def test_matrix_variants_validate_and_normalize_values():
    variants = fti.matrix_variants({"dimension": "concurrency", "values": ["1", 4]})
    assert [item["value"] for item in variants] == [1, 4]
    assert variants[1]["label"] == "concurrency=4"
    import pytest
    with pytest.raises(ValueError):
        fti.matrix_variants({"dimension": "concurrency", "values": [1, 1]})


def test_optional_ai_falls_back_to_local_without_key(monkeypatch):
    import ai_assist
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    result = ai_assist.explain({"title": "race", "command": "pytest"}, [failure("one", "1")])
    assert result["provider"] == "local"
    assert result["configured"] is False
    assert result["hypotheses"]
