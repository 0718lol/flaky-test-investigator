import io
import json
import unittest
import zipfile

from server import import_preview, parse_multipart_files


class ImportPreviewTests(unittest.TestCase):
    def test_text_chat_lines(self):
        result = import_preview([("chat.txt", "09:12 Maya: EU webhook 仍失败\n09:14 Lin: US 正常".encode())])
        self.assertEqual(result["recordCount"], 2)
        self.assertEqual(result["sources"][0]["author"], "Maya")
        self.assertEqual(result["sources"][0]["time"], "09:12")

    def test_csv_export(self):
        data = "time,sender,channel,message\n10:01,Ava,incidents,SSO certificate expired\n".encode()
        result = import_preview([("messages.csv", data)])
        self.assertEqual(result["sources"][0]["channel"], "incidents")
        self.assertEqual(result["sources"][0]["author"], "Ava")

    def test_generic_json_export(self):
        data = json.dumps({"messages": [{"created_at": "2026-08-25T10:15:00Z", "sender": {"name": "Noah"}, "content": "Security review blocked"}]}).encode()
        result = import_preview([("conversation.json", data)])
        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["sources"][0]["author"], "Noah")

    def test_slack_zip_uses_user_names(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("users.json", json.dumps([{"id": "U1", "profile": {"display_name": "Zhou"}}]))
            archive.writestr("incident/2026-08-25.json", json.dumps([{"type": "message", "user": "U1", "ts": "1787652000.000", "text": "Rollback completed"}]))
        result = import_preview([("slack-export.zip", output.getvalue())])
        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["sources"][0]["type"], "Slack 导出")
        self.assertEqual(result["sources"][0]["author"], "Zhou")
        self.assertEqual(result["sources"][0]["channel"], "incident")

    def test_parts_based_conversation_json(self):
        data = json.dumps({"mapping": {"node": {"message": {"author": {"role": "user"}, "create_time": 1787652000, "content": {"parts": ["Payment callback failed"]}}}}}).encode()
        result = import_preview([("conversations.json", data)])
        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["sources"][0]["author"], "user")

    def test_multipart_file_extraction(self):
        boundary = "relay-test"
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"chat.txt\"\r\n"
            "Content-Type: text/plain\r\n\r\n09:12 Maya: test\r\n"
            f"--{boundary}--\r\n"
        ).encode()
        files = parse_multipart_files(f"multipart/form-data; boundary={boundary}", body)
        self.assertEqual(files[0][0], "chat.txt")
        self.assertIn(b"Maya", files[0][1])


if __name__ == "__main__":
    unittest.main()
