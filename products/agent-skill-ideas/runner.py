"""Execution boundary helpers. Process orchestration stays in app.py for now."""
import os
import platform
import shlex
import time
import xml.etree.ElementTree as ET
from pathlib import Path


ALLOWED_COMMANDS = {"pytest", "python", "python3", "npm", "npx", "yarn", "pnpm", "go"}


def env_snapshot(root):
    return {"python": platform.python_version(), "platform": platform.platform(), "timezone": time.tzname[0] if time.tzname else "unknown", "cpu": os.cpu_count() or 1, "cwd": str(root)}


def resolve_cwd(cwd, workspace):
    base = Path(cwd or workspace).expanduser()
    base = (workspace / base).resolve() if not base.is_absolute() else base.resolve()
    try:
        base.relative_to(workspace)
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


def parse_junit(path):
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
        results.append({"name": case.attrib.get("name", "unknown"), "classname": case.attrib.get("classname", ""), "duration_ms": round(float(case.attrib.get("time", "0") or 0) * 1000), "status": "failed" if failure is not None or error is not None else "skipped" if skipped is not None else "passed", "message": ((failure if failure is not None else error).attrib.get("message", "") if failure is not None or error is not None else "")[:500]})
    return results
