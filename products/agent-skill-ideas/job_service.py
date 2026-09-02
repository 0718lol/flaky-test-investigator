"""Job lifecycle and experiment execution helpers."""
import os
import random
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path

from experiment_service import build_matrix_plan


def _resolve_cwd(deps, cwd):
    return deps["resolve_cwd"](cwd or deps["workspace"])


def run_one(inv, config, run_number, deps):
    command = config.get("command") or inv["command"]
    cwd = _resolve_cwd(deps, config.get("cwd") or inv.get("cwd"))
    parts = deps["validate_command"](command)
    seed = deps["next_seed"](config.get("seed_mode", "fixed"), config.get("seed", 42), run_number)
    concurrency = int(config.get("concurrency") or 1)
    order = "perturbed" if config.get("order_perturbation") else "collected"
    env = os.environ.copy()
    if deps["product_venv"].exists():
        env["PATH"] = f"{deps['product_venv']}{os.pathsep}{env.get('PATH', '')}"
    env.update({
        "FTI_RUN_INDEX": str(run_number),
        "FTI_SEED": str(seed),
        "FTI_CONCURRENCY": str(concurrency),
        "FTI_ORDER": order,
        "PYTHONHASHSEED": str(seed),
    })
    if config.get("capture_environment", True):
        env.setdefault("TZ", "UTC")
    started = time.perf_counter()
    started_at = deps["now_iso"]()
    junit_path = None
    command_parts = list(parts)
    actual_order = order
    if Path(parts[0]).name == "pytest" and config.get("order_perturbation"):
        try:
            collected = subprocess.run(
                parts + ["--collect-only"],
                cwd=str(cwd),
                env=env,
                text=True,
                capture_output=True,
                timeout=30,
            )
            nodeids = [line.strip() for line in collected.stdout.splitlines() if "::" in line and not line.startswith("=")]
            if nodeids:
                random.Random(seed).shuffle(nodeids)
                command_parts = [parts[0], *parts[1:], *nodeids]
                actual_order = "perturbed:" + ",".join(nodeids[:8])
        except (OSError, subprocess.TimeoutExpired):
            actual_order = "perturbed:collection_failed"
    if Path(parts[0]).name == "pytest" and not any("--junitxml" in part for part in parts):
        junit_file = tempfile.NamedTemporaryFile(prefix="fti-", suffix=".xml", delete=False)
        junit_file.close()
        junit_path = junit_file.name
        command_parts.append(f"--junitxml={junit_path}")
    active_job = config.get("_job_id")
    stdout, stderr, exit_code = deps["execute_process"](
        command_parts,
        cwd,
        env,
        int(config.get("timeout") or deps["run_timeout"]),
        active_job,
        deps["jobs"],
        deps["jobs_lock"],
    )
    test_results = deps["parse_junit"](junit_path)
    if junit_path:
        try:
            os.unlink(junit_path)
        except OSError:
            pass
    duration_ms = int((time.perf_counter() - started) * 1000)
    status = "passed" if exit_code == 0 else "failed"
    signal = deps["extract_signal"](stdout, stderr, exit_code)
    return {
        "id": str(uuid.uuid4()),
        "investigation_id": inv["id"],
        "index": run_number,
        "command": command,
        "cwd": str(cwd),
        "seed": seed,
        "seed_mode": config.get("seed_mode", "fixed"),
        "concurrency": concurrency,
        "order": actual_order,
        "status": status,
        "exit_code": exit_code,
        "duration_ms": duration_ms,
        "started_at": started_at,
        "stdout": stdout,
        "stderr": stderr,
        "signal": signal,
        "fingerprint": deps["failure_fingerprint"](signal, stderr, stdout),
        "classification": deps["classify_failure"](signal, stdout, stderr, config),
        "execution": "subprocess",
        "tests": test_results,
        "env": deps["env_snapshot"]() if config.get("capture_environment", True) else {},
    }


def pollution_bisect(inv, body, deps):
    target = str(body.get("target") or "").strip()
    candidates = [str(x).strip() for x in body.get("candidates", []) if str(x).strip()]
    if not target or not candidates:
        raise ValueError("需要 target 和 candidates")
    parts = deps["validate_command"](body.get("command") or inv["command"])
    cwd = _resolve_cwd(deps, body.get("cwd") or inv.get("cwd"))
    seed = int(body.get("seed") or 42)
    checks = []
    remaining = candidates[:]
    while len(remaining) > 1:
        midpoint = max(1, len(remaining) // 2)
        group = remaining[:midpoint]
        pollution_env = {**os.environ, "FTI_SEED": str(seed)}
        if deps["product_venv"].exists():
            pollution_env["PATH"] = f"{deps['product_venv']}{os.pathsep}{pollution_env.get('PATH', '')}"
        proc = subprocess.run(
            parts + group + [target],
            cwd=str(cwd),
            env=pollution_env,
            text=True,
            capture_output=True,
            timeout=deps["run_timeout"],
        )
        failed = proc.returncode != 0
        checks.append({"candidates": group, "target": target, "failed": failed, "output": (proc.stdout + proc.stderr)[-2000:]})
        remaining = group if failed else remaining[midpoint:]
    return {"target": target, "polluter": remaining[0], "checks": checks, "confidence": "候选集合二分结果，需重复验证"}


def create_job(inv_id, config, deps):
    job_id = str(uuid.uuid4())
    plan = deps["build_repeat_plan"](config)
    repeats, workers = plan["repeats"], plan["workers"]
    with deps["jobs_lock"]:
        deps["jobs"][job_id] = {
            "id": job_id,
            "status": "queued",
            "progress": 0,
            "total": repeats,
            "workers": workers,
            "config": config,
            "completion_order": [],
            "samples": [],
            "error": "",
        }
    thread = threading.Thread(target=run_job, args=(job_id, inv_id, config, deps), daemon=True)
    thread.start()
    return job_id


def create_matrix_job(inv_id, body, deps):
    plan = build_matrix_plan(body)
    variants, repeats, total = plan["variants"], plan["repeats"], plan["total"]
    job_id = str(uuid.uuid4())
    experiment_id = str(uuid.uuid4())
    with deps["jobs_lock"]:
        deps["jobs"][job_id] = {
            "id": job_id,
            "type": "matrix",
            "experiment_id": experiment_id,
            "status": "queued",
            "progress": 0,
            "total": total,
            "workers": plan["workers"],
            "variants": variants,
            "completion_order": [],
            "samples": [],
            "error": "",
        }
    threading.Thread(target=run_matrix_job, args=(job_id, inv_id, body, variants, repeats, deps), daemon=True).start()
    return job_id


def run_matrix_job(job_id, inv_id, body, variants, repeats, deps):
    try:
        db = deps["load_db"]()
        inv = deps["find_inv"](db, inv_id)
        if not inv:
            raise ValueError("调查不存在")
        experiment_id = deps["jobs"][job_id]["experiment_id"]
        base = dict(body.get("base_config") or {})
        base.update({"command": body.get("command") or inv["command"], "cwd": body.get("cwd") or inv.get("cwd"), "_job_id": job_id})
        tasks = []
        ordinal = 0
        for variant in variants:
            for _ in range(repeats):
                ordinal += 1
                config = {**base, variant["dimension"]: variant["value"]}
                tasks.append((ordinal, variant, config))
        workers = deps["jobs"][job_id]["workers"]
        new_runs = deps["run_parallel"](
            job_id,
            tasks,
            workers,
            lambda task: run_one(inv, task[2], task[0], deps),
            deps["jobs"],
            deps["jobs_lock"],
            lambda sample, task: {**sample, "experiment_id": experiment_id, "variant": task[1]},
            "扫描已取消",
        )
        db = deps["load_db"]()
        db["runs"].extend(new_runs)
        db.setdefault("experiments", []).append(
            {
                "id": experiment_id,
                "investigation_id": inv_id,
                "type": "single_factor",
                "dimension": variants[0]["dimension"],
                "variants": variants,
                "repeats_per_value": repeats,
                "run_ids": [run["id"] for run in new_runs],
                "created_at": deps["now_iso"](),
                "status": "complete",
            }
        )
        deps["save_db"](db)
        with deps["jobs_lock"]:
            deps["jobs"][job_id]["status"] = "complete"
    except Exception as exc:
        with deps["jobs_lock"]:
            deps["jobs"][job_id]["status"] = "cancelled" if deps["jobs"][job_id].get("cancel_requested") else "failed"
            deps["jobs"][job_id]["error"] = str(exc)


def run_job(job_id, inv_id, config, deps):
    try:
        config = {**config, "_job_id": job_id}
        db = deps["load_db"]()
        inv = deps["find_inv"](db, inv_id)
        if not inv:
            raise ValueError("调查不存在")
        repeats = max(1, min(100, int(config.get("repeats") or 1)))
        with deps["jobs_lock"]:
            deps["jobs"][job_id].update({"status": "queued", "total": repeats, "progress": 0, "samples": [], "completion_order": []})
        workers = max(1, min(16, int(config.get("concurrency") or 1)))
        tasks = [(index, config) for index in range(1, repeats + 1)]
        new_runs = deps["run_parallel"](
            job_id,
            tasks,
            workers,
            lambda task: run_one(inv, config, task[0], deps),
            deps["jobs"],
            deps["jobs_lock"],
        )
        db = deps["load_db"]()
        db["runs"].extend(new_runs)
        inv = deps["find_inv"](db, inv_id)
        inv["command"] = config.get("command") or inv["command"]
        inv["cwd"] = str(_resolve_cwd(deps, config.get("cwd") or inv.get("cwd")))
        inv["updated_at"] = deps["now_iso"]()
        deps["save_db"](db)
        with deps["jobs_lock"]:
            deps["jobs"][job_id]["status"] = "complete"
    except Exception as exc:
        with deps["jobs_lock"]:
            deps["jobs"][job_id]["status"] = "failed"
            deps["jobs"][job_id]["error"] = str(exc)
            if deps["jobs"][job_id].get("cancel_requested"):
                deps["jobs"][job_id]["status"] = "cancelled"
