#!/usr/bin/env python3
"""Verify authored sense-case SOURCE IDS against a fresh SHA-pinned MOE extraction.

Never accepts a case as linguistically correct. Reads only the sanitized
public index, not dictionary definitions or private review files.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def verify(cases_path: Path, source_index_path: Path) -> dict[str, int]:
    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    source = json.loads(source_index_path.read_text(encoding="utf-8"))
    if cases.get("schemaVersion") != "moe-20260929-sense-context-hypotheses-v1":
        raise ValueError("unexpected sense-case schema")
    if source.get("schemaVersion") != "moe-sense-pilot-evidence-v1":
        raise ValueError("unexpected strict-source projection schema")
    refs = {x["kind"]: x["sourceVersion"] for x in source["sourceArchives"]}
    if refs != {"moe-concised": "2014_20260929", "moe-revised": "2015_20260929"}:
        raise ValueError("reviewed cases require both strictly pinned September sources")
    raw_rows = source["rows"]
    case_rows = cases["rows"]
    if len(raw_rows) != 10 or len(case_rows) != 10:
        raise ValueError("expected ten exact reading identities in both sets")
    by_id = {row["entryId"]: row for row in raw_rows}
    if len(by_id) != 10 or {row["entryId"] for row in case_rows} != set(by_id):
        raise ValueError("source identity sets differ or contain duplicates")
    for case in case_rows:
        entry_id = case["entryId"]
        source_row = by_id[entry_id]
        if source_row["matchStatus"] != "paired-sources-awaiting-sense-review":
            raise ValueError("case lacks exactly one source row in each dictionary: " + entry_id)
        actual = {r["sourceKind"]: r["sourceEntryId"] for r in source_row["sourceRows"]}
        expected = {
            "moe-concised": case["sourceIds"]["concised"],
            "moe-revised": case["sourceIds"]["revised"],
        }
        if actual != expected:
            raise ValueError("source ID mismatch for " + entry_id)
        if any(not r["definitionPresent"] for r in source_row["sourceRows"]):
            raise ValueError("dictionary definition not present for " + entry_id)
        if not case.get("notTrainingGroundTruth", False):
            raise ValueError("unreviewed context erroneously labeled training ground truth")
        if any(case[k] != "pending" for k in (
            "readingReview", "syntaxRoleReview",
            "sentenceNaturalnessReview", "sourceSenseReview",
        )):
            raise ValueError("sense-case approval without independent review: " + entry_id)
    return {"verifiedReadingIds": len(case_rows), "verifiedSourceRows": 20, "approvedSenseLabels": 0}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, required=True)
    parser.add_argument("--source-index", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(verify(args.cases, args.source_index), indent=2))


if __name__ == "__main__":
    main()
