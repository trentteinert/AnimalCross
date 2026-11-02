#!/usr/bin/env python3
"""Tiny dev server: serves the project and lets the map editor save maps/island.json (PUT).
Usage: python3 server.py [port]   (binds to localhost only)"""
import http.server, json, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
ROOT = os.path.dirname(os.path.abspath(__file__))
import re
MAP_RE = re.compile(r'^/maps/([a-z0-9_-]{1,24})\.json$')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_PUT(self):
        m = MAP_RE.match(self.path.split('?')[0])
        if not m:
            self.send_error(405, 'Only /maps/<name>.json can be saved')
            return
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > 2_000_000:
            self.send_error(413, 'Bad size')
            return
        try:
            data = json.loads(self.rfile.read(n))
            assert data.get('v') == 1 and len(data['tiles']) == 64
        except Exception:
            self.send_error(400, 'Not a valid map')
            return
        os.makedirs(os.path.join(ROOT, 'maps'), exist_ok=True)
        with open(os.path.join(ROOT, 'maps', m.group(1) + '.json'), 'w') as f:
            json.dump(data, f, separators=(',', ':'))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'saved')


if __name__ == '__main__':
    class Server(http.server.ThreadingHTTPServer):
        request_queue_size = 256  # the page asks for a dozen files at once
    Server(('127.0.0.1', PORT), Handler).serve_forever()
