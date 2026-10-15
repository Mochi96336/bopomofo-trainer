#!/usr/bin/env python3
"""Untrusted/new MOE source discovery: metadata + exact reading IDs, NO definitions.

This is a source-change audit only. It does NOT update the pinned adapters,
interpret lexical senses, or mark any reading approved. Archives are local to
the runner and are deleted after the job; JSON contains only public metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
import zipfile
from collections import Counter
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
VERSION = "20260929"
CONFIG = {
    "concised": {
        "member": "dict_concised_2014_20260929.xlsx",
        "version": "2014_20260929",
        "text_column": 1,
        "id_column": 2,
        "reading_column": 7,
    },
    "revised": {
        "member": "dict_revised_2015_20260929.xlsx",
        "version": "2015_20260929",
        "text_column": 1,
        "id_column": 4,
        "reading_column": 9,
    },
}


def adapter_for(name):
    path = ROOT / "scripts" / f"project-moe-{name}-readings.py"
    spec = importlib.util.spec_from_file_location(f"moe_20260929_discovery_{name}", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("missing existing MOE reading parser")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def hash_bytes(data):
    return hashlib.sha256(data).hexdigest()


def audit_source(name: str, archive_path: Path, targets):
    conf = CONFIG[name]
    parser = adapter_for(name)
    archive_bytes = archive_path.read_bytes()
    if not zipfile.is_zipfile(archive_path):
        raise ValueError(f"{name} is not a ZIP archive")
    with zipfile.ZipFile(BytesIO(archive_bytes)) as z:
        members = sorted(i.filename for i in z.infolist() if not i.is_dir())
        if conf["member"] not in members:
            raise ValueError(f"{name} workbook not found; member names: {members}")
        workbook = z.read(conf["member"])
    with zipfile.ZipFile(BytesIO(workbook)) as book:
        sheet, sheet_path = parser.workbook_sheet(book)
        shared = parser.read_shared_strings(book)
        xml = book.read(sheet_path)
        root = ET.fromstring(xml)
        dimension = root.find(f"{{{MAIN}}}dimension")
        used_range = dimension.attrib.get("ref") if dimension is not None else None
        rows = parser.iter_rows(xml, shared)
        header_num, header_cells = next(rows)
        header = [header_cells.get(i).value if i in header_cells else None
                  for i in range(1, len(parser.EXPECTED_HEADERS) + 1)]
        header_verified = header_num == 1 and header == parser.EXPECTED_HEADERS
        if not header_verified:
            # Fail closed: column offsets cannot be used with a changed schema.
            raise ValueError(
                f"{name}: new workbook headers changed; manual review required: {header!r}"
            )
        matches = []
        target_texts = set(item["text"] for item in targets)
        target_pairs = set((item["text"], item["reading"]) for item in targets)
        source_rows = 0
        for row_num, cells in rows:
            source_rows += 1
            headword = parser.optional_string(cells, conf["text_column"], f"row {row_num} headword")
            if headword is None or parser.normalize_lookup_text(headword) not in target_texts:
                continue
            text = parser.normalize_lookup_text(headword)
            bopomofo = parser.optional_string(cells, conf["reading_column"], f"row {row_num} reading")
            if bopomofo is None:
                continue
            try:
                reading = parser.trainer_reading(bopomofo)
            except ValueError:
                continue
            if (text, reading) not in target_pairs:
                continue
            entry_id = parser.required_string(cells, conf["id_column"], f"row {row_num} source ID")
            matches.append({
                "targetEntryId": f"word:{text}:{reading.replace(' ', '-')}",
                "sourceEntryId": entry_id,
                "sourcePhysicalRow": row_num,
                "sourceBopomofo": bopomofo,
            })
    return {
        "source": name,
        "version": conf["version"],
        "downloadArchiveSha256": hash_bytes(archive_bytes),
        "archiveBytes": len(archive_bytes),
        "members": members,
        "workbookSha256": hash_bytes(workbook),
        "workbookBytes": len(workbook),
        "worksheetName": sheet,
        "worksheetDimension": used_range,
        "columnSchemaVerifiedAgainstOldVersion": header_verified,
        "sourceRowsScanned": source_rows,
        "matchingExactReadingRows": len(matches),
        "matches": matches,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--concised", type=Path, required=True)
    ap.add_argument("--revised", type=Path, required=True)
    ap.add_argument("--targets", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    payload = json.loads(args.targets.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != "moe-sense-pilot-targets-v1":
        raise ValueError("target manifest must come from packaged active catalog")
    targets = payload["rows"]
    if len(targets) != 10:
        raise ValueError("expected 10 active reading identities in five pilot forms")
    sources = [
        audit_source("concised", args.concised, targets),
        audit_source("revised", args.revised, targets),
    ]
    matched_ids = {m["targetEntryId"] for src in sources for m in src["matches"]}
    counts = Counter(m["targetEntryId"] for src in sources for m in src["matches"])
    report = {
        "schemaVersion": "moe-20260929-reading-source-discovery-v1",
        "status": "discovered-unpinned-source; source/sense review required",
        "warning": "Neither an approved dictionary version nor contextual sense ground truth.",
        "pilotReadingIdentities": len(targets),
        "identitiesMatchedAtLeastOnce": len(matched_ids),
        "identitiesWithMultipleSourceRows": sorted(k for k, v in counts.items() if v > 1),
        "identitiesWithoutExactMatch": sorted(
            row["entryId"] for row in targets if row["entryId"] not in matched_ids
        ),
        "sources": sources,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "identitiesMatchedAtLeastOnce": report["identitiesMatchedAtLeastOnce"],
        "identitiesWithoutExactMatch": report["identitiesWithoutExactMatch"],
        "sourceMetadata": [
            {k: v for k, v in src.items() if k != "matches"}
            for src in sources
        ],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
