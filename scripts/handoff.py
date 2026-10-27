"""Render selected cached records for an inbox without changing phone data."""

import hashlib
import json
from library_export import literal_block, record_day


def selected_notes(app, identities):
    """Return deterministic filenames and inert Markdown; export time is excluded."""
    if not isinstance(identities, list) or not 1 <= len(identities) <= 100:
        raise ValueError("select_1_to_100_records")
    metadata = app.metadata()
    device = metadata.get("sourceDeviceID")
    if not device or not metadata.get("syncedAt"):
        raise ValueError("no_synced_source")
    notes = []
    for identity in dict.fromkeys(identities):
        if not isinstance(identity, str):
            raise ValueError("invalid_record_id")
        record = app.read(identity)["record"]
        raw = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        source = hashlib.sha256(json.dumps([device, identity]).encode()).hexdigest()
        revision = hashlib.sha256(raw.encode()).hexdigest()
        # Keep source state and complete payload together; never promote memory state.
        content = "---\nagent: Auday\nkind: auday-source\n---\n\n# Auday\n\n"
        content += literal_block(json.dumps({"sourceDeviceID": device, "revision": revision}, sort_keys=True))
        content += literal_block(raw)
        notes.append({"name": f"auday-{source}-{revision}.md", "text": content,
                      "date": record_day(record.get("start", "")), "record": record})
    return {"syncedAt": metadata["syncedAt"], "notes": notes}
