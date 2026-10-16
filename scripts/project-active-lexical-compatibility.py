#!/usr/bin/env python3
"""Regenerate the committed, aggregate-only active-catalog UD adjacency evidence.

Requires the externally obtained SHA-pinned UD Chinese GSD r2.18 source under
data/external/ud/chinese-gsd/r2.18. Does not distribute original sentences.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from ud_grammar_evidence.common import DEFAULT_SOURCE_DIR, canonical_digest
from ud_lexical_compatibility.projector import project_ranked_texts

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "data/source/words.sample.csv"
OUTPUT = ROOT / "data/compatibility/ud-gsd-active-surface-pairs.json"
SOURCE_COMMIT = "22f73e87f7ddc530bb131a6b7587971a03e1a712"
CATALOG_GIT_BLOB_SHA = "458a75728b0ff9fe95b5d30a6a8d3f2c1ecf7f54"


def active_texts() -> list[tuple[int, str]]:
    unique: dict[str, int] = {}
    with CANDIDATES.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            text = row["text"]
            if text and text not in unique:
                unique[text] = len(unique) + 1
    if not unique:
        raise ValueError("active catalog has no usable text")
    return [(rank, text) for text, rank in unique.items()]


def generate(source_dir: Path) -> dict:
    projected = project_ranked_texts(active_texts(), source_dir, minimum_pair_count=4)
    source = dict(projected["source"])
    source["pinnedCommit"] = SOURCE_COMMIT
    source["redistributionBoundary"] = (
        "Only aggregate active-catalog adjacent text pair counts and positive "
        "association scores; no source sentences or CoNLL-U files"
    )
    source = {
        "sourceId": source["sourceId"],
        "release": source["release"],
        "repository": source["repository"],
        "pinnedCommit": source["pinnedCommit"],
        "license": source["license"],
        "files": source["files"],
        "redistributionBoundary": source["redistributionBoundary"],
    }
    candidate = CANDIDATES.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    core = {
        "adapterVersion": "ud-chinese-gsd-lexical-compatibility-active-v1",
        "schemaVersion": "ud-lexical-compatibility-v1",
        "source": source,
        "candidateSource": {
            "path": "data/source/words.sample.csv",
            "gitBlobSha": CATALOG_GIT_BLOB_SHA,
            "canonicalChecksumSha256": hashlib.sha256(candidate.encode("utf-8")).hexdigest(),
            "selection": "distinct nonempty text fields in first appearance order",
        },
        "candidateCount": projected["candidateCount"],
        "minimumPairCount": 4,
        "surfaceObservationCount": projected["surfaceObservationCount"],
        "dependencyObservationCount": projected["dependencyObservationCount"],
        "surfacePairs": [p for p in projected["surfacePairs"] if p["score"] > 0],
        "dependencyPairs": [],  # Not used by the current runtime scorer.
    }
    return {**core, "determinismDigest": canonical_digest(core)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / DEFAULT_SOURCE_DIR)
    parser.add_argument("--verify", action="store_true", help="compare against the committed artifact")
    args = parser.parse_args()
    generated = json.dumps(generate(args.source_dir), ensure_ascii=False, separators=(",", ":")) + "\n"
    if args.verify:
        if OUTPUT.read_text(encoding="utf-8") != generated:
            raise SystemExit("the pinned active-catalog UD aggregate evidence has drifted")
        print("UD aggregate artifact matches the pinned source and active catalog")
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(generated, encoding="utf-8", newline="\n")
        print(f"wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
