from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from .common import (
    EXPECTED_FILES,
    SourceStats,
    Token,
    iter_sentences,
    sorted_counter,
    validate_source_file,
)

EXACT_RESULTATIVE_RELATION = "compound:vv"
AMBIGUOUS_GENERIC_RELATION = "compound"
EXTENT_RELATION = "compound:ext"
VERBAL_RESULT_UPOS = {"VERB", "ADJ"}


@dataclass(frozen=True)
class ResultativeEvidenceAudit:
    exact_resultative_count: int
    exact_parent_upos_counts: Mapping[str, int]
    exact_child_upos_counts: Mapping[str, int]
    generic_verbal_compound_candidate_count: int
    generic_candidate_child_upos_counts: Mapping[str, int]
    extent_verbal_compound_count: int
    extent_child_upos_counts: Mapping[str, int]
    compound_relation_counts: Mapping[str, int]


def audit_sentences(sentences: list[list[Token]]) -> ResultativeEvidenceAudit:
    exact_parent_upos = Counter()
    exact_child_upos = Counter()
    generic_child_upos = Counter()
    extent_child_upos = Counter()
    compound_relations = Counter()
    exact_count = 0
    generic_count = 0
    extent_count = 0

    for sentence in sentences:
        by_id = {token.identifier: token for token in sentence}
        for token in sentence:
            if token.deprel == "compound" or token.deprel.startswith("compound:"):
                compound_relations[token.deprel] += 1

            parent = by_id.get(token.head)
            if parent is None or parent.upos != "VERB" or token.upos not in VERBAL_RESULT_UPOS:
                continue

            if token.deprel == EXACT_RESULTATIVE_RELATION:
                exact_count += 1
                exact_parent_upos[parent.upos] += 1
                exact_child_upos[token.upos] += 1
            elif token.deprel == AMBIGUOUS_GENERIC_RELATION:
                generic_count += 1
                generic_child_upos[token.upos] += 1
            elif token.deprel == EXTENT_RELATION:
                extent_count += 1
                extent_child_upos[token.upos] += 1

    return ResultativeEvidenceAudit(
        exact_resultative_count=exact_count,
        exact_parent_upos_counts=sorted_counter(exact_parent_upos),
        exact_child_upos_counts=sorted_counter(exact_child_upos),
        generic_verbal_compound_candidate_count=generic_count,
        generic_candidate_child_upos_counts=sorted_counter(generic_child_upos),
        extent_verbal_compound_count=extent_count,
        extent_child_upos_counts=sorted_counter(extent_child_upos),
        compound_relation_counts=sorted_counter(compound_relations),
    )


def audit_source_dir(
    source_dir: Path,
    *,
    expected_files=EXPECTED_FILES,
) -> ResultativeEvidenceAudit:
    sentences: list[list[Token]] = []
    for filename in sorted(expected_files):
        path = source_dir / filename
        split = validate_source_file(path, expected_files)
        stats = SourceStats(
            filename=filename,
            split=split,
            byte_size=path.stat().st_size,
            checksum_sha256=str(expected_files[filename]["sha256"]),
        )
        sentences.extend(iter_sentences(path, stats))
    return audit_sentences(sentences)
