#!/usr/bin/env python3
"""Build local MOE sense-review evidence without publishing dictionary definitions.

Requires both *locally downloaded, pinned* MOE source ZIP archives.
The committed reading projection intentionally skips polyphonic headwords;
this tool instead matches exact written form AND reading to all source rows.

The public JSON records IDs and SHA-256 fingerprints, not licensed definitions.
The separate private review JSON containing definitions MUST stay ignored.
No generated example, inferred sense, or model prediction is labeled truth.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "moe-sense-pilot-evidence-v1"


def load_adapter(name: str, edition: str = "202606") -> ModuleType:
    if name not in ("concised", "revised"):
        raise ValueError("unknown MOE source adapter: " + name)
    if edition not in ("202606", "20260929"):
        raise ValueError("unsupported MOE source edition: " + edition)
    path = ROOT / "scripts" / f"project-moe-{name}-readings.py"
    spec = importlib.util.spec_from_file_location(f"moe_sense_pilot_{name}_{edition}", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load pinned adapter: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)

    if edition == "20260929":
        pins_path = ROOT / "data" / "readings" / "moe-20260929-sense-source-pins.json"
        pins = json.loads(pins_path.read_text(encoding="utf-8"))
        if pins.get("schemaVersion") != "moe-sense-source-pins-v1" or pins.get("edition") != edition:
            raise ValueError("unexpected September source pin schema or edition")
        pin = pins["sources"][name]
        module.SOURCE_VERSION = pin["version"]
        module.EXPECTED_ARCHIVE_SHA256 = pin["archiveSha256"]
        module.EXPECTED_SHEET = pin["sheet"]
        module.EXPECTED_DIMENSION = pin["dimension"]
        if name == "concised":
            module.EXPECTED_MEMBER = pin["member"]
            module.EXPECTED_MEMBER_SIZE = pin["memberSize"]
            module.EXPECTED_MEMBER_SHA256 = pin["memberSha256"]
        else:
            module.EXPECTED_MAIN_MEMBER = pin["member"]
            module.EXPECTED_MAIN_MEMBER_SIZE = pin["memberSize"]
            module.EXPECTED_MAIN_MEMBER_SHA256 = pin["memberSha256"]
            module.EXPECTED_FIELD_GUIDE_MEMBER = pin["fieldGuide"]
            module.EXPECTED_FIELD_GUIDE_SIZE = pin["fieldGuideSize"]
            module.EXPECTED_FIELD_GUIDE_SHA256 = pin["fieldGuideSha256"]
            # Explicitly verified in #409: only column J label gained 5:或讀.
            headers = list(module.EXPECTED_HEADERS)
            if headers[9] != "變體類型 1:變 2:又音 3:語音 4:讀音":
                raise ValueError("unexpected revised base header before 20260929 pin")
            headers[9] = pin["variantColumnLabel"]
            if headers[9] != "變體類型 1:變 2:又音 3:語音 4:讀音 5:或讀":
                raise ValueError("unexpected revised 20260929 column label")
            module.EXPECTED_HEADERS = headers
    return module


def read_targets(path: Path) -> list[dict[str, str]]:
    root = json.loads(path.read_text(encoding="utf-8"))
    if root.get("schemaVersion") != "moe-sense-pilot-targets-v1":
        raise ValueError("expected actual packaged catalog sense-pilot targets")
    texts = root.get("pilotTexts")
    rows = root.get("rows")
    if texts != ["種", "說", "東西", "給", "為"] or not isinstance(rows, list):
        raise ValueError("pilot target texts or rows were unexpectedly modified")
    seen: set[str] = set()
    results: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("each pilot row must be an object")
        text = row.get("text")
        reading = row.get("reading")
        entry_id = row.get("entryId")
        if not isinstance(text, str) or text not in texts or not isinstance(reading, str):
            raise ValueError("pilot target has unsupported text/reading")
        if entry_id != f"word:{text}:{reading.replace(' ', '-')}":
            raise ValueError("pilot target is inconsistent with its exact entry ID")
        if entry_id in seen:
            raise ValueError("duplicate pilot reading identity: " + entry_id)
        seen.add(entry_id)
        results.append({"text": text, "reading": reading, "entryId": entry_id})
    if len(results) < 10 or set(row["text"] for row in results) != set(texts):
        raise ValueError("pilot must include all five ambiguous texts and their alternatives")
    return results


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def source_candidates(
    adapter: ModuleType,
    source_name: str,
    archive: Path,
    texts: set[str],
) -> tuple[str, dict[str, dict[str, list[dict[str, Any]]]]]:
    checksum, matched, _total, _scoped = adapter.read_source_rows(
        archive, texts, include_definition=True,
    )  # calls the original strict pinned ZIP, workbook, sheet and header checks
    by_text: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for text in sorted(texts):
        by_reading: dict[str, list[dict[str, Any]]] = {}
        for source in matched.get(text, []):
            if not source.source_bopomofo:
                continue
            try:
                reading = adapter.trainer_reading(source.source_bopomofo)
            except ValueError:
                continue  # unsupported source reading is not guessed or coerced
            definition = source.definition
            record = {
                "sourceKind": "moe-" + source_name,
                "sourceVersion": adapter.SOURCE_VERSION,
                "sourceEntryId": source.source_entry_id,
                "sourcePhysicalRow": source.physical_row_number,
                "multiReadingOrder": source.multi_reading_order,
                "sourceBopomofo": source.source_bopomofo,
                "definitionPresent": bool(definition),
                "definitionSha256": sha256_text(definition) if definition else None,
                # PRIVATE only. Removed from the publicly publishable projection.
                "definition": definition,
            }
            by_reading.setdefault(reading, []).append(record)
        by_text[text] = by_reading
    return checksum, by_text


def project_evidence(
    targets: list[dict[str, str]],
    sources: list[tuple[str, str, dict[str, dict[str, list[dict[str, Any]]]]]],
    *,
    edition: str = "202606",
) -> tuple[dict[str, Any], dict[str, Any]]:
    public_rows: list[dict[str, Any]] = []
    private_rows: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    for target in targets:
        text, reading = target["text"], target["reading"]
        candidates = [
            row
            for _kind, _checksum, matched in sources
            for row in matched.get(text, {}).get(reading, [])
        ]
        # Never select one definition when multiple dictionary records match:
        # multiple source rows may denote different lexical senses.
        per_source = [matched.get(text, {}).get(reading, []) for _, _, matched in sources]
        status = (
            "no-exact-source-reading" if not candidates
            else "duplicate-within-one-dictionary-review-required"
                if any(len(group) > 1 for group in per_source)
            else "paired-sources-awaiting-sense-review"
                if len(per_source) == 2 and all(len(group) == 1 for group in per_source)
            else "one-source-row-awaiting-sense-review"
                if len(candidates) == 1
            else "partial-source-match-review-required"
        )
        counts[status] = counts.get(status, 0) + 1
        base = {**target, "matchStatus": status, "senseReviewStatus": "unreviewed"}
        public_rows.append({
            **base,
            "sourceRows": [{key: value for key, value in row.items() if key != "definition"}
                           for row in candidates],
        })
        private_rows.append({**base, "sourceRows": candidates})
    source_refs = [{"kind": kind, "sourceVersion": module_version(kind, edition),
                    "archiveSha256": checksum} for kind, checksum, _ in sources]
    shared = {
        "schemaVersion": SCHEMA,
        "purpose": "Exact reading-to-source-row evidence only; NOT reviewed sense alignment.",
        "sourceArchives": source_refs,
        "matchCounts": dict(sorted(counts.items())),
    }
    return ({**shared, "rows": public_rows},
            {**shared, "PRIVATE_DO_NOT_COMMIT": True, "rows": private_rows})


def module_version(kind: str, edition: str = "202606") -> str:
    if edition == "20260929":
        pins = json.loads((ROOT / "data/readings/moe-20260929-sense-source-pins.json").read_text(encoding="utf-8"))
        if kind in ("moe-concised", "moe-revised"):
            return pins["sources"][kind.removeprefix("moe-")]["version"]
    if edition == "202606":
        if kind == "moe-concised":
            return "2014_20260626"
        if kind == "moe-revised":
            return "2015_20260625"
    raise ValueError("unexpected source kind or edition " + kind + "/" + edition)


def validate_output_paths(public_path: Path, private_path: Path) -> None:
    if public_path.resolve() == private_path.resolve():
        raise ValueError("public and private sense evidence must use distinct files")
    safe_dir = (ROOT / "data" / "external").resolve()
    try:
        private_path.resolve().relative_to(safe_dir)
    except ValueError as error:
        raise ValueError("private sense output MUST be under ignored data/external/") from error


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--edition", choices=("202606", "20260929"), default="202606",
                        help="strictly pinned source version; 20260929 does not change production projections")
    parser.add_argument("--targets", type=Path, default=ROOT / "data/generated/moe-sense-pilot-targets.json")
    parser.add_argument("--concised", type=Path, required=True)
    parser.add_argument("--revised", type=Path, required=True)
    parser.add_argument("--public-output", type=Path,
                        default=ROOT / "data/generated/moe-sense-pilot-source-index.json")
    parser.add_argument("--private-output", type=Path,
                        default=ROOT / "data/external/moe/sense-pilot/private-review.json")
    args = parser.parse_args()
    validate_output_paths(args.public_output, args.private_output)
    targets = read_targets(args.targets)
    texts = {row["text"] for row in targets}
    sources = []
    for name, path in [("concised", args.concised), ("revised", args.revised)]:
        module = load_adapter(name, args.edition)
        checksum, candidates = source_candidates(module, name, path, texts)
        sources.append(("moe-" + name, checksum, candidates))
    public, private = project_evidence(targets, sources, edition=args.edition)
    for path, value in [(args.public_output, public), (args.private_output, private)]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "publicOutput": str(args.public_output),
        "privateOutput": str(args.private_output),
        "entryIds": len(targets),
        "edition": args.edition,
        "matchCounts": public["matchCounts"],
        "status": "source-row matching only; lexical senses remain unreviewed",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
