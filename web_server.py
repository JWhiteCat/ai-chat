"""
LLM Chat Frontend - Web Server
Serves static files, config API, and message proxy
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import os
import sys
import json

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')


def load_config():
    """Load server configuration file"""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Failed to read config file ({e}), using defaults")
        return {}


class CORSRequestHandler(SimpleHTTPRequestHandler):
    """Request handler with CORS support"""

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/config':
            self.handle_config()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/messages':
            self.handle_messages()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def handle_config(self):
        """Return server config (without exposing API Key)"""
        config = load_config()
        api_key = config.get('api_key', '')

        if api_key and len(api_key) > 12:
            masked_key = api_key[:8] + '...' + api_key[-4:]
        elif api_key:
            masked_key = '****'
        else:
            masked_key = ''

        response = {
            'has_server_key': bool(api_key),
            'api_key_masked': masked_key,
            'base_url': config.get('base_url', ''),
            'allowed_models': config.get('allowed_models', [])
        }

        self.send_json(200, response)

    def handle_messages(self):
        """Proxy message requests to Anthropic API with model validation"""
        config = load_config()

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            request_data = json.loads(body)
        except json.JSONDecodeError:
            self.send_json_error(400, 'Invalid request body')
            return

        allowed_models = config.get('allowed_models', [])
        if allowed_models:
            allowed_ids = [m['id'] for m in allowed_models]
            requested_model = request_data.get('model', '')
            if requested_model not in allowed_ids:
                self.send_json_error(403, f'Model {requested_model} is not in the allowed list')
                return

        api_key = config.get('api_key', '') or self.headers.get('x-api-key', '')
        if not api_key:
            self.send_json_error(401, 'API Key not configured')
            return

        base_url = config.get('base_url', '') or 'https://api.anthropic.com'
        url = f'{base_url}/v1/messages'

        req = Request(
            url,
            data=json.dumps(request_data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key,
                'anthropic-version': self.headers.get('anthropic-version', '2023-06-01')
            },
            method='POST'
        )

        try:
            resp = urlopen(req)
            self.send_response(resp.status)
            for header, value in resp.getheaders():
                if header.lower() in ('content-type', 'transfer-encoding'):
                    self.send_header(header, value)
            # Disable buffering to ensure streaming works on mobile
            self.send_header('X-Accel-Buffering', 'no')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()

            while True:
                chunk = resp.read(4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()

        except HTTPError as e:
            error_body = e.read().decode('utf-8', errors='replace')
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_body.encode('utf-8'))
        except URLError as e:
            self.send_json_error(502, f'Unable to connect to API: {e.reason}')

    def send_json(self, code, data):
        """Send JSON response"""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def send_json_error(self, code, message):
        """Send JSON error response"""
        self.send_json(code, {'error': {'message': message}})

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


def run_server(port=8080, directory='static'):
    if not os.path.exists(directory):
        print(f"Error: Directory '{directory}' does not exist")
        print(f"Current directory: {os.getcwd()}")
        return

    os.chdir(directory)

    httpd = HTTPServer(('', port), CORSRequestHandler)

    print('=' * 60)
    print(f'LLM Chat Frontend started!')
    print(f'URL: http://localhost:{port}')
    print(f'Static files directory: {os.getcwd()}')
    print(f'Config file: {CONFIG_FILE}')
    print('=' * 60)
    print('\nPress Ctrl+C to stop the server\n')

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\nServer stopped')
        httpd.server_close()


if __name__ == '__main__':
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Warning: Invalid port number '{sys.argv[1]}', using default port 8080")

    run_server(port=port)
