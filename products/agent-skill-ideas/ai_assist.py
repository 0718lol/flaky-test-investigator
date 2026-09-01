"""Optional root-cause explanation; deterministic analysis remains the source of truth."""
import json
import os
import urllib.request


def local_hypotheses(inv, runs):
    failures = [run for run in runs if run.get("status") == "failed"]
    if not failures:
        return ["当前样本没有复现失败，无需生成根因假设。"]
    kinds = {}
    for run in failures:
        item = run.get("classification") or {}
        kinds[item.get("kind", "unknown")] = kinds.get(item.get("kind", "unknown"), 0) + 1
    labels = {"timing_or_race": "优先检查共享状态、锁和并发 fixture", "order_dependency": "优先检查测试顺序和 teardown 清理", "randomness": "优先固定 seed 并比较随机输入", "network_or_resource": "优先检查外部依赖、连接池和资源上限", "unknown": "需要更多对照样本"}
    return [f"{labels.get(kind, labels['unknown'])}（{count} 个失败样本）" for kind, count in sorted(kinds.items(), key=lambda item: item[1], reverse=True)]


def explain(inv, runs):
    hypotheses = local_hypotheses(inv, runs)
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        return {"provider": "local", "configured": False, "summary": "未配置 DeepSeek，以下建议来自本地规则分析。", "hypotheses": hypotheses}
    failures = [run for run in runs if run.get("status") == "failed"][-8:]
    prompt = {"investigation": {"title": inv.get("title"), "command": inv.get("command"), "notes": inv.get("notes")}, "hypotheses": hypotheses, "failures": [{"signal": run.get("signal"), "classification": run.get("classification"), "fingerprint": run.get("fingerprint")} for run in failures]}
    payload = json.dumps({"model": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"), "messages": [{"role": "system", "content": "你是可靠性工程助手。只基于证据给出简短、可验证的下一步，不要声称确定根因。"}, {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}], "temperature": 0.1}).encode()
    request = urllib.request.Request("https://api.deepseek.com/chat/completions", data=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode())
        summary = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        return {"provider": "deepseek", "configured": True, "summary": summary or "模型未返回摘要。", "hypotheses": hypotheses}
    except Exception as exc:
        return {"provider": "local", "configured": True, "summary": f"DeepSeek 请求失败，已回退本地规则分析：{exc}", "hypotheses": hypotheses}
