#!/usr/bin/env python3
"""PlaneFlow OTA responder — per-channel update manifest + health status.

Каналы (prod ⟂ dev, см. docs/dev-environment.md):
    GET/POST /updates       → /opt/capgo-ota/updates.json        (прод, push в main)
    GET/POST /updates/dev   → /opt/capgo-ota/updates-dev.json    (дев,  push в dev)
Имя канала из URL выбирает КЛЮЧ в фиксированном словаре CHANNEL_MANIFESTS; само имя
файла — константа, не строится из пользовательского ввода. Поэтому обход каталога
невозможен в принципе (а не «отфильтрован»). Неизвестный канал/нет манифеста → 404.
Новый канал = одна строка в CHANNEL_MANIFESTS.
"""

from __future__ import annotations  # str | None в аннотациях работает и на Python < 3.10

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

OTA_DIR     = "/opt/capgo-ota"
BUNDLES_DIR = os.path.join(OTA_DIR, "bundles")
PORT        = 8099

# Канал из URL → имя файла-манифеста. Ввод выбирает ключ; значение — литерал, поэтому
# путь не зависит от данных запроса (нет «uncontrolled data in path expression»).
CHANNEL_MANIFESTS = {
    "":    "updates.json",      # прод: /updates
    "dev": "updates-dev.json",  # дев:  /updates/dev
}


def _manifest_path(channel: str | None) -> str | None:
    """Путь к манифесту канала, или None если канал не зарегистрирован."""
    name = CHANNEL_MANIFESTS.get(channel or "")
    if name is None:
        return None
    return os.path.join(OTA_DIR, name)


class OTAHandler(BaseHTTPRequestHandler):

    def _health_data(self) -> bytes:
        try:
            with open(_manifest_path(None)) as f:
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

    def _channel_from_path(self, path: str) -> str | None:
        # "/updates" → None (прод); "/updates/dev" → "dev".
        rest = path[len("/updates"):].strip("/")
        return rest or None

    def _serve_manifest(self, channel: str | None, write_body: bool = True) -> None:
        manifest = _manifest_path(channel)
        if manifest is None:
            self.send_error(404, "Unknown channel")
            return
        try:
            with open(manifest, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if write_body:
                self.wfile.write(body)
        except FileNotFoundError:
            self.send_error(404, "No manifest yet")

    def _drain_body(self) -> None:
        # Прочитать тело запроса до конца, иначе keep-alive-сокет зависнет.
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length:
            self.rfile.read(length)

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")

        if path == "/health":
            body = self._health_data()
            self._health_headers(body)
            self.wfile.write(body)

        elif path == "/updates" or path.startswith("/updates/"):
            self._serve_manifest(self._channel_from_path(path))

        else:
            self.send_error(404)

    def do_POST(self):
        # Capgo v5 (@capgo/capacitor-updater) шлёт проверку обновления на updateUrl
        # методом POST с JSON-телом параметров устройства, а НЕ GET. Без do_POST
        # BaseHTTPRequestHandler отвечает 501 → плагин видит "getLatest failed" и
        # тихо остаётся на встроенном бандле. Отдаём тот же манифест, что и GET.
        path = self.path.split("?")[0].rstrip("/")
        self._drain_body()
        if path == "/updates" or path.startswith("/updates/"):
            self._serve_manifest(self._channel_from_path(path))
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
