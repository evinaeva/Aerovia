#!/usr/bin/env python3
# PlaneFlow OTA updates responder. Reads /opt/capgo-ota/updates.json and answers the
# Capgo capacitor-updater plugin version check. Serves an update only when the advertised
# version is newer than the device's installed one (offline-first; no manifest => no update).
import json
import os
import glob
from http.server import BaseHTTPRequestHandler, HTTPServer

BUNDLES = "/opt/capgo-ota/bundles"
LATEST  = "/opt/capgo-ota/updates.json"

def parse_ver(v):
    try:
        return [int(x) for x in str(v).split(".")[:3]]
    except Exception:
        return None

def decide(body):
    try:
        with open(LATEST) as f:
            latest = json.load(f)
    except Exception:
        return {"message": "no manifest"}
    lv  = parse_ver(latest.get("version"))
    url = latest.get("url") or ""
    if not lv or not url:
        return {"message": "up to date"}
    cur = parse_ver((body or {}).get("version_name"))
    if cur is None or lv > cur:
        return {"version": latest.get("version"), "url": url, "checksum": latest.get("checksum", "")}
    return {"message": "up to date"}

def health():
    try:
        with open(LATEST) as f:
            latest = json.load(f)
        ver = latest.get("version")
    except Exception:
        ver = None
    bundles  = len(glob.glob(os.path.join(BUNDLES, "*.zip")))
    stat     = os.statvfs(BUNDLES)
    free_gb  = round(stat.f_bavail * stat.f_frsize / 1e9, 1)
    return {"ok": ver is not None, "latest_version": ver, "bundle_count": bundles, "disk_free_gb": free_gb}

class H(BaseHTTPRequestHandler):
    def _body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except Exception:
            n = 0
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            return {}

    def _resp(self, data, status=200):
        out = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def do_POST(self):
        if self.path.startswith("/health"):
            data = health()
            self._resp(data, 200 if data.get("ok") else 503)
        else:
            self._resp(decide(self._body()))

    def do_GET(self):
        if self.path.startswith("/health"):
            data = health()
            self._resp(data, 200 if data.get("ok") else 503)
        else:
            self._resp(decide(self._body()))

    def log_message(self, *a): pass

if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8099), H).serve_forever()
