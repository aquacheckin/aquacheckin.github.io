#!/usr/bin/env python
"""
Local dev server for Aqua-Checkin with CORRECT MIME types.

Use this instead of `python -m http.server`. On Windows the built-in server
reads the .js MIME type from the registry, which is often "text/html" or
"text/plain" -- and browsers refuse to run an ES `type="module"` script that
isn't served as JavaScript, giving:

    Failed to load module script: Expected a JavaScript-or-Wasm module script
    but the server responded with a MIME type of "text/plain".

This server forces the right types so modules load.

    python serve.py            # http://localhost:8000
    python serve.py 8080       # custom port
"""
import sys
import http.server
import socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".html": "text/html",
        ".wasm": "application/wasm",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        # avoid cached stale modules during development
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Aqua-Checkin dev server:  http://localhost:{PORT}/")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
