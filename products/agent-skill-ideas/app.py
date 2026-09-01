#!/usr/bin/env python3
import json
import hashlib
import os
import platform
import re
import random
import shlex
import sqlite3
import subprocess
import threading
import time
import tempfile
import uuid
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

from ai_assist import explain
from analysis import (classify_failure as analyzed_classify_failure, compare_dimensions as analyzed_compare_dimensions,
                      extract_signal as analyzed_extract_signal, failure_fingerprint as analyzed_failure_fingerprint,
                      score_suspects as analyzed_score_suspects, signal_groups as analyzed_signal_groups,
                      wilson_interval as analyzed_wilson_interval)
from storage import StateStore
from runner import (env_snapshot as runner_env_snapshot, next_seed as runner_next_seed,
                    parse_junit as runner_parse_junit, resolve_cwd as runner_resolve_cwd,
                    validate_command as runner_validate_command)
from experiments import matrix_variants as experiment_matrix_variants
from executor import execute as execute_process
from job_manager import JobManager
from server_utils import read_json_body as read_request_json, response as send_response
from experiment_service import build_matrix_plan, build_repeat_plan
from server import serve
from experiment_runtime import run_parallel
from api_routes import readonly

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[1]
PRODUCT_VENV = ROOT / ".venv" / "bin"
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "investigations.sqlite3"
LEGACY_DB_PATH = DATA_DIR / "investigations.json"
RUN_TIMEOUT = int(os.environ.get("FTI_RUN_TIMEOUT", "30"))
ALLOWED_COMMANDS = {"pytest", "python", "python3", "npm", "npx", "yarn", "pnpm", "go"}

job_manager = JobManager()
jobs = job_manager.items
jobs_lock = job_manager.lock
db_lock = threading.RLock()


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json_body(handler):
    return read_request_json(handler)


def response(handler, status, payload):
    return send_response(handler, status, payload)


def load_db():
    DATA_DIR.mkdir(exist_ok=True)
    with db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)")
        row = conn.execute("SELECT payload FROM app_state WHERE id = 1").fetchone()
        if row:
            payload = json.loads(row[0])
        elif LEGACY_DB_PATH.exists():
            payload = json.loads(LEGACY_DB_PATH.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO app_state(id, payload) VALUES(1, ?)", (json.dumps(payload, ensure_ascii=False),))
            conn.commit()
            LEGACY_DB_PATH.rename(LEGACY_DB_PATH.with_suffix(".json.migrated"))
        else:
            payload = seed_db()
            conn.execute("INSERT INTO app_state(id, payload) VALUES(1, ?)", (json.dumps(payload, ensure_ascii=False),))
            conn.commit()
        payload.setdefault("fingerprints", {})
        payload.setdefault("experiments", [])
        conn.close()
        return payload


def save_db(db):
    DATA_DIR.mkdir(exist_ok=True)
    with db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)")
        conn.execute("INSERT INTO app_state(id, payload) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload", (json.dumps(db, ensure_ascii=False),))
        conn.commit()
        conn.close()


def seed_db():
    inv_id = "checkout"
    return {
        "investigations": [
            {
                "id": inv_id,
                "title": "checkout race",
                "repo": "demo-workspace",
                "framework": "pytest-compatible",
                "command": "python3 examples/flaky_case.py",
                "cwd": str(ROOT),
                "notes": "怀疑并发 worker 共享 capture fixture，先比较 concurrency=1 和 concurrency=4。",
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
        ],
        "runs": [
            make_demo_run(inv_id, idx, failed)
            for idx, failed in enumerate([True, False, True, False, True, False], start=1)
        ],
        "fingerprints": {},
        "experiments": [],
    }


def make_demo_run(inv_id, idx, failed):
    seed = 42 if idx in {1, 3, 5} else 17 + idx
    order = "auth -> capture -> refund" if idx % 2 else "auth -> refund -> capture"
    return {
        "id": f"demo-{idx:03d}",
        "investigation_id": inv_id,
        "index": idx,
        "command": "python3 examples/flaky_case.py",
        "cwd": str(ROOT),
        "seed": seed,
        "seed_mode": "fixed",
        "concurrency": 4 if idx != 4 else 1,
        "order": order,
        "status": "failed" if failed else "passed",
        "exit_code": 1 if failed else 0,
        "duration_ms": 420 + idx * 17,
        "started_at": now_iso(),
        "stdout": "demo checkout run\n",
        "stderr": "AssertionError: expected captured=1, got 0\n" if failed else "",
        "signal": "AssertionError: expected captured=1, got 0" if failed else "",
        "env": env_snapshot(),
    }


def env_snapshot():
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "timezone": time.tzname[0] if time.tzname else "unknown",
        "cpu": os.cpu_count() or 1,
        "cwd": str(ROOT),
    }


def resolve_cwd(cwd):
    base = Path(cwd or WORKSPACE).expanduser()
    if not base.is_absolute():
        base = (WORKSPACE / base).resolve()
    else:
        base = base.resolve()
    try:
        base.relative_to(WORKSPACE)
    except ValueError:
        raise ValueError("工作目录必须位于 /workspace 下")
    if not base.exists() or not base.is_dir():
        raise ValueError("工作目录不存在")
    return base


def validate_command(command):
    parts = shlex.split(command)
    if not parts:
        raise ValueError("测试命令不能为空")
    executable = Path(parts[0]).name
    if executable not in ALLOWED_COMMANDS:
        raise ValueError(f"暂不允许执行 {executable}，请使用 pytest/python/npm/npx/yarn/pnpm/go")
    return parts


def next_seed(seed_mode, base_seed, run_index):
    if seed_mode == "scan":
        return run_index
    if seed_mode == "random":
        return int(time.time_ns() % 100000)
    return int(base_seed or 42)


def extract_signal(stdout, stderr, exit_code):
    text = "\n".join([stderr or "", stdout or ""])
    patterns = [
        r"(AssertionError[^\n]*)",
        r"(Timeout(?:Error)?[^\n]*)",
        r"(E\s+.*Error[^\n]*)",
        r"(FAILED\s+[^\n]*)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()[:220]
    if exit_code != 0:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return (lines[-1] if lines else f"exit code {exit_code}")[:220]
    return ""


def failure_fingerprint(signal, stderr, stdout):
    """Normalize volatile log details so repeated failures form one evidence group."""
    raw = signal or extract_signal(stdout, stderr, 1)
    normalized = re.sub(r"(/workspace|/tmp|[A-Za-z]:\\)[^\s:]+", "<path>", raw)
    normalized = re.sub(r"\b(?:0x)?[0-9a-fA-F]{6,}\b", "<hex>", normalized)
    normalized = re.sub(r"\b\d+(?:\.\d+)?(?:ms|s)?\b", "<n>", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()[:220]
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:12] if normalized else ""


def classify_failure(signal, stdout, stderr, config):
    text = " ".join([signal or "", stdout or "", stderr or ""]).lower()
    if "timeout" in text or "timed out" in text:
        return {"kind": "timing_or_race", "label": "时序 / 竞态", "reason": "输出包含超时信号"}
    if config.get("order_perturbation") and any(x in text for x in ["assert", "failed", "error"]):
        return {"kind": "order_dependency", "label": "顺序依赖", "reason": "失败发生在顺序扰动实验"}
    if config.get("concurrency", 1) > 1 and any(x in text for x in ["assert", "race", "lock", "deadlock"]):
        return {"kind": "timing_or_race", "label": "时序 / 竞态", "reason": "失败发生在并发实验"}
    if any(x in text for x in ["random", "seed", "nonce"]):
        return {"kind": "randomness", "label": "随机性", "reason": "输出提及随机种子或随机值"}
    if any(x in text for x in ["connection", "network", "socket", "econn"]):
        return {"kind": "network_or_resource", "label": "网络 / 资源", "reason": "输出包含连接或资源错误"}
    return {"kind": "unknown", "label": "待分类", "reason": "需要更多对照样本"}


def parse_junit(path):
    """Read pytest/JUnit output when an adapter emitted it; tolerate malformed files."""
    if not path or not Path(path).exists():
        return []
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError):
        return []
    results = []
    for case in root.iter("testcase"):
        failure = case.find("failure")
        error = case.find("error")
        skipped = case.find("skipped")
        results.append({
            "name": case.attrib.get("name", "unknown"),
            "classname": case.attrib.get("classname", ""),
            "duration_ms": round(float(case.attrib.get("time", "0") or 0) * 1000),
            "status": "failed" if failure is not None or error is not None else "skipped" if skipped is not None else "passed",
            "message": ((failure if failure is not None else error).attrib.get("message", "") if failure is not None or error is not None else "")[:500],
        })
    return results


def run_one(inv, config, run_number):
    command = config.get("command") or inv["command"]
    cwd = resolve_cwd(config.get("cwd") or inv.get("cwd") or WORKSPACE)
    parts = validate_command(command)
    seed = next_seed(config.get("seed_mode", "fixed"), config.get("seed", 42), run_number)
    concurrency = int(config.get("concurrency") or 1)
    order = "perturbed" if config.get("order_perturbation") else "collected"
    env = os.environ.copy()
    if PRODUCT_VENV.exists():
        env["PATH"] = f"{PRODUCT_VENV}{os.pathsep}{env.get('PATH', '')}"
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
    started_at = now_iso()
    junit_path = None
    command_parts = list(parts)
    actual_order = order
    if Path(parts[0]).name == "pytest" and config.get("order_perturbation"):
        try:
            collected = subprocess.run(parts + ["--collect-only"], cwd=str(cwd), env=env, text=True,
                                       capture_output=True, timeout=30)
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
    stdout, stderr, exit_code = execute_process(command_parts, cwd, env, int(config.get("timeout") or RUN_TIMEOUT), active_job, jobs, jobs_lock)
    test_results = parse_junit(junit_path)
    if junit_path:
        try:
            os.unlink(junit_path)
        except OSError:
            pass
    duration_ms = int((time.perf_counter() - started) * 1000)
    status = "passed" if exit_code == 0 else "failed"
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
        "signal": extract_signal(stdout, stderr, exit_code),
        "fingerprint": failure_fingerprint(extract_signal(stdout, stderr, exit_code), stderr, stdout),
        "classification": classify_failure(extract_signal(stdout, stderr, exit_code), stdout, stderr, config),
        "execution": "subprocess",
        "tests": test_results,
        "env": env_snapshot() if config.get("capture_environment", True) else {},
    }


def score_suspects(runs):
    total = len(runs)
    failed = [r for r in runs if r["status"] == "failed"]
    if not total or not failed:
        return []
    suspects = []
    dimensions = [
        ("concurrency", "并发度"),
        ("seed", "随机种子"),
        ("order", "执行顺序"),
        ("cwd", "工作目录"),
    ]
    baseline = len(failed) / total
    for key, label in dimensions:
        buckets = {}
        for run in runs:
            buckets.setdefault(str(run.get(key, "unknown")), []).append(run)
        for value, bucket in buckets.items():
            if len(bucket) < 2:
                continue
            fail_rate = sum(1 for r in bucket if r["status"] == "failed") / len(bucket)
            lift = max(0, fail_rate - baseline)
            if lift:
                suspects.append({
                    "name": f"{label} = {value}",
                    "score": round(min(0.99, lift + len(bucket) / max(total, 1) * 0.35), 2),
                    "confidence": wilson_interval(sum(1 for r in bucket if r["status"] == "failed"), len(bucket)),
                    "evidence": f"{sum(1 for r in bucket if r['status']=='failed')}/{len(bucket)} 个样本失败，整体失败率 {baseline:.0%}",
                })
    suspects.sort(key=lambda item: item["score"], reverse=True)
    return suspects[:5]


def wilson_interval(successes, total, z=1.96):
    if not total:
        return [0.0, 0.0]
    p = successes / total
    denom = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    margin = z * ((p * (1 - p) / total + z * z / (4 * total * total)) ** 0.5) / denom
    return [round(max(0.0, centre - margin), 2), round(min(1.0, centre + margin), 2)]


def investigation_summary(inv, runs):
    inv_runs = [r for r in runs if r["investigation_id"] == inv["id"]]
    failures = [r for r in inv_runs if r["status"] == "failed"]
    last = inv_runs[-1]["started_at"] if inv_runs else inv["created_at"]
    return {
        **inv,
        "runs": len(inv_runs),
        "failures": len(failures),
        "repro_rate": (len(failures) / len(inv_runs)) if inv_runs else 0,
        "last_run_at": last,
        "suspects": score_suspects(inv_runs),
        "signals": signal_groups(inv_runs),
    }


def signal_groups(runs):
    groups = {}
    for run in runs:
        if run["status"] == "failed":
            signal = run.get("fingerprint") or failure_fingerprint(run.get("signal"), run.get("stderr"), run.get("stdout")) or "unknown"
            entry = groups.setdefault(signal, {"count": 0, "example": run.get("signal") or "unknown failure"})
            entry["count"] += 1
    return [{"fingerprint": key, "signal": value["example"], "count": value["count"]}
            for key, value in sorted(groups.items(), key=lambda x: x[1]["count"], reverse=True)[:4]]


def fingerprint_history(db, inv_id=None):
    """Return recurring failure fingerprints, including evidence across investigations."""
    groups = {}
    for run in db.get("runs", []):
        if run.get("status") != "failed":
            continue
        fp = run.get("fingerprint") or failure_fingerprint(run.get("signal"), run.get("stderr"), run.get("stdout"))
        if not fp:
            continue
        item = groups.setdefault(fp, {"fingerprint": fp, "count": 0, "investigations": set(), "first_seen": run.get("started_at"), "last_seen": run.get("started_at"), "signal": run.get("signal") or "unknown failure"})
        item["count"] += 1
        item["investigations"].add(run.get("investigation_id"))
        item["first_seen"] = min(filter(None, [item.get("first_seen"), run.get("started_at")]), default=item.get("first_seen"))
        item["last_seen"] = max(filter(None, [item.get("last_seen"), run.get("started_at")]), default=item.get("last_seen"))
    result = []
    records = db.get("fingerprints", {})
    for item in groups.values():
        item["investigations"] = sorted(item["investigations"])
        item["recurrence"] = len(item["investigations"]) > 1
        record = records.get(item["fingerprint"], {})
        status = record.get("status") or ("recurring" if item["recurrence"] or item["count"] > 1 else "new")
        if status == "fixed" and record.get("resolved_at") and item.get("last_seen") and item["last_seen"] > record["resolved_at"]:
            status = "regressed"
        item.update({"status": status, "owner": record.get("owner", ""), "notes": record.get("notes", ""), "resolved_at": record.get("resolved_at")})
        if inv_id and inv_id not in item["investigations"]:
            continue
        result.append(item)
    return sorted(result, key=lambda item: (item["recurrence"], item["count"]), reverse=True)


def compare_dimensions(runs):
    """Build a compact comparison table for dimensions used by the experiment runner."""
    dimensions = [("concurrency", "并发度"), ("seed", "随机种子"), ("order", "执行顺序"), ("cwd", "工作目录")]
    result = []
    for key, label in dimensions:
        buckets = {}
        for run in runs:
            value = str(run.get(key, "unknown"))
            buckets.setdefault(value, []).append(run)
        values = []
        for value, bucket in buckets.items():
            failures = sum(1 for run in bucket if run.get("status") == "failed")
            values.append({"value": value, "runs": len(bucket), "failures": failures, "rate": round(failures / len(bucket), 4) if bucket else 0})
        values.sort(key=lambda item: (-item["rate"], item["value"]))
        result.append({"key": key, "label": label, "values": values})
    return result


def repro_bundle(inv, runs, db):
    failures = [run for run in runs if run.get("status") == "failed"]
    latest = failures[-1] if failures else (runs[-1] if runs else {})
    env = latest.get("env") or {}
    return {
        "format": "fti-repro-bundle/v1",
        "generated_at": now_iso(),
        "investigation": {key: inv.get(key) for key in ("id", "title", "repo", "framework", "command", "cwd", "notes")},
        "reproduction": {
            "command": inv.get("command"),
            "cwd": inv.get("cwd"),
            "seed": latest.get("seed"),
            "concurrency": latest.get("concurrency"),
            "order": latest.get("order"),
            "environment": env,
        },
        "evidence": {
            "runs": len(runs),
            "failures": len(failures),
            "fingerprints": signal_groups(runs),
            "history": fingerprint_history(db, inv.get("id")),
            "comparison": compare_dimensions(runs),
            "latest_failure": {key: latest.get(key) for key in ("id", "started_at", "signal", "stderr", "stdout", "classification", "fingerprint")},
        },
        "next_steps": ["固定最可能变量后重复运行", "将失败日志与 fingerprint 关联到 CI 构建", "确认修复后运行同一矩阵作为回归基线"],
    }


def ci_summary(inv, runs, db):
    failures = [run for run in runs if run.get("status") == "failed"]
    history = fingerprint_history(db, inv["id"])
    regressions = [item for item in history if item.get("status") == "regressed"]
    new_failures = [item for item in history if item.get("status") == "new"]
    conclusion = "failure" if regressions or new_failures else "neutral" if failures else "success"
    lines = [
        f"## Flaky Test Investigator: {inv['title']}", "",
        f"**{len(runs)} runs · {len(failures)} failures · {(len(failures) / len(runs)) if runs else 0:.1%} reproduction rate**", "",
    ]
    if regressions:
        lines.append(f"> {len(regressions)} previously fixed fingerprint(s) regressed.")
    elif new_failures:
        lines.append(f"> {len(new_failures)} new failure fingerprint(s) need triage.")
    elif failures:
        lines.append("> Only known recurring fingerprints were observed.")
    else:
        lines.append("> No failure reproduced in this sample set.")
    lines.extend(["", "| Fingerprint | Status | Samples | Signal |", "| --- | --- | ---: | --- |"]) 
    for item in history[:8]:
        lines.append(f"| `{item['fingerprint']}` | {item['status']} | {item['count']} | {item['signal'][:100]} |")
    return {"conclusion": conclusion, "markdown": "\n".join(lines), "annotations": [{"level": "failure" if item["status"] == "regressed" else "warning", "title": item["status"], "message": item["signal"], "fingerprint": item["fingerprint"]} for item in history if item["status"] in {"new", "regressed"}]}


def get_state():
    db = load_db()
    summaries = [investigation_summary(inv, db["runs"]) for inv in db["investigations"]]
    return {"investigations": summaries, "runs": db["runs"], "workspace": str(WORKSPACE)}


def find_inv(db, inv_id):
    for inv in db["investigations"]:
        if inv["id"] == inv_id:
            return inv
    return None


def pollution_bisect(inv, body):
    target = str(body.get("target") or "").strip()
    candidates = [str(x).strip() for x in body.get("candidates", []) if str(x).strip()]
    if not target or not candidates:
        raise ValueError("需要 target 和 candidates")
    parts = validate_command(body.get("command") or inv["command"])
    cwd = resolve_cwd(body.get("cwd") or inv.get("cwd") or WORKSPACE)
    seed = int(body.get("seed") or 42)
    checks = []
    remaining = candidates[:]
    while len(remaining) > 1:
        midpoint = max(1, len(remaining) // 2)
        group = remaining[:midpoint]
        pollution_env = {**os.environ, "FTI_SEED": str(seed)}
        if PRODUCT_VENV.exists():
            pollution_env["PATH"] = f"{PRODUCT_VENV}{os.pathsep}{pollution_env.get('PATH', '')}"
        proc = subprocess.run(parts + group + [target], cwd=str(cwd), env=pollution_env,
                              text=True, capture_output=True, timeout=RUN_TIMEOUT)
        failed = proc.returncode != 0
        checks.append({"candidates": group, "target": target, "failed": failed, "output": (proc.stdout + proc.stderr)[-2000:]})
        remaining = group if failed else remaining[midpoint:]
    return {"target": target, "polluter": remaining[0], "checks": checks, "confidence": "候选集合二分结果，需重复验证"}


def create_job(inv_id, config):
    job_id = str(uuid.uuid4())
    plan = build_repeat_plan(config)
    repeats, workers = plan["repeats"], plan["workers"]
    with jobs_lock:
        jobs[job_id] = {
            "id": job_id, "status": "queued", "progress": 0, "total": repeats,
            "workers": workers, "config": config, "completion_order": [], "samples": [], "error": "",
        }
    thread = threading.Thread(target=run_job, args=(job_id, inv_id, config), daemon=True)
    thread.start()
    return job_id


def matrix_variants(body):
    dimension = str(body.get("dimension") or "concurrency")
    allowed = {"concurrency", "seed", "order_perturbation"}
    if dimension not in allowed:
        raise ValueError("扫描维度仅支持 concurrency、seed、order_perturbation")
    raw_values = body.get("values") or []
    if not isinstance(raw_values, list) or not raw_values or len(raw_values) > 12:
        raise ValueError("values 必须包含 1-12 个扫描值")
    variants = []
    for raw in raw_values:
        if dimension in {"concurrency", "seed"}:
            value = int(raw)
            if dimension == "concurrency" and not 1 <= value <= 16:
                raise ValueError("concurrency 必须在 1-16 之间")
        else:
            value = raw if isinstance(raw, bool) else str(raw).lower() in {"true", "1", "yes", "on"}
        variants.append({"dimension": dimension, "value": value, "label": f"{dimension}={str(value).lower()}"})
    return variants


def create_matrix_job(inv_id, body):
    plan = build_matrix_plan(body)
    variants, repeats, total = plan["variants"], plan["repeats"], plan["total"]
    job_id = str(uuid.uuid4())
    experiment_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {"id": job_id, "type": "matrix", "experiment_id": experiment_id, "status": "queued", "progress": 0, "total": total, "workers": plan["workers"], "variants": variants, "completion_order": [], "samples": [], "error": ""}
    threading.Thread(target=run_matrix_job, args=(job_id, inv_id, body, variants, repeats), daemon=True).start()
    return job_id


def run_matrix_job(job_id, inv_id, body, variants, repeats):
    try:
        db = load_db()
        inv = find_inv(db, inv_id)
        if not inv:
            raise ValueError("调查不存在")
        experiment_id = jobs[job_id]["experiment_id"]
        base = dict(body.get("base_config") or {})
        base.update({"command": body.get("command") or inv["command"], "cwd": body.get("cwd") or inv.get("cwd"), "_job_id": job_id})
        tasks = []
        ordinal = 0
        for variant in variants:
            for _ in range(repeats):
                ordinal += 1
                config = {**base, variant["dimension"]: variant["value"]}
                tasks.append((ordinal, variant, config))
        workers = jobs[job_id]["workers"]
        new_runs = run_parallel(job_id, tasks, workers, lambda task: run_one(inv, task[2], task[0]), jobs, jobs_lock, lambda sample, task: {**sample, "experiment_id": experiment_id, "variant": task[1]}, "扫描已取消")
        db = load_db()
        db["runs"].extend(new_runs)
        db.setdefault("experiments", []).append({"id": experiment_id, "investigation_id": inv_id, "type": "single_factor", "dimension": variants[0]["dimension"], "variants": variants, "repeats_per_value": repeats, "run_ids": [run["id"] for run in new_runs], "created_at": now_iso(), "status": "complete"})
        save_db(db)
        with jobs_lock:
            jobs[job_id]["status"] = "complete"
    except Exception as exc:
        with jobs_lock:
            jobs[job_id]["status"] = "cancelled" if jobs[job_id].get("cancel_requested") else "failed"
            jobs[job_id]["error"] = str(exc)


def run_job(job_id, inv_id, config):
    try:
        config = {**config, "_job_id": job_id}
        db = load_db()
        inv = find_inv(db, inv_id)
        if not inv:
            raise ValueError("调查不存在")
        repeats = max(1, min(100, int(config.get("repeats") or 1)))
        with jobs_lock:
            jobs[job_id].update({"status": "queued", "total": repeats, "progress": 0, "samples": [], "completion_order": []})
        workers = max(1, min(16, int(config.get("concurrency") or 1)))
        tasks = [(index, config) for index in range(1, repeats + 1)]
        new_runs = run_parallel(job_id, tasks, workers, lambda task: run_one(inv, config, task[0]), jobs, jobs_lock)
        db = load_db()
        db["runs"].extend(new_runs)
        inv = find_inv(db, inv_id)
        inv["command"] = config.get("command") or inv["command"]
        inv["cwd"] = str(resolve_cwd(config.get("cwd") or inv.get("cwd") or WORKSPACE))
        inv["updated_at"] = now_iso()
        save_db(db)
        with jobs_lock:
            jobs[job_id]["status"] = "complete"
    except Exception as exc:
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(exc)
            if jobs[job_id].get("cancel_requested"):
                jobs[job_id]["status"] = "cancelled"


def markdown_report(inv_id):
    state = get_state()
    inv = next((item for item in state["investigations"] if item["id"] == inv_id), None)
    runs = [r for r in state["runs"] if r["investigation_id"] == inv_id]
    if not inv:
        return ""
    suspects = inv["suspects"] or [{"name": "暂无明确嫌疑变量", "score": 0, "evidence": "需要更多失败样本"}]
    failures = [r for r in runs if r["status"] == "failed"]
    min_cmd = inv["command"]
    if suspects:
        top = suspects[0]["name"]
        min_cmd = f"{inv['command']}  # reproduce with {top}"
    lines = [
        f"# {inv['title']} / Flaky investigation report",
        "",
        "## Summary",
        f"- Runs: {len(runs)}",
        f"- Failures: {len(failures)}",
        f"- Repro rate: {inv['repro_rate']:.1%}",
        f"- Last run: {inv['last_run_at']}",
        "",
        "## Suspect variables",
    ]
    for item in suspects:
        lines.append(f"- {item['name']} / score {item['score']}: {item['evidence']}")
    lines.extend(["", "## Minimal command", f"```bash\n{min_cmd}\n```", "", "## Notes", inv.get("notes") or ""])
    classifications = {}
    for run in failures:
        item = run.get("classification") or {}
        key = item.get("kind", "unknown")
        classifications.setdefault(key, {"label": item.get("label", key), "reason": item.get("reason", ""), "count": 0})
        classifications[key]["count"] += 1
    if classifications:
        lines.extend(["", "## Failure classification"])
        for item in classifications.values():
            lines.append(f"- {item['label']}: {item['count']} samples. {item['reason']}")
    if failures:
        lines.extend(["", "## Failure fingerprints"])
        for group in signal_groups(runs):
            lines.append(f"- `{group['fingerprint']}`: {group['count']} samples / {group['signal']}")
    db = load_db()
    history = fingerprint_history(db, inv_id)
    recurring = [item for item in history if item.get("recurrence")]
    if recurring:
        lines.extend(["", "## Historical recurrence"])
        for item in recurring[:5]:
            lines.append(f"- `{item['fingerprint']}`: {item['count']} samples across {len(item['investigations'])} investigations; last seen {item['last_seen']}")
    lines.extend(["", "## Variable comparison"])
    for dimension in compare_dimensions(runs):
        if dimension["values"]:
            values = ", ".join(f"{item['value']}={item['rate']:.0%} ({item['failures']}/{item['runs']})" for item in dimension["values"][:5])
            lines.append(f"- {dimension['label']}: {values}")
    return "\n".join(lines)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        routed = readonly(parsed.path, {
            "get_state": get_state, "load_db": load_db, "jobs": jobs, "jobs_lock": jobs_lock,
            "find_inv": find_inv, "markdown_report": markdown_report, "fingerprint_history": fingerprint_history,
            "compare_dimensions": compare_dimensions, "repro_bundle": repro_bundle, "ci_summary": ci_summary,
            "explain": explain,
        })
        if routed is not None:
            return response(self, routed[0], routed[1])
        if parsed.path == "/api/state":
            return response(self, 200, get_state())
        if parsed.path.startswith("/api/runs/"):
            run_id = parsed.path.rsplit("/", 1)[-1]
            db = load_db()
            run = next((item for item in db["runs"] if item["id"] == run_id), None)
            return response(self, 200 if run else 404, {"run": run} if run else {"error": "run not found"})
        if parsed.path.startswith("/api/jobs/"):
            job_id = parsed.path.rsplit("/", 1)[-1]
            with jobs_lock:
                job = jobs.get(job_id)
            return response(self, 200 if job else 404, job or {"error": "job not found"})
        if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/report"):
            inv_id = parsed.path.split("/")[3]
            report = markdown_report(inv_id)
            return response(self, 200 if report else 404, {"markdown": report} if report else {"error": "not found"})
        if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/history"):
            inv_id = parsed.path.split("/")[3]
            db = load_db()
            if not find_inv(db, inv_id):
                return response(self, 404, {"error": "not found"})
            return response(self, 200, {"history": fingerprint_history(db, inv_id)})
        if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/compare"):
            inv_id = parsed.path.split("/")[3]
            db = load_db()
            inv = find_inv(db, inv_id)
            if not inv:
                return response(self, 404, {"error": "not found"})
            runs = [run for run in db.get("runs", []) if run.get("investigation_id") == inv_id]
            return response(self, 200, {"dimensions": compare_dimensions(runs), "runs": len(runs)})
        if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/repro-bundle"):
            inv_id = parsed.path.split("/")[3]
            db = load_db()
            inv = find_inv(db, inv_id)
            if not inv:
                return response(self, 404, {"error": "not found"})
            runs = [run for run in db.get("runs", []) if run.get("investigation_id") == inv_id]
            return response(self, 200, repro_bundle(inv, runs, db))
        if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/ci-summary"):
            inv_id = parsed.path.split("/")[3]
            db = load_db()
            inv = find_inv(db, inv_id)
            if not inv:
                return response(self, 404, {"error": "not found"})
            runs = [run for run in db.get("runs", []) if run.get("investigation_id") == inv_id]
            return response(self, 200, ci_summary(inv, runs, db))
        if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/experiments"):
            inv_id = parsed.path.split("/")[3]
            db = load_db()
            experiments = [item for item in db.get("experiments", []) if item.get("investigation_id") == inv_id]
            return response(self, 200, {"experiments": experiments})
        if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/assist"):
            inv_id = parsed.path.split("/")[3]
            db = load_db()
            inv = find_inv(db, inv_id)
            if not inv:
                return response(self, 404, {"error": "not found"})
            runs = [run for run in db.get("runs", []) if run.get("investigation_id") == inv_id]
            return response(self, 200, explain(inv, runs))
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/pollution-bisect"):
                inv_id = parsed.path.split("/")[3]
                body = read_json_body(self)
                db = load_db(); inv = find_inv(db, inv_id)
                if not inv:
                    return response(self, 404, {"error": "not found"})
                return response(self, 200, pollution_bisect(inv, body))
            if parsed.path == "/api/investigations":
                body = read_json_body(self)
                db = load_db()
                inv = {
                    "id": str(uuid.uuid4()),
                    "title": body.get("title") or "new flaky case",
                    "repo": body.get("repo") or "local-workspace",
                    "framework": body.get("framework") or "pytest",
                    "command": body.get("command") or "pytest -q",
                    "cwd": str(resolve_cwd(body.get("cwd") or WORKSPACE)),
                    "notes": "",
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                }
                db["investigations"].append(inv)
                save_db(db)
                return response(self, 201, {"investigation": investigation_summary(inv, db["runs"])})
            if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/runs"):
                inv_id = parsed.path.split("/")[3]
                body = read_json_body(self)
                job_id = create_job(inv_id, body)
                return response(self, 202, {"job_id": job_id})
            if parsed.path.startswith("/api/investigations/") and parsed.path.endswith("/matrix-runs"):
                inv_id = parsed.path.split("/")[3]
                body = read_json_body(self)
                db = load_db()
                if not find_inv(db, inv_id):
                    return response(self, 404, {"error": "not found"})
                job_id = create_matrix_job(inv_id, body)
                return response(self, 202, {"job_id": job_id})
            if parsed.path.startswith("/api/jobs/") and parsed.path.endswith("/cancel"):
                job_id = parsed.path.split("/")[3]
                with jobs_lock:
                    job = jobs.get(job_id)
                    if not job:
                        return response(self, 404, {"error": "job not found"})
                    job["cancel_requested"] = True
                    for pid in job.get("processes", []):
                        try:
                            os.killpg(pid, 15)
                        except ProcessLookupError:
                            pass
                return response(self, 202, {"job_id": job_id, "status": "cancelling"})
        except Exception as exc:
            return response(self, 400, {"error": str(exc)})
        return response(self, 404, {"error": "not found"})

    def do_PATCH(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path.startswith("/api/fingerprints/"):
                fingerprint = parsed.path.rsplit("/", 1)[-1]
                body = read_json_body(self)
                status = body.get("status")
                if status not in {"active", "fixed", "ignored"}:
                    raise ValueError("status 仅支持 active、fixed、ignored")
                db = load_db()
                record = db.setdefault("fingerprints", {}).setdefault(fingerprint, {})
                record.update({"status": status, "owner": str(body.get("owner") or record.get("owner") or ""), "notes": str(body.get("notes") or record.get("notes") or ""), "updated_at": now_iso()})
                record["resolved_at"] = now_iso() if status == "fixed" else None
                save_db(db)
                return response(self, 200, {"fingerprint": fingerprint, **record})
            if parsed.path.startswith("/api/investigations/"):
                inv_id = parsed.path.rsplit("/", 1)[-1]
                body = read_json_body(self)
                db = load_db()
                inv = find_inv(db, inv_id)
                if not inv:
                    return response(self, 404, {"error": "not found"})
                for key in ["title", "repo", "framework", "command", "notes"]:
                    if key in body:
                        inv[key] = body[key]
                if "cwd" in body:
                    inv["cwd"] = str(resolve_cwd(body["cwd"]))
                inv["updated_at"] = now_iso()
                save_db(db)
                return response(self, 200, {"investigation": investigation_summary(inv, db["runs"])})
        except Exception as exc:
            return response(self, 400, {"error": str(exc)})
        return response(self, 404, {"error": "not found"})


store = StateStore(DB_PATH, DATA_DIR, LEGACY_DB_PATH, seed_db)
load_db = store.load
save_db = store.save
failure_fingerprint = analyzed_failure_fingerprint
extract_signal = analyzed_extract_signal
classify_failure = analyzed_classify_failure
score_suspects = analyzed_score_suspects
signal_groups = analyzed_signal_groups
wilson_interval = analyzed_wilson_interval
compare_dimensions = analyzed_compare_dimensions
env_snapshot = lambda: runner_env_snapshot(ROOT)
resolve_cwd = lambda cwd: runner_resolve_cwd(cwd, WORKSPACE)
validate_command = runner_validate_command
next_seed = runner_next_seed
parse_junit = runner_parse_junit
matrix_variants = experiment_matrix_variants


if __name__ == "__main__":
    serve(Handler)
