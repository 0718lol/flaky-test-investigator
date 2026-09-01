"""Small, thread-safe in-memory job registry."""
import threading
import uuid


class JobManager:
    def __init__(self):
        self.items = {}
        self.lock = threading.Lock()

    def create(self, **fields):
        job_id = str(uuid.uuid4())
        with self.lock:
            self.items[job_id] = {"id": job_id, **fields}
        return job_id

    def get(self, job_id):
        with self.lock:
            return self.items.get(job_id)

    def update(self, job_id, **fields):
        with self.lock:
            if job_id in self.items:
                self.items[job_id].update(fields)

    def request_cancel(self, job_id):
        with self.lock:
            job = self.items.get(job_id)
            if not job:
                return None
            job["cancel_requested"] = True
            return job
