#!/usr/bin/env python3
"""Create source-backed, read-only *guided lexical typing* targets.

An exact dictionary reading of a standalone selected lexical entry is enough
to specify which keys the learner practices when its Bopomofo is displayed.
It does NOT authorize arbitrary syntactic slots, synthetic sentence readings,
a recall-mode answer, or a new production selection policy.

The source archive pins are checked in the preceding CI step. No dictionary
definitions or generated sentence semantics are inspected here.
"""
from __future__ import annotations
import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

EXPECTED_SHA = {
    "concised": "5bab99dac44ad7a6ccdcf481e770e8aca05ede7445c4cc25b8199e0e5df64cf2",
    "revised": "65a24fff76d0fbfa078541f39761bb9f302bdf7ad6bb48be4ce1052d1b49f609",
}
REVIEWED = {"already-reviewed-role-record", "existing-identity-gated-construction-to-evaluate"}
SUPPORTED = "both-dictionaries-exact-reading"


def compile_targets(triage: Any, source: Any) -> dict[str, Any]:
    if not isinstance(triage, dict) or triage.get("version") != "bulk-syntax-evidence-triage-v1":
        raise ValueError("wrong syntax triage schema")
    if not isinstance(source, dict) or source.get("schemaVersion") != "moe-polyphone-reading-source-batch-v1":
        raise ValueError("wrong dictionary source schema")
    groups=triage.get("tier1",{}).get("rows")
    if not isinstance(groups,list) or len(groups)!=131 or source.get("scope")!="tier1":
        raise ValueError("expected all 131 Tier1 conflict groups and exact official source scope")
    archives=source.get("sourceArchives")
    if not isinstance(archives,list) or len(archives)!=2 or {
        x.get("kind"):x.get("archiveSha256") for x in archives
    } != EXPECTED_SHA:
        raise ValueError("dictionary archives must match pinned 20260929 originals")
    pending=[row for row in groups if row.get("status") not in REVIEWED]
    if len(pending)!=116:
        raise ValueError("pending Tier1 group denominator changed")
    ids: dict[str,set[tuple[str,str]]]={}
    for group in pending:
        if not isinstance(group.get("readingEntryIds"),list) or len(group["readingEntryIds"])<2:
            raise ValueError("malformed pending source conflict")
        for entry_id in group["readingEntryIds"]:
            ids.setdefault(entry_id,set()).add((group["word"],group["upos"]))
    if len(ids)!=137:
        raise ValueError("pending Tier1 unique reading denominator changed")
    indexed={}
    for row in source.get("rows",[]):
        if not isinstance(row,dict) or row.get("entryId") in indexed:
            raise ValueError("duplicate or malformed official source entry")
        indexed[row["entryId"]]=row
    if not set(ids).issubset(indexed):
        raise ValueError("official source rows missing pending exact reading identities")
    eligible=[]
    skipped=[]
    counts=Counter()
    for entry_id in sorted(ids):
        record=indexed[entry_id]
        status=record.get("sourceMatchStatus")
        counts[status]+=1
        required_word={word for word,_ in ids[entry_id]}
        if len(required_word)!=1 or record.get("text") not in required_word:
            raise ValueError("word identity does not match pending conflict")
        if not all(upos in record.get("activeUposes",[]) for _,upos in ids[entry_id]):
            raise ValueError("reading UPOS source scope mismatch")
        if status != SUPPORTED:
            skipped.append({"entryId":entry_id,"sourceStatus":status,
                            "reason":"not independently pinned in both official dictionaries"})
            continue
        source_rows=record.get("sourceRowsByDictionary")
        if not isinstance(source_rows,dict):
            raise ValueError("missing matching official source rows")
        pins={}
        for kind in ("concised","revised"):
            rows=source_rows.get(kind)
            if not isinstance(rows,list) or len(rows)!=1 or not isinstance(rows[0].get("sourceEntryId"),str):
                raise ValueError("exact reading must have precisely one source row in "+kind)
            pins[kind]=rows[0]["sourceEntryId"]
        eligible.append({
            "entryId":entry_id,
            "word":record["text"],
            "verifiedSourceIds":pins,
            "activeUposesFromPendingConflict":sorted({upos for _,upos in ids[entry_id]}),
        })
    if len(eligible)!=131 or len(skipped)!=6:
        raise ValueError("reviewed target population changed; inspect before enabling anything")
    return {
        "schemaVersion":"tier1-source-verified-guided-lexeme-targets-v1",
        "sourceEdition":"20260929",
        "policy":"research-only, explicitly displayed Bopomofo, isolated whole catalog entry; never permit synthetic sentence or recall-mode reading",
        "pendingWordUposGroups":len(pending),
        "pendingReadingIdentities":len(ids),
        "sourceMatchStatusCounts":dict(sorted(counts.items())),
        "eligibleStandaloneGuidedReadings":len(eligible),
        "excludedForIncompleteSourceEvidence":len(skipped),
        "rows":eligible,
        "excluded":skipped,
        "productionPolicyChanged":False,
    }


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--triage",type=Path,required=True)
    parser.add_argument("--source-report",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    result=compile_targets(
        json.loads(args.triage.read_text("utf-8")),
        json.loads(args.source_report.read_text("utf-8")),
    )
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n","utf-8")
    print("TIER1_VERIFIED_GUIDED_LEXEME_TARGETS_JSON "+json.dumps({
        key:result[key] for key in ("pendingWordUposGroups","pendingReadingIdentities",
            "sourceMatchStatusCounts","eligibleStandaloneGuidedReadings",
            "excludedForIncompleteSourceEvidence","productionPolicyChanged")
    },ensure_ascii=False))

if __name__=="__main__":
    main()
