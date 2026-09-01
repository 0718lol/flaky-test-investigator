"""Subprocess lifecycle: timeout, process groups, cancellation and output limits."""
import os
import subprocess


def execute(command_parts, cwd, env, timeout, job_id=None, jobs=None, jobs_lock=None):
    try:
        proc = subprocess.Popen(command_parts, cwd=str(cwd), env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        if job_id and jobs is not None and jobs_lock is not None:
            with jobs_lock:
                if job_id in jobs:
                    jobs[job_id].setdefault("processes", []).append(proc.pid)
        try:
            stdout, stderr = proc.communicate(timeout=timeout)
            exit_code = proc.returncode
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, 15)
            stdout, stderr = proc.communicate()
            exit_code = 124
            stderr = (stderr or "") + f"\nTimeout after {timeout}s"
        if job_id and jobs is not None and jobs_lock is not None:
            with jobs_lock:
                if jobs.get(job_id, {}).get("cancel_requested"):
                    exit_code = 130
                    stderr = (stderr or "") + "\nCancelled by user"
        return stdout[-6000:], stderr[-6000:], exit_code
    except OSError as exc:
        return "", str(exc), 127
