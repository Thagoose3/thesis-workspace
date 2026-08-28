#!/usr/bin/env python3
"""
ThesisMind Local Development & Web Server
Serves the web application and launches the browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 5173
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class ThesisMindHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers for smooth PDF and ES Module loading
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.css'):
            return 'text/css'
        if path.endswith('.pdf'):
            return 'application/pdf'
        if path.endswith('.json'):
            return 'application/json'
        return super().guess_type(path)

def main():
    os.chdir(DIRECTORY)
    port = PORT

    while True:
        try:
            with socketserver.TCPServer(("", port), ThesisMindHTTPHandler) as httpd:
                url = f"http://localhost:{port}"
                print("=======================================================")
                print("  [ThesisMind] Thesis Reading & Research Workspace")
                print(f"  Running at: {url}")
                print(f"  Serving Directory: {DIRECTORY}")
                print("=======================================================")
                print("Press Ctrl+C to stop the server.\n")

                # Open browser
                webbrowser.open(url)
                httpd.serve_forever()
                break
        except OSError:
            port += 1

if __name__ == '__main__':
    main()
