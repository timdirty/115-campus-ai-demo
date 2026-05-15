#!/usr/bin/env python3
"""
Local EasyOCR service for App 1 whiteboard text recognition.

Start  : python3 server/ocr_service.py
         (or: npm run ocr)

Routes :
  GET  /health       → {"ok": true}
  POST /ocr          → body: {"imageBase64": "data:image/...;base64,..."}
                        resp: {"ok": true, "text": "...", "blocks": [...], "engine": "easyocr"}

Fallback: if easyocr is not installed, returns {"ok": false, "error": "easyocr not installed"}.
Install : bash scripts/setup-ocr-env.sh
"""

import base64
import io
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 3209

# Cache the reader across requests so the model is only loaded once.
_reader = None


def get_reader():
    global _reader
    if _reader is None:
        import easyocr  # type: ignore
        # ch_tra = Traditional Chinese (used in Taiwan classrooms)
        _reader = easyocr.Reader(['ch_tra', 'en'], gpu=False, verbose=False)
    return _reader


def decode_image(image_base64: str) -> bytes:
    match = re.match(r'data:image/[^;]+;base64,(.+)', image_base64, re.DOTALL)
    b64 = match.group(1) if match else image_base64
    return base64.b64decode(b64.strip())


def run_ocr(image_bytes: bytes) -> dict:
    try:
        import numpy as np  # type: ignore
        from PIL import Image  # type: ignore

        reader = get_reader()
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        arr = np.array(img)
        results = reader.readtext(arr)

        blocks = [
            {
                'text': text,
                'confidence': round(float(score), 3),
                'bbox': [[int(p[0]), int(p[1])] for p in bbox],
            }
            for bbox, text, score in results
        ]
        # Only keep blocks with reasonable confidence
        good_blocks = [b for b in blocks if b['confidence'] > 0.25]
        full_text = '\n'.join(b['text'] for b in good_blocks)

        return {
            'ok': True,
            'text': full_text,
            'blocks': good_blocks,
            'engine': 'easyocr',
        }

    except ImportError as e:
        return {'ok': False, 'text': '', 'blocks': [], 'engine': 'none', 'error': str(e)}
    except Exception as e:
        return {'ok': False, 'text': '', 'blocks': [], 'engine': 'none', 'error': str(e)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress noisy access log; errors are printed below

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self._json(200, {'ok': True, 'port': PORT})
        else:
            self._json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path != '/ocr':
            self._json(404, {'error': 'not found'})
            return

        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length)

        try:
            data = json.loads(raw)
            image_base64 = data.get('imageBase64', '')
            if not image_base64:
                raise ValueError('imageBase64 is required')
            image_bytes = decode_image(image_base64)
            result = run_ocr(image_bytes)
        except Exception as exc:
            result = {'ok': False, 'text': '', 'blocks': [], 'engine': 'none', 'error': str(exc)}

        self._json(200, result)


if __name__ == '__main__':
    print(f'[OCR] 白板文字辨識服務啟動中 (port {PORT})…')

    # Warm up the model on start so the first request is fast.
    try:
        get_reader()
        print('[OCR] EasyOCR 模型已載入，準備就緒。')
    except ImportError:
        print('[OCR] 警告：easyocr 未安裝，請執行：bash scripts/setup-ocr-env.sh')
        print('[OCR] 服務仍會啟動，但 /ocr 端點會回傳 ok:false。')
    except Exception as exc:
        print(f'[OCR] 模型載入失敗：{exc}')

    httpd = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f'[OCR] 服務就緒 → http://127.0.0.1:{PORT}')
    print('[OCR] Ctrl-C 停止')

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n[OCR] 服務已停止。')
        sys.exit(0)
