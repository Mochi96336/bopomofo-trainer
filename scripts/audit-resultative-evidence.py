#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from ud_grammar_evidence.common import (
    DEFAULT_SOURCE_DIR,
    SOURCE_ID,
    SOURCE_RELEASE,
    canonical_digest,
)
from ud_grammar_evidence.resultative_shape import audit_source_dir

SCHEMA_VERSION = "resultative-evidence-audit-v1"


def payload(source_dir: Path) -> dict[str, object]:
    audit = audit_source_dir(source_dir)
    result: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "sourceId": SOURCE_ID,
        "release": SOURCE_RELEASE,
        "exactResultativeRelation": "compound:vv",
        "exactResultativeCount": audit.exact_resultative_count,
        "exactParentUposCounts": dict(audit.exact_parent_upos_counts),
        "exactChildUposCounts": dict(audit.exact_child_upos_counts),
        "genericVerbalCompoundCandidateCount": audit.generic_verbal_compound_candidate_count,
        "genericCandidateChildUposCounts": dict(audit.generic_candidate_child_upos_counts),
        "extentVerbalCompoundCount": audit.extent_verbal_compound_count,
        "extentChildUposCounts": dict(audit.extent_child_upos_counts),
        "compoundRelationCounts": dict(audit.compound_relation_counts),
    }
    result["determinismDigest"] = canonical_digest(result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Audit exact Chinese UD resultative/phase compound evidence separately "
            "from ambiguous generic verbal compounds in pinned Chinese GSD."
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
