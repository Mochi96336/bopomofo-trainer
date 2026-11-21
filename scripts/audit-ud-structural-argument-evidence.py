#!/usr/bin/env python3
"""Measure whether pinned UD dependencies have enough sparse support for a relation-aware trial.

Diagnostic only: dependency relations are corpus observations, and generated
structural argument pairs are hypotheses. No sentence content or training label
is copied to the report.
"""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

from ud_grammar_evidence.common import DEFAULT_SOURCE_DIR
from ud_lexical_compatibility.projector import project_ranked_texts

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "data/source/words.sample.csv"
OUTPUT = ROOT / "data/generated/ud-structural-argument-evidence.json"
RELATIONS = ("nsubj", "obj")


def main() -> None:
    unique: dict[str, int] = {}
    with CANDIDATES.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            text = row["text"]
            if text and text not in unique:
                unique[text] = len(unique) + 1
    if not unique:
        raise ValueError("no active lexical candidates")

    data = project_ranked_texts(
        [(rank, text) for text, rank in unique.items()],
        ROOT / DEFAULT_SOURCE_DIR,
        minimum_pair_count=4,
    )
    by_relation = Counter()
    positives = Counter()
    score_by_relation = Counter()
    lexical_heads: dict[str, set[str]] = {relation: set() for relation in RELATIONS}
    for pair in data["dependencyPairs"]:
        relation = pair["relation"]
        if relation not in RELATIONS:
            continue
        by_relation[relation] += 1
        if pair["score"] > 0:
            positives[relation] += 1
            score_by_relation[relation] += pair["score"]
            lexical_heads[relation].add(pair["headText"])

    report = {
        "schemaVersion": "ud-structural-argument-evidence-audit-v1",
        "boundary": "corpus aggregate only; no product policy and no sentence-level correctness claim",
        "candidateCount": len(unique),
        "minimumPairCount": data["minimumPairCount"],
        "source": data["source"],
        "allDependencyObservationCount": data["dependencyObservationCount"],
        "relationRows": {k: by_relation[k] for k in RELATIONS},
        "positiveRows": {k: positives[k] for k in RELATIONS},
        "distinctPositiveHeadTexts": {k: len(lexical_heads[k]) for k in RELATIONS},
        "positiveScoreSums": {k: round(score_by_relation[k], 6) for k in RELATIONS},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        k: value for k, value in report.items() if k != "source"
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
