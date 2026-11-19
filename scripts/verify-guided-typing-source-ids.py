#!/usr/bin/env python3
"""Verify the typing-only pilot's exact MOE source-ID pins against genuine
SHA-pinned 20260929 archives' already-produced source-only index.

This validates *pronunciation source identity*, not the sense or naturalness
of a generated sentence and not independent token-level POS annotations.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from typing import Any


def verify(manifest: Any, official: Any) -> dict[str, int | bool]:
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != "reviewed-guided-typing-readings-v1":
        raise ValueError("invalid reviewed guided typing manifest")
    if manifest.get("sourceEdition") != "20260929":
        raise ValueError("unknown dictionary edition")
    if not isinstance(official, dict) or official.get("schemaVersion") != "moe-polyphone-reading-source-batch-v1":
        raise ValueError("invalid MOE exact reading source report")
    if official.get("scope") != "tier1" or not isinstance(official.get("sourceArchives"), list):
        raise ValueError("wrong source scope")
    if len(official["sourceArchives"]) != 2 or {src.get("kind") for src in official["sourceArchives"]} != {"concised", "revised"}:
        raise ValueError("both official sources required")
    if any(src.get("sourceVersion") is None or not isinstance(src.get("archiveSha256"),str)
           or len(src["archiveSha256"]) != 64 for src in official["sourceArchives"]):
        raise ValueError("missing original source archive provenance")
    indexed: dict[str,dict[str,Any]] = {}
    for item in official.get("rows",[]):
        if not isinstance(item,dict) or item.get("entryId") in indexed:
            raise ValueError("duplicate or malformed source row")
        indexed[item["entryId"]] = item
    groups=manifest.get("groups")
    if not isinstance(groups,list) or not groups:
        raise ValueError("empty typing groups")
    reviewed_readings=0
    seen_groups:set[tuple[str,str]]=set()
    for group in groups:
        if not isinstance(group,dict) or not isinstance(group.get("word"),str) or not isinstance(group.get("upos"),str):
            raise ValueError("invalid typing group")
        group_key=(group["word"],group["upos"])
        if group_key in seen_groups:
            raise ValueError("duplicate typing group")
        seen_groups.add(group_key)
        items=group.get("readings")
        if not isinstance(items,list) or len(items)<2:
            raise ValueError("group has insufficient independently pinned readings")
        seen_ids=set()
        for reading in items:
            if not isinstance(reading,dict) or reading.get("entryId") in seen_ids:
                raise ValueError("duplicate typing reading")
            entry_id=reading["entryId"]
            seen_ids.add(entry_id)
            source=indexed.get(entry_id)
            if source is None or source.get("text") != group["word"]:
                raise ValueError("official source entry identity not found: "+str(entry_id))
            if group["upos"] not in source.get("activeUposes",[]):
                raise ValueError("official reading not in active word+UPOS conflict")
            if source.get("sourceMatchStatus") != "both-dictionaries-exact-reading":
                raise ValueError("both dictionaries required for "+entry_id)
            source_rows=source.get("sourceRowsByDictionary")
            if not isinstance(source_rows,dict):
                raise ValueError("missing original source row metadata")
            for kind,field in (("concised","concisedSourceId"),("revised","revisedSourceId")):
                rows=source_rows.get(kind)
                if not isinstance(rows,list) or len(rows)!=1 or rows[0].get("sourceEntryId")!=reading.get(field):
                    raise ValueError("official "+kind+" ID mismatch for "+entry_id)
            reviewed_readings+=1
    return {
        "verifiedGroups":len(seen_groups),
        "verifiedReadingIdentities":reviewed_readings,
        "sourceIdentitiesMatchOriginalPinnedArchives":True,
        "perSentencePronunciationGold":False,
        "productionPolicyChanged":False,
    }


def main()->None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest",type=Path,required=True)
    parser.add_argument("--source-report",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    result=verify(
        json.loads(args.manifest.read_text("utf-8")),
        json.loads(args.source_report.read_text("utf-8")),
    )
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n","utf-8")
    print("REVIEWED_GUIDED_TYPING_MOE_SOURCE_CHECK "+json.dumps(result,ensure_ascii=False))

if __name__=="__main__":
    main()
