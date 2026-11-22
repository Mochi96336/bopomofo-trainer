#!/usr/bin/env python3
"""Audit exact-reading MOE grammatical tags without semantic judgments.

This intentionally emits POS marker positions, adjacent Unicode code points,
source-row IDs and definition hashes, NEVER dictionary definitions or examples.
No product reading gate is changed. The September source adapter verifies the
outer ZIP SHA256, inner XLSX, sheet name, headers and table dimension.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parents[1]
TAGS=set("名動形副介連助代量嘆歎")
SCHEMA="unresolved-reading-moe-grammatical-tags-v1"


def load_pinned_source_module():
    path=ROOT/"scripts"/"project-moe-sense-evidence.py"
    spec=importlib.util.spec_from_file_location("source_only_moe_pos_adapter",path)
    if spec is None or spec.loader is None:
        raise RuntimeError("missing official pinned MOE source adapter")
    module=importlib.util.module_from_spec(spec)
    sys.modules[spec.name]=module
    spec.loader.exec_module(module)
    return module


def marker_structure(definition: str | None)->dict[str,Any]:
    if not definition:
        return {"present":False,"length":0,"markers":[]}
    text=definition[:512]
    marks=[]
    for i,ch in enumerate(text):
        if ch not in TAGS:continue
        if len(marks)>=24:break
        before=text[i-1] if i else ""
        after=text[i+1] if i+1<len(text) else ""
        marks.append({
            "tag":ch,"offset":i,
            "previousCodepoint":("U+%04X"%ord(before)) if before else None,
            "nextCodepoint":("U+%04X"%ord(after)) if after else None,
            "boundary":(i==0 or before in "\t\n\r ()（）①②③④⑤⑥⒈⒉⒊[【；；。|／\\"),
        })
    return {"present":True,"length":len(definition),"markers":marks}


def project(queue:dict[str,Any], adapters:dict[str,Any], outputs:dict[str,Any])->dict[str,Any]:
    if queue.get("schemaVersion")!="unresolved-catalog-reading-role-input-v1":
        raise ValueError("expected live original product grammar inventory")
    if queue.get("sourceEdition")!="20260929":
        raise ValueError("wrong official source edition")
    groups=queue.get("groups")
    if not isinstance(groups,list) or not groups:
        raise ValueError("empty unresolved roles")
    rows={}
    for group in groups:
        word=group["word"]
        for reading in group["readingIdentities"]:
            entry_id=reading["entryId"]
            if entry_id!=f'word:{word}:{reading["reading"].replace(" ","-")}':
                raise ValueError("written form / reading identity mismatch")
            if entry_id in rows:continue
            source_rows=[]
            for kind,by_text in outputs.items():
                matched=by_text.get(word,{}).get(reading["reading"],[])
                if len(matched)>1:
                    raise ValueError("multiple same-reading source records require review: "+entry_id)
                for source in matched:
                    source_rows.append({
                        "dictionary":kind,
                        "sourceEntryId":source["sourceEntryId"],
                        "sourcePhysicalRow":source["sourcePhysicalRow"],
                        "definitionSha256":source["definitionSha256"],
                        "grammarMarkerStructure":marker_structure(source["definition"]),
                    })
            source_rows.sort(key=lambda r:r["dictionary"])
            rows[entry_id]={
                "entryId":entry_id,"word":word,
                "linkedUposes":sorted({
                    group2["upos"] for group2 in groups if entry_id in group2["readingEntryIds"]
                }),
                "sourceStatus":"both-exact" if len(source_rows)==2
                    else "one-exact" if len(source_rows)==1 else "no-exact",
                "sources":source_rows,
            }
    return {
        "schemaVersion":SCHEMA,
        "sourceEdition":"20260929",
        "basis":"exact original catalog reading + pinned MOE source; tag shape only, no semantic inference or grammatical license",
        "sourceArchives":[{"kind":kind,"archiveSha256":adapters[kind]} for kind in sorted(adapters)],
        "unresolvedWordUposGroups":len(groups),
        "distinctReadingIds":len(rows),
        "sourceMatchCounts":{
            status:sum(1 for r in rows.values() if r["sourceStatus"]==status)
            for status in ("both-exact","one-exact","no-exact")
        },
        "rows":[rows[k] for k in sorted(rows)],
        "productionChanged":False,
    }


def main()->None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue",type=Path,required=True)
    parser.add_argument("--concised",type=Path,required=True)
    parser.add_argument("--revised",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    queue=json.loads(args.queue.read_text("utf-8"))
    groups=queue.get("groups",[])
    texts={group["word"] for group in groups}
    source=load_pinned_source_module()
    outputs={}
    checksums={}
    for kind,path in (("concised",args.concised),("revised",args.revised)):
        adapter=source.load_adapter(kind,"20260929")
        checksum,by_text=source.source_candidates(adapter,kind,path,texts)
        checksums[kind]=checksum
        outputs[kind]=by_text
    report=project(queue,checksums,outputs)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n","utf-8")
    # Only source metadata and aggregate marker counts, never dictionary text.
    print("MOE_READING_POS_TAG_STRUCTURE "+json.dumps({
        "groups":report["unresolvedWordUposGroups"],
        "readings":report["distinctReadingIds"],
        "sources":report["sourceMatchCounts"],
        "markerCountByDictionary":{
            kind:sum(len(s["grammarMarkerStructure"]["markers"])
                     for r in report["rows"] for s in r["sources"] if s["dictionary"]==kind)
            for kind in checksums
        },
    },ensure_ascii=False))


if __name__=="__main__":
    main()
