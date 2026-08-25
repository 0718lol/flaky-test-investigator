import csv
import hashlib
import io
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from email.parser import BytesParser
from email.policy import default
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SUPPORTED_EXTENSIONS = {".txt", ".log", ".md", ".csv", ".json", ".zip"}
MAX_REQUEST_BYTES = 20 * 1024 * 1024
MAX_FILE_COUNT = 20
MAX_ARCHIVE_FILES = 200
MAX_ARCHIVE_BYTES = 30 * 1024 * 1024
MAX_RECORDS = 500


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def message_time(value):
    if value in (None, ""):
        return "--:--"
    try:
        if isinstance(value, (int, float)) or re.fullmatch(r"\d{10,13}(?:\.\d+)?", str(value)):
            timestamp = float(value)
            if timestamp > 10_000_000_000:
                timestamp /= 1000
            return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%H:%M")
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.strftime("%H:%M")
    except (ValueError, TypeError, OSError):
        match = re.search(r"(?:[01]?\d|2[0-3]):[0-5]\d", str(value))
        return match.group(0) if match else "--:--"


def normalized_record(text, origin, source_type="聊天导出", author="", timestamp=None, channel=""):
    content = clean_text(text)
    if not content:
        return None
    fingerprint = hashlib.sha256(content.lower().encode("utf-8")).hexdigest()[:16]
    return {
        "type": source_type,
        "time": message_time(timestamp),
        "text": content,
        "author": clean_text(author),
        "channel": clean_text(channel),
        "origin": origin,
        "fingerprint": fingerprint,
    }


def first_value(record, names):
    for name in names:
        value = record.get(name)
        if value not in (None, ""):
            return value
    return ""


def parse_json_messages(data, origin, user_map=None, source_type="聊天导出", default_channel=""):
    payload = json.loads(data.decode("utf-8-sig"))
    records = []
    user_map = user_map or {}
    text_fields = ("text", "content", "message", "body")
    time_fields = ("ts", "timestamp", "created_at", "createdAt", "create_time", "time", "date")
    author_fields = ("user_name", "username", "sender_name", "sender", "author", "user", "name")
    channel_fields = ("channel_name", "channel", "conversation", "room")

    def visit(value):
        if len(records) >= MAX_RECORDS:
            return
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return
        text = first_value(value, text_fields)
        if isinstance(text, dict):
            content = first_value(text, ("text", "content", "body"))
            if not content and isinstance(text.get("parts"), list):
                content = "\n".join(str(part) for part in text["parts"] if isinstance(part, (str, int, float)))
            text = content
        if isinstance(text, str) and clean_text(text):
            author = first_value(value, author_fields)
            if isinstance(author, dict):
                author = first_value(author, ("name", "username", "email", "id", "role"))
            author = user_map.get(str(author), author)
            record = normalized_record(
                text,
                origin,
                source_type,
                author,
                first_value(value, time_fields),
                first_value(value, channel_fields) or default_channel,
            )
            if record:
                records.append(record)
            return
        for child in value.values():
            if isinstance(child, (dict, list)):
                visit(child)

    visit(payload)
    return records


def parse_csv_messages(data, origin):
    text = data.decode("utf-8-sig")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t;")
    except csv.Error:
        dialect = csv.excel
    rows = csv.DictReader(io.StringIO(text), dialect=dialect)
    records = []
    for row in rows:
        message = first_value(row, ("text", "message", "content", "body", "消息", "内容"))
        record = normalized_record(
            message,
            origin,
            "聊天 CSV",
            first_value(row, ("author", "sender", "user", "name", "username", "发送人", "用户")),
            first_value(row, ("timestamp", "created_at", "time", "date", "ts", "时间")),
            first_value(row, ("channel", "room", "conversation", "频道", "群组")),
        )
        if record:
            records.append(record)
        if len(records) >= MAX_RECORDS:
            break
    return records


CHAT_LINE = re.compile(
    r"^(?:\[?(?P<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})?\s*(?P<time>(?:[01]?\d|2[0-3]):[0-5]\d)\]?\s*)?(?P<author>[^:：]{1,40})[:：]\s*(?P<text>.+)$"
)


def parse_text_messages(data, origin, source_type="文本记录"):
    text = data.decode("utf-8-sig", errors="replace")
    records = []
    for line in text.splitlines():
        line = clean_text(line)
        if not line:
            continue
        match = CHAT_LINE.match(line)
        if match:
            record = normalized_record(match.group("text"), origin, source_type, match.group("author"), match.group("time"))
        else:
            record = normalized_record(line, origin, source_type)
        if record:
            records.append(record)
        if len(records) >= MAX_RECORDS:
            break
    return records


def slack_user_map(archive):
    for name in archive.namelist():
        if Path(name).name.lower() != "users.json":
            continue
        try:
            users = json.loads(archive.read(name).decode("utf-8-sig"))
            return {
                str(user.get("id")): first_value(user.get("profile", {}), ("display_name", "real_name")) or user.get("real_name") or user.get("name") or user.get("id")
                for user in users if isinstance(user, dict) and user.get("id")
            }
        except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
            return {}
    return {}


def parse_zip_messages(data, origin):
    records = []
    warnings = []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = [item for item in archive.infolist() if not item.is_dir()]
        if len(members) > MAX_ARCHIVE_FILES:
            raise ValueError(f"压缩包文件数超过 {MAX_ARCHIVE_FILES} 个")
        if sum(item.file_size for item in members) > MAX_ARCHIVE_BYTES:
            raise ValueError("压缩包解压后超过 30 MB")
        users = slack_user_map(archive)
        for member in members:
            if len(records) >= MAX_RECORDS:
                warnings.append(f"{origin} 只预览前 {MAX_RECORDS} 条消息")
                break
            name = member.filename
            if Path(name).name.lower() in {"users.json", "channels.json", "integration_logs.json"}:
                continue
            extension = Path(name).suffix.lower()
            if extension not in SUPPORTED_EXTENSIONS - {".zip"}:
                continue
            child_data = archive.read(member)
            child_origin = f"{origin}/{name}"
            if extension == ".json":
                channel = Path(name).parts[-2] if len(Path(name).parts) > 1 else ""
                child_records = parse_json_messages(child_data, child_origin, users, "Slack 导出" if users else "聊天导出", channel)
            elif extension == ".csv":
                child_records = parse_csv_messages(child_data, child_origin)
            else:
                child_records = parse_text_messages(child_data, child_origin)
            records.extend(child_records[: MAX_RECORDS - len(records)])
    return records, warnings


def parse_uploaded_file(filename, data):
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"不支持 {extension or '无扩展名'} 文件")
    if extension == ".zip":
        return parse_zip_messages(data, filename)
    if extension == ".json":
        return parse_json_messages(data, filename), []
    if extension == ".csv":
        return parse_csv_messages(data, filename), []
    return parse_text_messages(data, filename, "日志" if extension == ".log" else "文本记录"), []


def parse_multipart_files(content_type, body):
    envelope = b"Content-Type: " + content_type.encode("ascii", errors="ignore") + b"\r\nMIME-Version: 1.0\r\n\r\n" + body
    message = BytesParser(policy=default).parsebytes(envelope)
    files = []
    for part in message.walk():
        if part.is_multipart():
            continue
        filename = part.get_filename()
        if filename:
            files.append((Path(filename).name, part.get_payload(decode=True) or b""))
    return files


def import_preview(files):
    if not files:
        raise ValueError("没有收到文件")
    if len(files) > MAX_FILE_COUNT:
        raise ValueError(f"一次最多上传 {MAX_FILE_COUNT} 个文件")
    records = []
    warnings = []
    summaries = []
    for filename, data in files:
        try:
            parsed, file_warnings = parse_uploaded_file(filename, data)
            remaining = MAX_RECORDS - len(records)
            accepted = parsed[:remaining]
            records.extend(accepted)
            warnings.extend(file_warnings)
            summaries.append({"name": filename, "records": len(accepted), "status": "parsed"})
            if len(parsed) > remaining:
                warnings.append(f"已达到 {MAX_RECORDS} 条预览上限")
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError, csv.Error, zipfile.BadZipFile) as error:
            summaries.append({"name": filename, "records": 0, "status": "failed", "error": str(error)})
        if len(records) >= MAX_RECORDS:
            break
    return {"files": summaries, "sources": records, "warnings": warnings, "recordCount": len(records)}


class ProductHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def json_response(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/import/formats":
            self.json_response(200, {"extensions": sorted(SUPPORTED_EXTENSIONS), "maxFiles": MAX_FILE_COUNT, "maxBytes": MAX_REQUEST_BYTES, "maxRecords": MAX_RECORDS})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/import/preview":
            self.json_response(404, {"error": "接口不存在"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            content_type = self.headers.get("Content-Type", "")
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("上传内容为空或超过 20 MB")
            if not content_type.startswith("multipart/form-data"):
                raise ValueError("请求必须使用 multipart/form-data")
            files = parse_multipart_files(content_type, self.rfile.read(length))
            self.json_response(200, import_preview(files))
        except ValueError as error:
            self.json_response(400, {"error": str(error)})
        except Exception:
            self.json_response(500, {"error": "文件解析失败，请检查导出格式"})


def main():
    port = int(os.environ["PORT"])
    handler = partial(ProductHandler, directory=str(ROOT))
    ThreadingHTTPServer(("0.0.0.0", port), handler).serve_forever()


if __name__ == "__main__":
    main()
