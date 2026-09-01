"""Read-only API resource routing, independent from the HTTP handler class."""


def readonly(path, ctx):
    """Return (status, payload) for a known read endpoint, or None for static fallback."""
    if path == "/api/state":
        return 200, ctx["get_state"]()
    if path.startswith("/api/runs/"):
        run_id = path.rsplit("/", 1)[-1]
        run = next((item for item in ctx["load_db"]().get("runs", []) if item.get("id") == run_id), None)
        return (200, {"run": run}) if run else (404, {"error": "run not found"})
    if path.startswith("/api/jobs/"):
        job_id = path.rsplit("/", 1)[-1]
        with ctx["jobs_lock"]:
            job = ctx["jobs"].get(job_id)
        return (200, job) if job else (404, {"error": "job not found"})
    if path.startswith("/api/investigations/"):
        parts = path.split("/")
        inv_id = parts[3] if len(parts) > 3 else ""
        db = ctx["load_db"]()
        if path.endswith("/report"):
            report = ctx["markdown_report"](inv_id)
            return (200, {"markdown": report}) if report else (404, {"error": "not found"})
        inv = ctx["find_inv"](db, inv_id)
        if not inv:
            return 404, {"error": "not found"}
        runs = [run for run in db.get("runs", []) if run.get("investigation_id") == inv_id]
        if path.endswith("/history"):
            return 200, {"history": ctx["fingerprint_history"](db, inv_id)}
        if path.endswith("/compare"):
            return 200, {"dimensions": ctx["compare_dimensions"](runs), "runs": len(runs)}
        if path.endswith("/repro-bundle"):
            return 200, ctx["repro_bundle"](inv, runs, db)
        if path.endswith("/ci-summary"):
            return 200, ctx["ci_summary"](inv, runs, db)
        if path.endswith("/experiments"):
            return 200, {"experiments": [item for item in db.get("experiments", []) if item.get("investigation_id") == inv_id]}
        if path.endswith("/assist"):
            return 200, ctx["explain"](inv, runs)
    return None
