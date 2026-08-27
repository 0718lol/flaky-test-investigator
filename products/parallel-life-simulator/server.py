#!/usr/bin/env python3

import json
import os
import pathlib
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent
DEFAULT_TIMEOUT = 30
MAX_REQUEST_BYTES = 64 * 1024
LOCAL_HOSTS = {'localhost', '127.0.0.1', '::1'}
ALLOWED_AI_MODELS = {'deepseek-chat'}
AI_STATUS_TTL_SECONDS = 300
AI_STATUS_CACHE = {'checked_at': 0.0, 'connected': False}
AI_STATUS_LOCK = threading.Lock()


def load_local_env(path: pathlib.Path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        if key not in {'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'AI_TIMEOUT_SECONDS'}:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


load_local_env(ROOT / '.env')


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
    handler.end_headers()
    handler.wfile.write(body)


def is_same_origin(handler):
    origin = handler.headers.get('Origin', '').strip()
    if not origin:
        return True
    parsed = urllib.parse.urlparse(origin)
    return parsed.scheme in {'http', 'https'} and parsed.netloc == handler.headers.get('Host', '')


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


def ai_settings():
    base_url = os.environ.get('AI_BASE_URL', 'https://api.deepseek.com').strip()
    api_key = os.environ.get('AI_API_KEY', '').strip()
    model = os.environ.get('AI_MODEL', 'deepseek-chat').strip() or 'deepseek-chat'
    try:
        timeout = max(5, min(120, int(os.environ.get('AI_TIMEOUT_SECONDS', DEFAULT_TIMEOUT))))
    except ValueError:
        timeout = DEFAULT_TIMEOUT
    return {'base_url': base_url, 'api_key': api_key, 'model': model, 'timeout': timeout}


def ai_status():
    settings = ai_settings()
    configured = bool(settings['base_url'] and settings['api_key'] and settings['model'] in ALLOWED_AI_MODELS)
    return {
        'configured': configured,
        'enabled': configured,
        'connected': False,
        'provider': 'DeepSeek',
        'model': settings['model'],
        'mode': 'fast',
    }


def probed_ai_status():
    status = ai_status()
    if not status['configured']:
        status['enabled'] = False
        return status
    current_time = time.monotonic()
    with AI_STATUS_LOCK:
        if current_time - AI_STATUS_CACHE['checked_at'] >= AI_STATUS_TTL_SECONDS:
            code, payload = proxy_chat_completion({
                'messages': [{'role': 'user', 'content': '只回答 pong'}],
                'temperature': 0,
                'maxTokens': 8,
            })
            AI_STATUS_CACHE.update({
                'checked_at': time.monotonic(),
                'connected': code == 200 and bool(payload.get('text')),
            })
        status['connected'] = AI_STATUS_CACHE['connected']
        status['enabled'] = status['connected']
    return status


def proxy_chat_completion(payload):
    settings = ai_settings()
    try:
        base_url = normalize_base_url(settings['base_url'])
    except ValueError as error:
        return 400, {'ok': False, 'error': str(error)}
    api_key = settings['api_key']
    model = settings['model']
    messages = payload.get('messages')
    if not base_url:
        return 400, {'ok': False, 'error': '缺少 API 基础地址'}
    if not api_key:
        return 503, {'ok': False, 'error': 'DeepSeek 尚未配置'}
    if model not in ALLOWED_AI_MODELS:
        return 503, {'ok': False, 'error': '只允许使用 DeepSeek 非思考模型 deepseek-chat'}
    if not isinstance(messages, list) or not messages:
        return 400, {'ok': False, 'error': '缺少 messages'}
    if len(messages) > 16:
        return 400, {'ok': False, 'error': 'messages 过多'}
    normalized_messages = []
    total_characters = 0
    for message in messages:
        if not isinstance(message, dict) or message.get('role') not in {'system', 'user', 'assistant'}:
            return 400, {'ok': False, 'error': 'message role 不受支持'}
        content = message.get('content')
        if not isinstance(content, str) or not content.strip():
            return 400, {'ok': False, 'error': 'message content 必须是非空文本'}
        total_characters += len(content)
        if total_characters > 48_000:
            return 400, {'ok': False, 'error': 'messages 内容过长'}
        normalized_messages.append({'role': message['role'], 'content': content})
    try:
        temperature = max(0.0, min(1.0, float(payload.get('temperature', 0.4))))
        max_tokens = max(1, min(2200, int(payload.get('maxTokens', payload.get('max_tokens', 180)))))
    except (TypeError, ValueError):
        return 400, {'ok': False, 'error': '生成参数无效'}

    request_body = json.dumps({
        'model': model,
        'messages': normalized_messages,
        'temperature': temperature,
        'max_tokens': max_tokens,
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
        with urllib.request.urlopen(request, timeout=settings['timeout'], context=ssl.create_default_context()) as response:
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
        write_json(self, 405, {'ok': False, 'error': 'cross-origin requests are not allowed'})

    def do_GET(self):
        if self.path == '/api/llm/status':
            write_json(self, 200, probed_ai_status())
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/llm/chat':
            if not is_same_origin(self):
                write_json(self, 403, {'ok': False, 'error': '只允许产品同源请求'})
                return
            if self.headers.get_content_type() != 'application/json':
                write_json(self, 415, {'ok': False, 'error': '请求必须使用 application/json'})
                return
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
