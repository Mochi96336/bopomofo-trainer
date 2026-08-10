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
from ud_grammar_evidence.xcomp_control import audit_source_dir

SCHEMA_VERSION = "xcomp-controller-evidence-audit-v1"


def payload(source_dir: Path) -> dict[str, object]:
    audit = audit_source_dir(source_dir)
    result: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "sourceId": SOURCE_ID,
        "release": SOURCE_RELEASE,
        "xcompCount": audit.xcomp_count,
        "subjectControllerCount": audit.subject_controller_count,
        "objectControllerCount": audit.object_controller_count,
        "otherControllerCount": audit.other_controller_count,
        "unresolvedCount": audit.unresolved_count,
        "basicObjectPlusXcompCount": audit.basic_object_plus_xcomp_count,
        "unresolvedBasicObjectPlusXcompCount": audit.unresolved_basic_object_plus_xcomp_count,
    }
    result["determinismDigest"] = canonical_digest(result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audit enhanced-UD controller evidence for basic xcomp relations."
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
