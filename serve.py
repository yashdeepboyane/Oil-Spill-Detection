import http.server
import socketserver
import os
import sys

PORT = 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class SPALocalHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        if path.endswith(".css"):
            return "text/css"
        if path.endswith(".svg"):
            return "image/svg+xml"
        return super().guess_type(path)

    def do_GET(self):
        # Translate requested path to local filesystem
        requested_path = self.translate_path(self.path)
        # If file does not exist and doesn't have an extension, serve index.html (SPA routing)
        if not os.path.exists(requested_path) and '.' not in os.path.basename(self.path):
            self.path = '/index.html'
        return super().do_GET()

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with ThreadedHTTPServer(("", port), SPALocalHandler) as httpd:
        print(f"OceanGuard local server running at http://localhost:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
