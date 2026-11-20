#!/usr/bin/env python3
"""Exact-reading MOE grammatical-tag triage for the original sentence catalog.

Separate dictionary POS evidence from sentence reading license. An absent tag
is *not* proof a pronunciation is invalid. The report is purely descriptive,
contains no dictionary definitions, and does not alter the product selector.
"""
from __future__ import annotations
import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

SOURCE_SCHEMAS=(
    "unresolved-catalog-reading-role-input-v1",
    "unresolved-reading-moe-grammatical-tags-v1",
)
UPOS_EXPLICIT_REVISED={
    "NOUN":"名", "VERB":"動", "ADJ":"形", "ADV":"副",
    "ADP":"介", "CCONJ":"連", "PART":"助", "PRON":"代",
}
REVISION=["concised","revised"]
def exact_bracket_tags(source: dict[str,Any])->list[str]:
    rows=[s for s in source["sources"] if s["dictionary"]=="revised"]
    if len(rows)>1:raise ValueError("ambiguous revised dictionary record")
    if not rows:return []
    tokens=rows[0]["grammarMarkerStructure"]["markers"]
    return sorted(set(m["tag"] for m in tokens
      if m.get("previousCodepoint")=="U+005B"
      and m.get("nextCodepoint")=="U+005D"))

def analyze(inventory:dict[str,Any], official:dict[str,Any])->dict[str,Any]:
    if inventory.get("schemaVersion")!=SOURCE_SCHEMAS[0] or official.get("schemaVersion")!=SOURCE_SCHEMAS[1]:
        raise ValueError("unexpected original catalog or official source schema")
    if inventory.get("sourceEdition")!="20260929" or official.get("sourceEdition")!="20260929":
        raise ValueError("pinned September 2026 source edition required")
    if official.get("productionChanged") is not False:
        raise ValueError("official scan must be nonproduction")
    rows=official.get("rows")
    groups=inventory.get("groups")
    if not isinstance(rows,list) or not isinstance(groups,list):
        raise ValueError("missing original catalog or official source entries")
    index={r["entryId"]:r for r in rows}
    if len(index)!=len(rows):raise ValueError("duplicate dictionary reading ID")
    output=[]
    for group in groups:
        word=group["word"]
        upos=group["upos"]
        reading_ids=group["readingEntryIds"]
        if len(reading_ids)<2 or len(set(reading_ids))!=len(reading_ids):
            raise ValueError("invalid unresolved pronunciation set")
        target=UPOS_EXPLICIT_REVISED.get(upos)
        candidates=[]
        for reading_id in reading_ids:
            record=index.get(reading_id)
            if record is None or record["word"]!=word or upos not in record["linkedUposes"]:
                raise ValueError("dictionary row does not match actual lexical group")
            tags=exact_bracket_tags(record)
            candidates.append({
                "entryId":reading_id, "dictionarySourceStatus":record["sourceStatus"],
                "revisedExplicitPosTags":tags,
                "hasAnyExplicitPosTag":bool(tags),
                "sourceSupportsSelectedUpos":target in tags if target else None,
                "verifiedRevisedSourceId":next((s["sourceEntryId"] for s in record["sources"]
                  if s["dictionary"]=="revised"),None),
            })
        all_readings_tagged=all(c["hasAnyExplicitPosTag"] for c in candidates)
        all_double_source=all(c["dictionarySourceStatus"]=="both-exact" for c in candidates)
        matches=[c for c in candidates if c["sourceSupportsSelectedUpos"] is True]
        if target is None:
            classification="unsupported-upos-mapping"
        elif all_readings_tagged and len(matches)==1 and all_double_source:
            classification="singleton-explicit-pos-double-source-review"
        elif all_readings_tagged and len(matches)==1:
            classification="singleton-explicit-pos-source-incomplete"
        elif not all_readings_tagged:
            classification="incomplete-explicit-pos-annotation"
        elif len(matches)>=2:
            classification="multiple-readings-share-explicit-pos"
        else:
            classification="no-matching-explicit-pos"
        output.append({
            "word":word,"upos":upos,
            "classification":classification,
            "expectedPosTag":target,
            "completeRevisedTagAnnotationInThisGroup":all_readings_tagged,
            "allCandidatesHaveBothOfficialSources":all_double_source,
            "positiveReadings":[x["entryId"] for x in matches],
            "candidates":candidates,
        })
    counts=Counter(row["classification"] for row in output)
    return {
        "schemaVersion":"unresolved-reading-explicit-pos-triage-v1",
        "sourceEdition":"20260929",
        "scope":"existing sentence grammar, original source reading identities, no semantic inference",
        "disclaimer":"Missing [POS] is not negative evidence; every singleton is a review candidate, not an authorized production reading.",
        "unresolvedGroups":len(output),
        "distinctReadingIds":len(index),
        "classificationCounts":dict(sorted(counts.items())),
        "rows":output,
        "productionChanged":False,
    }

def main()->None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--inventory",type=Path,required=True)
    parser.add_argument("--evidence",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    result=analyze(json.loads(args.inventory.read_text("utf-8")),json.loads(args.evidence.read_text("utf-8")))
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n","utf-8")
    print("MOE_EXPLICIT_READING_ROLE_TRIAGE "+json.dumps({
      "groups":result["unresolvedGroups"],
      "readingIds":result["distinctReadingIds"],
      "counts":result["classificationCounts"],
      "productionChanged":result["productionChanged"],
    },ensure_ascii=False))

if __name__=="__main__":main()
