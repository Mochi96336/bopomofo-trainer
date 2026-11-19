#!/usr/bin/env python3
"""Reconcile exact MOE reading-ID source matches against all Tier1 syntax conflicts.

No syntax functions are inferred from a dictionary entry and nothing is licensed.
All ambiguous word+UPOS groups remain unchanged in the shipping product.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

SOURCE_STATUSES = {
    "both-dictionaries-exact-reading",
    "one-dictionary-exact-reading",
    "no-exact-word-reading-source-row",
    "multiple-source-rows-same-reading",
}
NEXT_ACTION = {
    "already-reviewed-role-record": "check-reviewed-role-draw-reachability",
    "existing-identity-gated-construction-to-evaluate": "verify-construction-specific-reading-uniqueness",
}


def reconcile(queue: Any, source: Any) -> dict[str, Any]:
    if not isinstance(queue, dict) or queue.get("version") != "bulk-syntax-evidence-triage-v1":
        raise ValueError("expected source-polyphone syntax triage v1")
    if not isinstance(source, dict) or source.get("schemaVersion") != "moe-polyphone-reading-source-batch-v1":
        raise ValueError("expected exact MOE source row batch v1")
    tier = queue.get("tier1")
    if not isinstance(tier, dict) or tier.get("scope") != "tier1" or source.get("scope") != "tier1":
        raise ValueError("Tier1 scope mismatch")
    groups = tier.get("rows")
    rows = source.get("rows")
    if not isinstance(groups, list) or not isinstance(rows, list):
        raise ValueError("missing exact reading and syntax group rows")
    if len(groups) != tier.get("blockedWordUposGroups") or len(groups) != source.get("wordUposGroups"):
        raise ValueError("group count mismatch")
    by_id = {}
    for item in rows:
        if not isinstance(item, dict):
            raise ValueError("invalid MOE source row")
        identity, status = item.get("entryId"), item.get("sourceMatchStatus")
        if not isinstance(identity, str) or identity in by_id or status not in SOURCE_STATUSES:
            raise ValueError("duplicate or unknown MOE reading source row")
        by_id[identity] = item
    result = []
    reviewed = Counter()
    source_counts = Counter()
    seen = set()
    for group in groups:
        if not isinstance(group, dict):
            raise ValueError("invalid syntactic conflict group")
        word, upos = group.get("word"), group.get("upos")
        ids = group.get("readingEntryIds")
        if not isinstance(word, str) or not isinstance(upos, str) or not isinstance(ids, list) or len(ids) < 2:
            raise ValueError("incomplete word/UPOS identity")
        key = (word, upos)
        if key in seen:
            raise ValueError("duplicate syntactic group")
        seen.add(key)
        if len(set(ids)) != len(ids) or any(x not in by_id or by_id[x]["text"] != word for x in ids):
            raise ValueError("missing exact source word+reading identity")
        status = group.get("status")
        if not isinstance(status, str):
            raise ValueError("missing current role review classification")
        action = NEXT_ACTION.get(status, "needs-independent-reading-specific-syntax-evidence")
        verified = [by_id[identity]["sourceMatchStatus"] for identity in ids]
        source_state = (
            "all-alternatives-supported-by-both" if all(
                s == "both-dictionaries-exact-reading" for s in verified
            ) else "at-least-one-alternative-needs-source-review"
        )
        reviewed[action] += 1
        source_counts[source_state] += 1
        result.append({
            "word": word, "upos": upos,
            "readingEntryIds": ids,
            "sourceStatusesByReading": dict(zip(ids, verified)),
            "allAlternativeSources": source_state,
            "existingSyntacticEvidence": status,
            "nextReviewAction": action,
            "productionReadingLicensed": False,
        })
    if set(by_id) != {identity for group in result for identity in group["readingEntryIds"]}:
        raise ValueError("source batch contains entries outside the exact Tier1 conflict population")
    result.sort(key=lambda r: (r["word"], r["upos"]))
    return {
        "schemaVersion": "moe-polyphone-reading-source-role-reconciliation-v1",
        "sourceEdition": "20260929",
        "policy": "dictionary source identity is not grammar evidence; all candidates remain fail-closed",
        "wordUposGroups": len(result),
        "readingIdentities": len(by_id),
        "sourceSupportByGroup": dict(sorted(source_counts.items())),
        "nextActionCounts": dict(sorted(reviewed.items())),
        "rows": result,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--triage", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = reconcile(
        json.loads(args.triage.read_text("utf-8")),
        json.loads(args.sources.read_text("utf-8")),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print("MOE_SOURCE_ROLE_RECONCILIATION_JSON " + json.dumps({
        "wordUposGroups": report["wordUposGroups"],
        "readingIdentities": report["readingIdentities"],
        "sourceSupportByGroup": report["sourceSupportByGroup"],
        "nextActionCounts": report["nextActionCounts"],
        "unlicensed": len(report["rows"]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
