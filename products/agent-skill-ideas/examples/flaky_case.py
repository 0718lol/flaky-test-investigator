#!/usr/bin/env python3
import os
import sys
import time

seed = int(os.environ.get("FTI_SEED", "42"))
concurrency = int(os.environ.get("FTI_CONCURRENCY", "1"))
run_index = int(os.environ.get("FTI_RUN_INDEX", "1"))
order = os.environ.get("FTI_ORDER", "collected")

time.sleep(0.08)
print(f"checkout demo seed={seed} concurrency={concurrency} order={order} run={run_index}")

is_racy_seed = seed == 42 or seed % 7 == 0
is_parallel = concurrency >= 4
is_order_sensitive = order == "perturbed" and run_index % 3 != 0

if is_parallel and is_racy_seed and is_order_sensitive:
    print("worker-2 capture_payment_intent shared state leaked", file=sys.stderr)
    print("AssertionError: expected captured=1, got 0", file=sys.stderr)
    sys.exit(1)

print("passed")
