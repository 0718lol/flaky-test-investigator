"""Persistence boundary for the investigator state document."""
import json
import threading
from pathlib import Path


class StateStore:
    def __init__(self, db_path, data_dir, legacy_path, seed_factory):
        self.db_path = Path(db_path)
        self.data_dir = Path(data_dir)
        self.legacy_path = Path(legacy_path)
        self.seed_factory = seed_factory
        self.lock = threading.RLock()

    def load(self):
        import sqlite3
        self.data_dir.mkdir(exist_ok=True)
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            conn.execute("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)")
            row = conn.execute("SELECT payload FROM app_state WHERE id = 1").fetchone()
            if row:
                payload = json.loads(row[0])
            elif self.legacy_path.exists():
                payload = json.loads(self.legacy_path.read_text(encoding="utf-8"))
                conn.execute("INSERT INTO app_state(id, payload) VALUES(1, ?)", (json.dumps(payload, ensure_ascii=False),))
                conn.commit()
                self.legacy_path.rename(self.legacy_path.with_suffix(".json.migrated"))
            else:
                payload = self.seed_factory()
                conn.execute("INSERT INTO app_state(id, payload) VALUES(1, ?)", (json.dumps(payload, ensure_ascii=False),))
                conn.commit()
            payload.setdefault("fingerprints", {})
            payload.setdefault("experiments", [])
            conn.close()
            return payload

    def save(self, payload):
        import sqlite3
        self.data_dir.mkdir(exist_ok=True)
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            conn.execute("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)")
            conn.execute("INSERT INTO app_state(id, payload) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload", (json.dumps(payload, ensure_ascii=False),))
            conn.commit()
            conn.close()
