import os


def test_stable_control():
    assert 2 + 2 == 4


def test_seed_sensitive_checkout():
    seed = int(os.environ.get("FTI_SEED", "0"))
    concurrency = int(os.environ.get("FTI_CONCURRENCY", "1"))
    assert not (seed == 42 and concurrency > 1), "checkout state leaked between workers"
