"""Application server assembly; route implementation remains in Handler."""
import os
from http.server import ThreadingHTTPServer


def serve(handler, port=None):
    port = int(port or os.environ.get("PORT", "8827"))
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"Flaky Test Investigator listening on 0.0.0.0:{port}", flush=True)
    server.serve_forever()
