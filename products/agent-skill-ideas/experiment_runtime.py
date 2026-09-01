"""Shared concurrent execution loop for repeat and matrix experiments."""
from concurrent.futures import ThreadPoolExecutor, as_completed


def run_parallel(job_id, tasks, workers, execute, jobs, jobs_lock, annotate=None, cancelled_message="实验已取消"):
    """Run tasks and update one job; execute receives task payload and returns a sample."""
    samples = []
    with jobs_lock:
        jobs[job_id]["status"] = "running"
        jobs[job_id]["total"] = len(tasks)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(execute, task): task for task in tasks}
        for future in as_completed(futures):
            with jobs_lock:
                if jobs[job_id].get("cancel_requested"):
                    for pending in futures:
                        pending.cancel()
                    raise RuntimeError(cancelled_message)
            task = futures[future]
            sample = future.result()
            if annotate:
                sample = annotate(sample, task)
            samples.append(sample)
            with jobs_lock:
                jobs[job_id]["samples"].append(sample)
                jobs[job_id]["progress"] += 1
                jobs[job_id]["completion_order"].append(sample.get("index"))
    return sorted(samples, key=lambda item: item.get("index", 0))
