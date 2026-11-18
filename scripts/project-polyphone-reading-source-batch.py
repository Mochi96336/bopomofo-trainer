#!/usr/bin/env python3
"""Batch-pin MOE exact headword+reading IDs across all unresolved polyphones.

STRICTLY NO SENSE DATA: the source reader explicitly sets include_definition=False.
Only headword, reading, source row ID and source archive checksums are retained.

Usage (requires locally downloaded, SHA-256-pinned MOE ZIP archives):
  npm run readings:bulk-syntax-triage -- --output bulk-syntax-evidence-triage.json
  npm run readings:source-batch -- \
    --queue bulk-syntax-evidence-triage.json --scope tier1 \
    --concised /path/to/moe-concised.zip --revised /path/to/moe-revised.zip \
    --output tier1-reading-source-ids.json

No dictionary presence/absence is allowed to make a generated reading legal.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def _strict_sources() -> ModuleType:
    path = ROOT / "scripts" / "project-moe-sense-evidence.py"
    spec = importlib.util.spec_from_file_location("moe_pinned_source_loader", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load pinned MOE source adapters")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def targets_from_bulk_triage(root: Any, scope: str) -> list[dict[str, Any]]:
    if scope not in ("full", "tier1"):
        raise ValueError("unsupported polyphone scope")
    if not isinstance(root, dict) or root.get("version") != "bulk-syntax-evidence-triage-v1":
        raise ValueError("expected generated syntax-evidence triage v1")
    selected = root.get(scope)
    if not isinstance(selected, dict) or selected.get("scope") != ("all" if scope == "full" else scope):
        raise ValueError("bulk syntax-evidence triage scope mismatch")
    rows = selected.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("empty source target inventory")
    grouped: dict[str, dict[str, Any]] = {}
    seen_groups: set[tuple[str, str]] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("invalid word/UPOS row")
        word, upos, ids = row.get("word"), row.get("upos"), row.get("readingEntryIds")
        if not isinstance(word, str) or not word or not isinstance(upos, str) or not upos:
            raise ValueError("invalid word/UPOS")
        if not isinstance(ids, list) or len(ids) < 2 or len(set(ids)) != len(ids):
            raise ValueError("invalid same-word reading collision")
        if (word, upos) in seen_groups:
            raise ValueError("duplicate source word/UPOS group")
        seen_groups.add((word, upos))
        for entry_id in ids:
            if not isinstance(entry_id, str) or not entry_id.startswith(f"word:{word}:"):
                raise ValueError("wrong exact catalog word/reading ID")
            reading = entry_id[len(f"word:{word}:"):].replace("-", " ")
            if not reading or any(
                not segment.startswith("ㄅ") and segment[0] not in
                "ㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩ"
                for segment in reading.split()
            ):
                raise ValueError("unsupported reading encoding")
            item = grouped.setdefault(entry_id, {
                "text": word,
                "reading": reading,
                "entryId": entry_id,
                "activeUposes": [],
            })
            if upos not in item["activeUposes"]:
                item["activeUposes"].append(upos)
    if len(seen_groups) != selected.get("blockedWordUposGroups"):
        raise ValueError("group count mismatch: regenerate source triage")
    result = list(grouped.values())
    for item in result:
        item["activeUposes"].sort()
    return sorted(result, key=lambda value: value["entryId"])


def match_source_rows(
    adapter: ModuleType,
    archive: Path,
    target_texts: set[str],
) -> tuple[str, dict[str, list[dict[str, Any]]]]:
    # This is a *hard* boundary: do not read, copy, hash or interpret definitions.
    checksum, matched, _total, _scoped = adapter.read_source_rows(
        archive, target_texts, include_definition=False,
    )
    index: dict[str, list[dict[str, Any]]] = {}
    for text in target_texts:
        for row in matched.get(text, []):
            if not row.source_bopomofo:
                continue
            try:
                reading = adapter.trainer_reading(row.source_bopomofo)
            except ValueError:
                continue
            entry_id = f"word:{text}:{reading.replace(' ', '-')}"
            index.setdefault(entry_id, []).append({
                "sourceEntryId": row.source_entry_id,
                "sourcePhysicalRow": row.physical_row_number,
                "multiReadingOrder": row.multi_reading_order,
            })
    return checksum, index


def build_source_report(
    scope: str,
    groups: int,
    targets: list[dict[str, Any]],
    source_archives: list[dict[str, str]],
    indexes: dict[str, dict[str, list[dict[str, Any]]]],
) -> dict[str, Any]:
    rows = []
    statuses: dict[str, int] = {}
    for target in targets:
        by_source = {
            kind: sorted(indexes[kind].get(target["entryId"], []),
                         key=lambda item: (item["sourceEntryId"], item["sourcePhysicalRow"]))
            for kind in sorted(indexes)
        }
        counts = [len(items) for items in by_source.values()]
        status = (
            "no-exact-word-reading-source-row" if sum(counts) == 0
            else "multiple-source-rows-same-reading" if any(n > 1 for n in counts)
            else "both-dictionaries-exact-reading" if len(counts) == 2 and all(n == 1 for n in counts)
            else "one-dictionary-exact-reading"
        )
        statuses[status] = statuses.get(status, 0) + 1
        rows.append({**target, "sourceMatchStatus": status,
                     "sourceRowsByDictionary": by_source,
                     "readingRoleReview": "unreviewed",
                     "usableAsProductRule": False})
    return {
        "schemaVersion": "moe-polyphone-reading-source-batch-v1",
        "scope": scope,
        "wordUposGroups": groups,
        "distinctWrittenForms": len(set(target["text"] for target in targets)),
        "distinctReadingIdentities": len(targets),
        "sourceArchives": source_archives,
        "sourceMatchStatusCounts": dict(sorted(statuses.items())),
        "policy": "dictionary headword reading only, not sentence pronunciation or source POS proof",
        "rows": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue", type=Path, required=True)
    parser.add_argument("--scope", choices=("full", "tier1"), default="tier1")
    parser.add_argument("--edition", choices=("202606", "20260929"), default="202606")
    parser.add_argument("--concised", type=Path, required=True)
    parser.add_argument("--revised", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.queue.read_text(encoding="utf-8"))
    targets = targets_from_bulk_triage(manifest, args.scope)
    source_adapters = _strict_sources()
    texts = set(target["text"] for target in targets)
    sources = []
    indexes: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for kind, archive in (("concised", args.concised), ("revised", args.revised)):
        adapter = source_adapters.load_adapter(kind, args.edition)
        checksum, index = match_source_rows(adapter, archive, texts)
        sources.append({"kind":kind, "archiveSha256": checksum,
                        "sourceVersion": adapter.SOURCE_VERSION})
        indexes[kind] = index
    report = build_source_report(
        args.scope, manifest[args.scope]["blockedWordUposGroups"], targets, sources, indexes)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({
        "output":str(args.output), "scope":args.scope,
        "groups":report["wordUposGroups"],
        "readingIdentities":report["distinctReadingIdentities"],
        "sourceMatchStatusCounts":report["sourceMatchStatusCounts"],
        "safety":"source ID matching only; never enables training labels",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
