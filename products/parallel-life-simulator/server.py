#!/usr/bin/env python3

import json
import os
import pathlib
import ssl
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent
DEFAULT_TIMEOUT = 30
MAX_REQUEST_BYTES = 64 * 1024
LOCAL_HOSTS = {'localhost', '127.0.0.1', '::1'}


def normalize_base_url(value: str) -> str:
    raw = str(value or '').strip().rstrip('/')
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        raise ValueError('API 基础地址必须是 http 或 https URL')
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('API 基础地址不能包含用户名、密码、查询参数或片段')
    host = (parsed.hostname or '').lower()
    allow_insecure = os.environ.get('ALLOW_INSECURE_AI_BASE') == '1'
    if parsed.scheme != 'https' and host not in LOCAL_HOSTS and not allow_insecure:
        raise ValueError('非本机地址必须使用 HTTPS')
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip('/'), '', '', ''))


def build_endpoint(base_url: str, path: str) -> str:
    base = normalize_base_url(base_url)
    if not base:
        return ''
    if base.endswith('/v1') and path.startswith('/v1/'):
        return f'{base}{path[3:]}'
    return f'{base}{path}'


def read_json(handler):
    length = int(handler.headers.get('Content-Length', '0') or 0)
    if length > MAX_REQUEST_BYTES:
        raise ValueError('请求体过大')
    raw = handler.rfile.read(length) if length else b'{}'
    try:
        return json.loads(raw.decode('utf-8') or '{}')
    except json.JSONDecodeError:
        raise ValueError('无效的 JSON 请求体')


def write_json(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    handler.end_headers()
    handler.wfile.write(body)


def extract_text(payload):
    choices = payload.get('choices') or []
    if not choices:
        return ''
    choice = choices[0] or {}
    message = choice.get('message') or {}
    if isinstance(message, dict) and message.get('content') is not None:
        return str(message.get('content') or '').strip()
    if choice.get('text') is not None:
        return str(choice.get('text') or '').strip()
    if payload.get('output_text') is not None:
        return str(payload.get('output_text') or '').strip()
    return ''


def proxy_chat_completion(payload):
    try:
        base_url = normalize_base_url(payload.get('baseUrl') or os.environ.get('AI_BASE_URL', ''))
    except ValueError as error:
        return 400, {'ok': False, 'error': str(error)}
    api_key = str(payload.get('apiKey') or os.environ.get('AI_API_KEY', '')).strip()
    model = str(payload.get('model') or os.environ.get('AI_MODEL', 'gpt-luna')).strip() or 'gpt-luna'
    messages = payload.get('messages')
    if not base_url:
        return 400, {'ok': False, 'error': '缺少 API 基础地址'}
    if not api_key:
        return 400, {'ok': False, 'error': '缺少 API 密钥'}
    if not isinstance(messages, list) or not messages:
        return 400, {'ok': False, 'error': '缺少 messages'}
    if len(messages) > 16:
        return 400, {'ok': False, 'error': 'messages 过多'}

    request_body = json.dumps({
        'model': model,
        'messages': messages,
        'temperature': payload.get('temperature', 0.4),
        'max_tokens': payload.get('maxTokens', payload.get('max_tokens', 180)),
        'stream': False,
    }).encode('utf-8')
    request = urllib.request.Request(
        build_endpoint(base_url, '/v1/chat/completions'),
        data=request_body,
        method='POST',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=DEFAULT_TIMEOUT, context=ssl.create_default_context()) as response:
            raw = response.read()
            data = json.loads(raw.decode('utf-8') or '{}')
            text = extract_text(data)
            return 200, {'ok': True, 'model': model, 'text': text, 'usage': data.get('usage')}
    except urllib.error.HTTPError as error:
        try:
            detail = error.read(4096).decode('utf-8')
        except Exception:
            detail = ''
        return error.code, {'ok': False, 'error': detail or error.reason or '上游接口错误'}
    except Exception as error:
        return 502, {'ok': False, 'error': str(error)}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        return

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/llm/chat':
            try:
                payload = read_json(self)
            except ValueError as error:
                write_json(self, 400, {'ok': False, 'error': str(error)})
                return
            status, response = proxy_chat_completion(payload)
            write_json(self, status, response)
            return
        write_json(self, 404, {'ok': False, 'error': 'not found'})


def main():
    port = int(os.environ.get('PORT', '8819'))
    host = os.environ.get('HOST', '0.0.0.0')
    server = ThreadingHTTPServer((host, port), Handler)
    print(f'Serving on http://{host}:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
