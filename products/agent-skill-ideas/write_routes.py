"""Mutating HTTP routes for investigations, fingerprints, and jobs."""
import os
import uuid

from server_utils import read_json_body


def handle_post(handler, path, ctx):
    if path.startswith("/api/investigations/") and path.endswith("/pollution-bisect"):
        inv_id = path.split("/")[3]
        body = read_json_body(handler)
        db = ctx["load_db"]()
        inv = ctx["find_inv"](db, inv_id)
        if not inv:
            return 404, {"error": "not found"}
        return 200, ctx["pollution_bisect"](inv, body, ctx)
    if path == "/api/investigations":
        body = read_json_body(handler)
        db = ctx["load_db"]()
        inv = {
            "id": str(uuid.uuid4()),
            "title": body.get("title") or "new flaky case",
            "repo": body.get("repo") or "local-workspace",
            "framework": body.get("framework") or "pytest",
            "command": body.get("command") or "pytest -q",
            "cwd": str(ctx["resolve_cwd"](body.get("cwd") or ctx["workspace"])),
            "notes": "",
            "created_at": ctx["now_iso"](),
            "updated_at": ctx["now_iso"](),
        }
        db["investigations"].append(inv)
        ctx["save_db"](db)
        return 201, {"investigation": ctx["investigation_summary"](inv, db["runs"])}
    if path.startswith("/api/investigations/") and path.endswith("/runs"):
        inv_id = path.split("/")[3]
        body = read_json_body(handler)
        job_id = ctx["create_job"](inv_id, body, ctx)
        return 202, {"job_id": job_id}
    if path.startswith("/api/investigations/") and path.endswith("/matrix-runs"):
        inv_id = path.split("/")[3]
        body = read_json_body(handler)
        db = ctx["load_db"]()
        if not ctx["find_inv"](db, inv_id):
            return 404, {"error": "not found"}
        job_id = ctx["create_matrix_job"](inv_id, body, ctx)
        return 202, {"job_id": job_id}
    if path.startswith("/api/jobs/") and path.endswith("/cancel"):
        job_id = path.split("/")[3]
        with ctx["jobs_lock"]:
            job = ctx["jobs"].get(job_id)
            if not job:
                return 404, {"error": "job not found"}
            job["cancel_requested"] = True
            for pid in job.get("processes", []):
                try:
                    os.killpg(pid, 15)
                except ProcessLookupError:
                    pass
        return 202, {"job_id": job_id, "status": "cancelling"}
    return None


def handle_patch(handler, path, ctx):
    if path.startswith("/api/fingerprints/"):
        fingerprint = path.rsplit("/", 1)[-1]
        body = read_json_body(handler)
        status = body.get("status")
        if status not in {"active", "fixed", "ignored"}:
            raise ValueError("status 仅支持 active、fixed、ignored")
        db = ctx["load_db"]()
        record = db.setdefault("fingerprints", {}).setdefault(fingerprint, {})
        record.update({
            "status": status,
            "owner": str(body.get("owner") or record.get("owner") or ""),
            "notes": str(body.get("notes") or record.get("notes") or ""),
            "updated_at": ctx["now_iso"](),
        })
        record["resolved_at"] = ctx["now_iso"]() if status == "fixed" else None
        ctx["save_db"](db)
        return 200, {"fingerprint": fingerprint, **record}
    if path.startswith("/api/investigations/"):
        inv_id = path.rsplit("/", 1)[-1]
        body = read_json_body(handler)
        db = ctx["load_db"]()
        inv = ctx["find_inv"](db, inv_id)
        if not inv:
            return 404, {"error": "not found"}
        for key in ["title", "repo", "framework", "command", "notes"]:
            if key in body:
                inv[key] = body[key]
        if "cwd" in body:
            inv["cwd"] = str(ctx["resolve_cwd"](body["cwd"]))
        inv["updated_at"] = ctx["now_iso"]()
        ctx["save_db"](db)
        return 200, {"investigation": ctx["investigation_summary"](inv, db["runs"])}
    return None
