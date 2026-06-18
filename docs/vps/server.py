#!/usr/bin/env python3
"""PlaneFlow OTA responder — update manifest + health status."""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

BUNDLES_DIR = "/opt/capgo-ota/bundles"
MANIFEST    = "/opt/capgo-ota/updates.json"
PORT        = 8099


class OTAHandler(BaseHTTPRequestHandler):

    def _health_data(self) -> bytes:
        try:
            with open(MANIFEST) as f:
                latest = json.load(f).get("version", "unknown")
        except Exception:
            latest = "unknown"
        try:
            bundles = len([n for n in os.listdir(BUNDLES_DIR) if n.endswith(".zip")])
        except Exception:
            bundles = -1
        try:
            st = os.statvfs(BUNDLES_DIR)
            disk_free_gb = round(st.f_bavail * st.f_frsize / 1e9, 2)
        except Exception:
            disk_free_gb = -1
        return json.dumps({
            "ok": True,
            "latest_version": latest,
            "bundle_count": bundles,
            "disk_free_gb": disk_free_gb,
        }).encode()

    def _health_headers(self, body: bytes) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")

        if path == "/health":
            body = self._health_data()
            self._health_headers(body)
            self.wfile.write(body)

        elif path == "/updates":
            try:
                with open(MANIFEST, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except FileNotFoundError:
                self.send_error(404, "No manifest yet")

        else:
            self.send_error(404)

    def do_HEAD(self):
        # HEAD /health: UptimeRobot и пр. мониторинги используют HEAD.
        # BaseHTTPRequestHandler не реализует HEAD автоматически → 501 без этого метода.
        path = self.path.split("?")[0].rstrip("/")
        if path == "/health":
            body = self._health_data()
            self._health_headers(body)
            # Тело не пишем — HEAD по RFC не содержит тела.
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):  # stdout не нужен, systemd journal всё пишет
        pass


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), OTAHandler)
    print(f"OTA responder on :{PORT}", flush=True)
    server.serve_forever()
