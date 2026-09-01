"""Experiment specifications and validation independent of job execution."""


def matrix_variants(body):
    dimension = str(body.get("dimension") or "concurrency")
    if dimension not in {"concurrency", "seed", "order_perturbation"}:
        raise ValueError("扫描维度仅支持 concurrency、seed、order_perturbation")
    raw_values = body.get("values") or []
    if not isinstance(raw_values, list) or not raw_values or len(raw_values) > 12:
        raise ValueError("values 必须包含 1-12 个扫描值")
    variants = []
    seen = set()
    for raw in raw_values:
        if dimension in {"concurrency", "seed"}:
            value = int(raw)
            if dimension == "concurrency" and not 1 <= value <= 16:
                raise ValueError("concurrency 必须在 1-16 之间")
        else:
            value = raw if isinstance(raw, bool) else str(raw).lower() in {"true", "1", "yes", "on"}
        if value in seen:
            raise ValueError("扫描值不能重复")
        seen.add(value)
        variants.append({"dimension": dimension, "value": value, "label": f"{dimension}={str(value).lower()}"})
    return variants
