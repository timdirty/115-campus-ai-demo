#!/usr/bin/env python3
"""Standalone LLM admin console for App 2 / App 3.

This script does not modify or import the apps. It reads each app's .env,
calls Google AI Studio directly, and stores its own usage log in:

  data/llm-admin-usage.json

Run:

  python3 scripts/llm_admin.py
  open http://localhost:3210
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
USAGE_FILE = DATA_DIR / "llm-admin-usage.json"

APPS = {
    "app2": {
        "label": "App 2 校園服務機器人",
        "env": ROOT / "google ai studio/app_2（國小）/校園服務機器人 app/.env",
        "default_model": "gemini-3.5-flash",
        "system": "你是國小校園服務機器人的教學與派遣助理。請用繁體中文，短句、可執行。",
    },
    "app3": {
        "label": "App 3 AI校園心靈守護者",
        "env": ROOT / "google ai studio/app_3（國中）/AI校園心靈守護者/.env",
        "default_model": "gemini-3.5-flash",
        "system": "你是國中校園心靈守護系統助理。請用繁體中文，溫暖、非診斷、可執行。",
    },
}


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text("utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


def app_config(app_id: str) -> dict[str, object]:
    app = APPS[app_id]
    env = read_env(app["env"])
    key = (
        env.get("GEMINI_API_KEY")
        or env.get("GOOGLE_API_KEY")
        or env.get("GOOGLE_AI_STUDIO_API_KEY")
        or os.environ.get(f"{app_id.upper()}_GEMINI_API_KEY")
        or ""
    )
    model = env.get("GEMINI_MODEL") or env.get("GOOGLE_AI_MODEL") or app["default_model"]
    return {
        "id": app_id,
        "label": app["label"],
        "envPath": str(app["env"]),
        "hasKey": bool(key),
        "key": key,
        "model": model,
        "system": app["system"],
    }


def load_records() -> list[dict[str, object]]:
    try:
        parsed = json.loads(USAGE_FILE.read_text("utf-8"))
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def save_records(records: list[dict[str, object]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    USAGE_FILE.write_text(json.dumps(records[:500], ensure_ascii=False, indent=2), "utf-8")


def estimate_tokens(text: str) -> int:
    return max(0, (len(text) + 3) // 4)


def usage_number(value: object, fallback: int) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
        return number if number >= 0 else fallback
    except Exception:
        return fallback


def summarize(app_id: str) -> dict[str, object]:
    records = [record for record in load_records() if record.get("app") == app_id]
    totals = {
        "requests": len(records),
        "success": sum(1 for item in records if item.get("status") == "success"),
        "error": sum(1 for item in records if item.get("status") == "error"),
        "promptTokens": sum(int(item.get("promptTokens") or 0) for item in records),
        "outputTokens": sum(int(item.get("outputTokens") or 0) for item in records),
        "totalTokens": sum(int(item.get("totalTokens") or 0) for item in records),
    }
    config = app_config(app_id)
    return {
        "id": app_id,
        "label": config["label"],
        "hasKey": config["hasKey"],
        "model": config["model"],
        "envPath": config["envPath"],
        "totals": totals,
        "latest": records[0] if records else None,
        "records": records[:80],
    }


def call_google_ai_studio(app_id: str, prompt: str, model_override: str | None = None) -> dict[str, object]:
    config = app_config(app_id)
    key = str(config["key"])
    model = (model_override or str(config["model"])).strip()
    system = str(config["system"])
    started = time.time()

    if not key:
        raise RuntimeError(f"{app_id} missing GEMINI_API_KEY / GOOGLE_API_KEY in {config['envPath']}")

    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + urllib.parse.quote(model, safe="")
        + ":generateContent?key="
        + urllib.parse.quote(key, safe="")
    )
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": system + "\n\n" + prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 900,
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        # Some macOS framework Python installs do not have CA roots wired up.
        # This admin server is local-only by default, so retry the Google API call
        # with an unverified context rather than forcing extra dependencies.
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(request, timeout=45, context=context) as response:
            payload = json.loads(response.read().decode("utf-8"))

    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    output = "".join(str(part.get("text", "")) for part in parts).strip()
    usage = payload.get("usageMetadata") or {}
    full_prompt = system + "\n\n" + prompt
    prompt_tokens = usage_number(usage.get("promptTokenCount"), estimate_tokens(full_prompt))
    output_tokens = usage_number(usage.get("candidatesTokenCount"), estimate_tokens(output))
    total_tokens = usage_number(usage.get("totalTokenCount"), prompt_tokens + output_tokens)
    record = {
        "id": int(time.time() * 1000),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "app": app_id,
        "appLabel": config["label"],
        "provider": "google-ai-studio",
        "model": model,
        "status": "success",
        "latencyMs": int((time.time() - started) * 1000),
        "promptTokens": prompt_tokens,
        "outputTokens": output_tokens,
        "totalTokens": total_tokens,
        "promptPreview": prompt[:1600],
        "output": output,
        "outputPreview": output[:4000],
    }
    records = load_records()
    save_records([record, *records])
    return record


def clear_app_records(app_id: str) -> None:
    save_records([record for record in load_records() if record.get("app") != app_id])


HTML = r"""<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LLM 後台管理</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f7f8fb; color: #111827; }
    header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 22px; border-bottom: 1px solid #dfe3ea; background: rgba(255,255,255,.94); backdrop-filter: blur(12px); }
    h1 { margin: 0; font-size: 20px; }
    main { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: calc(100vh - 66px); }
    aside { border-right: 1px solid #dfe3ea; background: #fff; padding: 14px; }
    button { border: 1px solid #d4d9e3; background: #fff; color: #111827; border-radius: 8px; min-height: 38px; padding: 0 12px; font-weight: 800; cursor: pointer; }
    button.primary { background: #0f766e; border-color: #0f766e; color: white; }
    button.danger { color: #b91c1c; border-color: #fecaca; background: #fff7f7; }
    button.tab { width: 100%; text-align: left; margin-bottom: 8px; min-height: 52px; }
    button.tab.active { background: #e6fffb; border-color: #0f766e; color: #0f766e; }
    section { padding: 18px; }
    .grid { display: grid; gap: 12px; }
    .stats { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .card { border: 1px solid #dfe3ea; background: #fff; border-radius: 8px; padding: 14px; }
    .label { margin: 0 0 6px; color: #667085; font-size: 12px; font-weight: 900; }
    .value { margin: 0; font-size: 24px; font-weight: 950; }
    .muted { color: #667085; font-size: 13px; }
    textarea, input { width: 100%; border: 1px solid #cfd6e2; border-radius: 8px; padding: 10px; font: inherit; background: white; }
    textarea { min-height: 120px; resize: vertical; line-height: 1.5; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, .8fr); gap: 12px; }
    .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .record { display: grid; gap: 6px; padding: 10px 0; border-top: 1px solid #edf0f5; }
    .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 8px; font-size: 12px; font-weight: 900; background: #eef2ff; color: #3730a3; }
    .ok { background: #ecfdf3; color: #047857; }
    .bad { background: #fef2f2; color: #b91c1c; }
    @media (max-width: 860px) { main, .split, .stats { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid #dfe3ea; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>LLM 後台管理</h1>
      <div class="muted">App 2 / App 3 Google AI Studio 輸出與用量監看</div>
    </div>
    <div class="toolbar">
      <span id="lastRefresh" class="muted">尚未刷新</span>
      <button onclick="refresh()">刷新</button>
    </div>
  </header>
  <main>
    <aside>
      <button id="tab-app2" class="tab active" onclick="selectApp('app2')">App 2<br><span class="muted">校園服務機器人</span></button>
      <button id="tab-app3" class="tab" onclick="selectApp('app3')">App 3<br><span class="muted">心靈守護者</span></button>
      <div class="card">
        <p class="label">狀態</p>
        <p id="keyStatus" class="muted">讀取中</p>
      </div>
    </aside>
    <section class="grid">
      <div class="grid stats">
        <div class="card"><p class="label">請求數</p><p id="requests" class="value">0</p></div>
        <div class="card"><p class="label">成功</p><p id="success" class="value">0</p></div>
        <div class="card"><p class="label">錯誤</p><p id="errors" class="value">0</p></div>
        <div class="card"><p class="label">總 Tokens</p><p id="tokens" class="value">0</p></div>
        <div class="card"><p class="label">模型</p><p id="model" class="value" style="font-size:16px">--</p></div>
      </div>

      <div class="split">
        <div class="card grid">
          <div class="toolbar" style="justify-content:space-between">
            <strong>測試 Prompt</strong>
            <button class="danger" onclick="clearRecords()">清空此 App 紀錄</button>
          </div>
          <label>
            <span class="label">模型</span>
            <input id="modelInput" placeholder="gemini-3.5-flash" />
          </label>
          <label>
            <span class="label">輸入</span>
            <textarea id="prompt">請用一句繁體中文說明目前 LLM 後台已連線。</textarea>
          </label>
          <div class="toolbar">
            <button class="primary" onclick="sendPrompt()">送出並記錄用量</button>
            <span id="busy" class="muted"></span>
          </div>
        </div>

        <div class="card grid">
          <div class="toolbar" style="justify-content:space-between">
            <strong>即時模型輸出</strong>
            <span id="latestStatus" class="pill">等待</span>
          </div>
          <pre id="latestOutput">尚無輸出</pre>
        </div>
      </div>

      <div class="card">
        <div class="toolbar" style="justify-content:space-between">
          <strong>最近紀錄</strong>
          <span class="muted">每 1.5 秒自動刷新</span>
        </div>
        <div id="records"></div>
      </div>
    </section>
  </main>
  <script>
    let activeApp = 'app2';
    let state = {};

    function fmt(n) { return Number(n || 0).toLocaleString(); }
    function current() { return state[activeApp] || {}; }

    function selectApp(app) {
      activeApp = app;
      document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + app).classList.add('active');
      render();
    }

    async function refresh() {
      const res = await fetch('/api/status');
      state = await res.json();
      document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString();
      render();
    }

    function render() {
      const data = current();
      const totals = data.totals || {};
      document.getElementById('requests').textContent = fmt(totals.requests);
      document.getElementById('success').textContent = fmt(totals.success);
      document.getElementById('errors').textContent = fmt(totals.error);
      document.getElementById('tokens').textContent = fmt(totals.totalTokens);
      document.getElementById('model').textContent = data.model || '--';
      document.getElementById('modelInput').value = data.model || '';
      document.getElementById('keyStatus').innerHTML = data.hasKey
        ? '<span class="pill ok">API Key 已設定</span><br><span class="muted">' + data.envPath + '</span>'
        : '<span class="pill bad">缺少 API Key</span><br><span class="muted">' + (data.envPath || '') + '</span>';

      const latest = data.latest;
      const latestStatus = document.getElementById('latestStatus');
      latestStatus.textContent = latest ? latest.status : '等待';
      latestStatus.className = 'pill ' + (latest?.status === 'success' ? 'ok' : latest ? 'bad' : '');
      document.getElementById('latestOutput').textContent = latest?.output || latest?.error || '尚無輸出';

      const records = document.getElementById('records');
      records.innerHTML = (data.records || []).map(item => `
        <div class="record">
          <div class="toolbar">
            <span class="pill ${item.status === 'success' ? 'ok' : 'bad'}">${item.status}</span>
            <strong>${item.model || '--'}</strong>
            <span class="muted">${item.createdAt || ''}</span>
            <span class="muted">${fmt(item.totalTokens)} tokens · ${fmt(item.latencyMs)} ms</span>
          </div>
          <pre>${(item.outputPreview || item.output || item.error || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>
        </div>
      `).join('') || '<p class="muted">尚無紀錄</p>';
    }

    async function sendPrompt() {
      const busy = document.getElementById('busy');
      busy.textContent = '模型回覆中...';
      try {
        const res = await fetch('/api/test', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({app: activeApp, prompt: document.getElementById('prompt').value, model: document.getElementById('modelInput').value})
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'request failed');
        await refresh();
      } catch (error) {
        document.getElementById('latestOutput').textContent = String(error.message || error);
      } finally {
        busy.textContent = '';
      }
    }

    async function clearRecords() {
      if (!confirm('清空 ' + activeApp + ' 的後台用量紀錄？')) return;
      await fetch('/api/clear', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({app: activeApp})});
      await refresh();
    }

    refresh();
    setInterval(refresh, 1500);
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: object) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self) -> None:
        if self.path == "/":
            encoded = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        if self.path == "/api/status":
            self.send_json(200, {app_id: summarize(app_id) for app_id in APPS})
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        try:
            payload = self.read_json()
            if self.path == "/api/test":
                app_id = str(payload.get("app") or "")
                prompt = str(payload.get("prompt") or "").strip()
                model = str(payload.get("model") or "").strip() or None
                if app_id not in APPS:
                    self.send_json(400, {"error": "unknown app"})
                    return
                if not prompt:
                    self.send_json(400, {"error": "prompt required"})
                    return
                self.send_json(200, call_google_ai_studio(app_id, prompt, model))
                return
            if self.path == "/api/clear":
                app_id = str(payload.get("app") or "")
                if app_id not in APPS:
                    self.send_json(400, {"error": "unknown app"})
                    return
                clear_app_records(app_id)
                self.send_json(200, {"ok": True})
                return
            self.send_json(404, {"error": "not found"})
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            self.send_json(exc.code, {"error": body[:1200]})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[llm-admin] {self.address_string()} {fmt % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Standalone LLM admin console")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3210)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"LLM admin console: http://{args.host}:{args.port}")
    print("Usage log:", USAGE_FILE)
    server.serve_forever()


if __name__ == "__main__":
    main()
