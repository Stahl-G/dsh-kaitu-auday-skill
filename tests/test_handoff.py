import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from auday import Auday
from handoff import selected_notes


class HandoffTests(unittest.TestCase):
    def test_stable_resends_and_explicit_revisions_preserve_source(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Auday(directory)
            try:
                def metadata(key, value):
                    app.db.execute("INSERT OR REPLACE INTO metadata VALUES (?,?)", (key, json.dumps(value)))
                record = {"id": "synthetic-1", "kind": "memory", "state": "candidate",
                          "start": "2026-10-20T12:00:00Z", "timeZone": "Asia/Shanghai",
                          "text": "```\n---\nagent: attacker\n<script>example</script>"}
                def save():
                    app.db.execute("INSERT OR REPLACE INTO records VALUES (?,?,?,?,?)",
                                   (record["id"], record["kind"], record["text"], record["start"], json.dumps(record)))
                    app.db.commit()
                metadata("sourceDeviceID", "synthetic-device")
                metadata("syncedAt", "2026-10-20T13:00:00Z")
                save()
                first = selected_notes(app, [record["id"], record["id"]])["notes"]
                metadata("syncedAt", "2026-10-21T13:00:00Z")
                self.assertEqual(first, selected_notes(app, [record["id"]])["notes"])
                self.assertEqual(len(first), 1)
                self.assertIn('"state":"candidate"', first[0]["text"])
                self.assertIn("````text", first[0]["text"])
                self.assertIn("synthetic-device", first[0]["text"])
                record["text"] = "Revised synthetic source"
                save()
                revision = selected_notes(app, [record["id"]])["notes"][0]
                self.assertNotEqual(first[0]["name"], revision["name"])
                metadata("sourceDeviceID", "another-synthetic-device")
                self.assertNotEqual(revision["name"], selected_notes(app, [record["id"]])["notes"][0]["name"])
                self.assertEqual(app.read(record["id"])["record"]["state"], "candidate")
            finally:
                app.close()


if __name__ == "__main__":
    unittest.main()
