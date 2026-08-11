#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from ud_grammar_evidence.causative_shape import audit_source_dir
from ud_grammar_evidence.common import (
    DEFAULT_SOURCE_DIR,
    SOURCE_ID,
    SOURCE_RELEASE,
    canonical_digest,
)

SCHEMA_VERSION = "causative-evidence-audit-v1"


def payload(source_dir: Path) -> dict[str, object]:
    audit = audit_source_dir(source_dir)
    result: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "sourceId": SOURCE_ID,
        "release": SOURCE_RELEASE,
        "causativeTokenCount": audit.causative_token_count,
        "uposCounts": dict(audit.upos_counts),
        "headRelationCounts": dict(audit.head_relation_counts),
        "valencySignatureCounts": dict(audit.valency_signature_counts),
        "withDirectSubjectCount": audit.with_direct_subject_count,
        "withDirectObjectCount": audit.with_direct_object_count,
        "withCcompCount": audit.with_ccomp_count,
        "withXcompCount": audit.with_xcomp_count,
        "withCcompAndDirectObjectCount": audit.with_ccomp_and_direct_object_count,
        "withCcompWithoutDirectObjectCount": audit.with_ccomp_without_direct_object_count,
        "withXcompAndDirectObjectCount": audit.with_xcomp_and_direct_object_count,
        "withXcompWithoutDirectObjectCount": audit.with_xcomp_without_direct_object_count,
        "ccompChildCount": audit.ccomp_child_count,
        "xcompChildCount": audit.xcomp_child_count,
        "ccompWithOwnSubjectCount": audit.ccomp_with_own_subject_count,
        "xcompWithOwnSubjectCount": audit.xcomp_with_own_subject_count,
    }
    result["determinismDigest"] = canonical_digest(result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Audit basic dependency shapes of tokens explicitly marked Voice=Cau "
            "in the pinned Chinese GSD source."
        )
    )
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()

    result = payload(arguments.source_dir)
    text = json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
    if arguments.output is None:
        print(text, end="")
        return
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(text, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
