"""Experiment planning boundary. Execution callbacks remain injectable for tests and adapters."""
from experiments import matrix_variants


def build_repeat_plan(body):
    repeats = max(1, min(100, int(body.get("repeats") or 1)))
    workers = max(1, min(16, int(body.get("concurrency") or 1)))
    return {"repeats": repeats, "workers": workers}


def build_matrix_plan(body):
    variants = matrix_variants(body)
    repeats = max(1, min(30, int(body.get("repeats_per_value") or 3)))
    workers = max(1, min(8, int(body.get("matrix_workers") or 2)))
    return {"variants": variants, "repeats": repeats, "workers": workers, "total": len(variants) * repeats}
