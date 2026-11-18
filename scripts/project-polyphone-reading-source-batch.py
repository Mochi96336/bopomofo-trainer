#!/usr/bin/env python3
"""Batch-project pinned MOE exact word+reading source evidence for ALL pending groups.

This is a source-indexing pipeline, NOT a pronunciation inference algorithm.
It does not classify meaning, infer reading from unlabeled UD, or approve usage.

Example (strict pinned downloads required):
  npm run readings:bulk-syntax-triage -- --output /tmp/syntax-triage.json
  python scripts/project-polyphone-reading-source-batch.py \
    --queue /tmp/syntax-triage.json --scope tier1 \
    --concised /path/to/pinned_concised.zip \
    --revised /path/to/pinned_revised.zip \
    --public-output /tmp/tier1-source-evidence.json \
    --private-output data/external/moe/polyphone/tier1-private.json

Only public metadata (dictionary entry IDs, row numbers, SHA-256 of definitions)
may be published. Definitions are confined to the ignored private path.
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


def _sense_adapter() -> ModuleType:
    path = ROOT / "scripts" / "project-moe-sense-evidence.py"
    spec = importlib.util.spec_from_file_location("moe_source_bulk_adapter", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load strict pinned MOE source adapter")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def targets_from_bulk_triage(root: Any, scope: str) -> list[dict[str, Any]]:
    if scope not in ("full", "tier1"):
        raise ValueError("unsupported bulk source scope")
    if not isinstance(root, dict) or root.get("version") != "bulk-syntax-evidence-triage-v1":
        raise ValueError("expected independently generated full-population triage v1")
    selected = root.get(scope)
    if not isinstance(selected, dict) or selected.get("scope") != ("all" if scope == "full" else scope):
        raise ValueError("bulk triage scope does not match request")
    rows = selected.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("missing or empty polyphonic group inventory")
    grouped: dict[str, dict[str, Any]] = {}
    seen_word_upos: set[tuple[str, str]] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("invalid polyphonic word/UPOS row")
        word, upos, ids = row.get("word"), row.get("upos"), row.get("readingEntryIds")
        if not isinstance(word, str) or not word or not isinstance(upos, str):
            raise ValueError("bad word/UPOS identity")
        if not isinstance(ids, list) or len(ids) < 2 or len(set(ids)) != len(ids):
            raise ValueError("a polyphonic group must contain >=2 distinct readings")
        if (word, upos) in seen_word_upos:
            raise ValueError("duplicate word/UPOS group")
        seen_word_upos.add((word, upos))
        for entry_id in ids:
            if not isinstance(entry_id, str) or not entry_id.startswith(f"word:{word}:"):
                raise ValueError("reading ID does not match exact written form")
            reading = entry_id[len(f"word:{word}:"):].replace("-", " ")
            if not reading or not all(
                token.startswith("ㄅ") or token[0] in "ㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩ"
                for token in reading.split()
            ):
                raise ValueError("unexpected trainer reading encoding")
            value = grouped.setdefault(entry_id, {
                "text": word,
                "reading": reading,
                "entryId": entry_id,
                "activeUposes": [],
            })
            if upos not in value["activeUposes"]:
                value["activeUposes"].append(upos)
    result = list(grouped.values())
    for item in result:
        item["activeUposes"].sort()
    result.sort(key=lambda x: x["entryId"])
    if selected.get("blockedWordUposGroups") != len(seen_word_upos):
        raise ValueError("bulk inventory count mismatch; regenerate triage")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue", type=Path, required=True)
    parser.add_argument("--scope", choices=("full", "tier1"), default="tier1")
    parser.add_argument("--edition", choices=("202606", "20260929"), default="202606")
    parser.add_argument("--concised", type=Path, required=True)
    parser.add_argument("--revised", type=Path, required=True)
    parser.add_argument("--public-output", type=Path, required=True)
    parser.add_argument(
        "--private-output", type=Path,
        default=ROOT / "data/external/moe/polyphone/private-evidence.json",
    )
    args = parser.parse_args()
    adapter = _sense_adapter()
    adapter.validate_output_paths(args.public_output, args.private_output)
    manifest = json.loads(args.queue.read_text(encoding="utf-8"))
    targets = targets_from_bulk_triage(manifest, args.scope)
    texts = {row["text"] for row in targets}
    sources = []
    for name, archive in (("concised", args.concised), ("revised", args.revised)):
        pinned = adapter.load_adapter(name, args.edition)
        checksum, matched = adapter.source_candidates(pinned, name, archive, texts)
        sources.append(("moe-" + name, checksum, matched))
    public, private = adapter.project_evidence(targets, sources, edition=args.edition)
    public["schemaVersion"] = "moe-polyphone-reading-source-batch-v1"
    private["schemaVersion"] = "moe-polyphone-reading-source-batch-v1"
    for doc in (public, private):
        doc["purpose"] = (
            "Exact word+reading official source rows for all selected polyphonic identities; "
            "no sense/UPOS/grammar confirmation and no automatic product licenses"
        )
        doc["scope"] = args.scope
        doc["wordUposGroups"] = manifest[args.scope]["blockedWordUposGroups"]
        doc["distinctWrittenForms"] = len(texts)
        doc["distinctReadingIdentities"] = len(targets)
    for path, content in ((args.public_output, public), (args.private_output, private)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({
        "schemaVersion": public["schemaVersion"],
        "scope": args.scope,
        "wordUposGroups": public["wordUposGroups"],
        "distinctWrittenForms":len(texts),
        "distinctReadingIdentities":len(targets),
        "sourceMatchedStatusCounts":public["matchCounts"],
        "publicOutput":str(args.public_output),
        "privateOutput":str(args.private_output),
        "interpretation":"source row IDs only; every role/reading application remains unreviewed",
    },ensure_ascii=False,indent=2))


if __name__ == "__main__":
    main()
