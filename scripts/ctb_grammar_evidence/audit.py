from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .xcomp_control import audit_source_dir

SCHEMA_VERSION = "ctb-xcomp-controller-evidence-audit-v1"
SOURCE_ID = "ldc:chinese-treebank-9.0-local"
SOURCE_RELEASE = "9.0"
SOURCE_CATALOG_ID = "LDC2016T13"
EVIDENCE_CONTRACT = "ctb-ip-obj-pro-coindex-controller-v1"


def canonical_digest(value: object) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def payload(source_dir: Path, *, pattern: str = "*.fid") -> dict[str, object]:
    audit = audit_source_dir(source_dir, pattern=pattern)
    result: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "sourceId": SOURCE_ID,
        "release": SOURCE_RELEASE,
        "catalogId": SOURCE_CATALOG_ID,
        "evidenceContract": EVIDENCE_CONTRACT,
        "sourceFileCount": audit.source_file_count,
        "treeCount": audit.tree_count,
        "controlCandidateCount": audit.control_candidate_count,
        "subjectControllerCount": audit.subject_controller_count,
        "objectControllerCount": audit.object_controller_count,
        "unresolvedCount": audit.unresolved_count,
        "projectableSubjectControllerCount": audit.projectable_subject_controller_count,
        "projectableObjectControllerCount": audit.projectable_object_controller_count,
        "unindexedProCount": audit.unindexed_pro_count,
        "missingMatrixHeadCount": audit.missing_matrix_head_count,
        "sourceDigest": audit.source_digest,
    }
    result["determinismDigest"] = canonical_digest(result)
    return result
