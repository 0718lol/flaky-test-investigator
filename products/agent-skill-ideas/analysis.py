"""Pure reliability analysis functions shared by the HTTP service and tests."""
import hashlib
import re


def failure_fingerprint(signal, stderr, stdout):
    raw = signal or extract_signal(stdout, stderr, 1)
    normalized = re.sub(r"(/workspace|/tmp|[A-Za-z]:\\)[^\s:]+", "<path>", raw)
    normalized = re.sub(r"\b(?:0x)?[0-9a-fA-F]{6,}\b", "<hex>", normalized)
    normalized = re.sub(r"\b\d+(?:\.\d+)?(?:ms|s)?\b", "<n>", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()[:220]
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:12] if normalized else ""


def extract_signal(stdout, stderr, exit_code):
    text = "\n".join([stderr or "", stdout or ""])
    for pattern in [r"(AssertionError[^\n]*)", r"(Timeout(?:Error)?[^\n]*)", r"(E\s+.*Error[^\n]*)", r"(FAILED\s+[^\n]*)"]:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()[:220]
    if exit_code != 0:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return (lines[-1] if lines else f"exit code {exit_code}")[:220]
    return ""


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


def wilson_interval(successes, total, z=1.96):
    if not total:
        return [0.0, 0.0]
    p = successes / total
    denom = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    margin = z * ((p * (1 - p) / total + z * z / (4 * total * total)) ** 0.5) / denom
    return [round(max(0.0, centre - margin), 2), round(min(1.0, centre + margin), 2)]


def score_suspects(runs):
    total = len(runs)
    failed = [r for r in runs if r["status"] == "failed"]
    if not total or not failed:
        return []
    suspects = []
    baseline = len(failed) / total
    for key, label in [("concurrency", "并发度"), ("seed", "随机种子"), ("order", "执行顺序"), ("cwd", "工作目录")]:
        buckets = {}
        for run in runs:
            buckets.setdefault(str(run.get(key, "unknown")), []).append(run)
        for value, bucket in buckets.items():
            if len(bucket) < 2:
                continue
            failures = sum(1 for r in bucket if r["status"] == "failed")
            lift = max(0, failures / len(bucket) - baseline)
            if lift:
                suspects.append({"name": f"{label} = {value}", "score": round(min(0.99, lift + len(bucket) / max(total, 1) * 0.35), 2), "confidence": wilson_interval(failures, len(bucket)), "evidence": f"{failures}/{len(bucket)} 个样本失败，整体失败率 {baseline:.0%}"})
    suspects.sort(key=lambda item: item["score"], reverse=True)
    return suspects[:5]


def signal_groups(runs):
    groups = {}
    for run in runs:
        if run.get("status") == "failed":
            signal = run.get("fingerprint") or failure_fingerprint(run.get("signal"), run.get("stderr"), run.get("stdout")) or "unknown"
            entry = groups.setdefault(signal, {"count": 0, "example": run.get("signal") or "unknown failure"})
            entry["count"] += 1
    return [{"fingerprint": key, "signal": value["example"], "count": value["count"]} for key, value in sorted(groups.items(), key=lambda x: x[1]["count"], reverse=True)[:4]]


def compare_dimensions(runs):
    result = []
    for key, label in [("concurrency", "并发度"), ("seed", "随机种子"), ("order", "执行顺序"), ("cwd", "工作目录")]:
        buckets = {}
        for run in runs:
            buckets.setdefault(str(run.get(key, "unknown")), []).append(run)
        values = []
        for value, bucket in buckets.items():
            failures = sum(1 for run in bucket if run.get("status") == "failed")
            values.append({"value": value, "runs": len(bucket), "failures": failures, "rate": round(failures / len(bucket), 4) if bucket else 0})
        result.append({"key": key, "label": label, "values": sorted(values, key=lambda item: (-item["rate"], item["value"]))})
    return result
