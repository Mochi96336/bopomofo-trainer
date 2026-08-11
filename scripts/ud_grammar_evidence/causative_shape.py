from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from .common import (
    EXPECTED_FILES,
    OBJECT_RELATIONS,
    SUBJECT_RELATIONS,
    VALENCY_RELATIONS,
    SourceStats,
    Token,
    iter_sentences,
    sorted_counter,
    validate_source_file,
)

CAUSATIVE_FEATURE = "Voice=Cau"


@dataclass(frozen=True)
class CausativeObservation:
    upos: str
    head_relation: str
    valency_signature: str
    direct_subject_count: int
    direct_object_count: int
    ccomp_count: int
    xcomp_count: int
    ccomp_with_own_subject_count: int
    xcomp_with_own_subject_count: int


@dataclass(frozen=True)
class CausativeEvidenceAudit:
    causative_token_count: int
    upos_counts: Mapping[str, int]
    head_relation_counts: Mapping[str, int]
    valency_signature_counts: Mapping[str, int]
    with_direct_subject_count: int
    with_direct_object_count: int
    with_ccomp_count: int
    with_xcomp_count: int
    with_ccomp_and_direct_object_count: int
    with_ccomp_without_direct_object_count: int
    with_xcomp_and_direct_object_count: int
    with_xcomp_without_direct_object_count: int
    ccomp_child_count: int
    xcomp_child_count: int
    ccomp_with_own_subject_count: int
    xcomp_with_own_subject_count: int


def relation_base(relation: str) -> str:
    return relation.split(":", 1)[0]


def has_feature(token: Token, feature: str) -> bool:
    if token.feats == "_":
        return False
    return feature in token.feats.split("|")


def valency_signature(children: list[Token]) -> str:
    counts = Counter(
        relation_base(child.deprel)
        for child in children
        if relation_base(child.deprel) in VALENCY_RELATIONS
    )
    if not counts:
        return "none"
    return "|".join(f"{relation}={counts[relation]}" for relation in sorted(counts))


def has_own_subject(token: Token, children: Mapping[int, list[Token]]) -> bool:
    return any(
        relation_base(child.deprel) in SUBJECT_RELATIONS
        for child in children.get(token.identifier, [])
    )


def audit_sentence(sentence: list[Token]) -> list[CausativeObservation]:
    children: dict[int, list[Token]] = {}
    for token in sentence:
        children.setdefault(token.head, []).append(token)

    observations: list[CausativeObservation] = []
    for token in sentence:
        if not has_feature(token, CAUSATIVE_FEATURE):
            continue
        direct_children = children.get(token.identifier, [])
        subjects = [
            child for child in direct_children
            if relation_base(child.deprel) in SUBJECT_RELATIONS
        ]
        objects = [
            child for child in direct_children
            if relation_base(child.deprel) in OBJECT_RELATIONS
        ]
        ccomps = [
            child for child in direct_children
            if relation_base(child.deprel) == "ccomp"
        ]
        xcomps = [
            child for child in direct_children
            if relation_base(child.deprel) == "xcomp"
        ]
        observations.append(CausativeObservation(
            upos=token.upos,
            head_relation=relation_base(token.deprel),
            valency_signature=valency_signature(direct_children),
            direct_subject_count=len(subjects),
            direct_object_count=len(objects),
            ccomp_count=len(ccomps),
            xcomp_count=len(xcomps),
            ccomp_with_own_subject_count=sum(
                has_own_subject(child, children) for child in ccomps
            ),
            xcomp_with_own_subject_count=sum(
                has_own_subject(child, children) for child in xcomps
            ),
        ))
    return observations


def summarize(observations: list[CausativeObservation]) -> CausativeEvidenceAudit:
    upos = Counter(observation.upos for observation in observations)
    head_relations = Counter(observation.head_relation for observation in observations)
    signatures = Counter(observation.valency_signature for observation in observations)
    return CausativeEvidenceAudit(
        causative_token_count=len(observations),
        upos_counts=sorted_counter(upos),
        head_relation_counts=sorted_counter(head_relations),
        valency_signature_counts=sorted_counter(signatures),
        with_direct_subject_count=sum(
            observation.direct_subject_count > 0 for observation in observations
        ),
        with_direct_object_count=sum(
            observation.direct_object_count > 0 for observation in observations
        ),
        with_ccomp_count=sum(observation.ccomp_count > 0 for observation in observations),
        with_xcomp_count=sum(observation.xcomp_count > 0 for observation in observations),
        with_ccomp_and_direct_object_count=sum(
            observation.ccomp_count > 0 and observation.direct_object_count > 0
            for observation in observations
        ),
        with_ccomp_without_direct_object_count=sum(
            observation.ccomp_count > 0 and observation.direct_object_count == 0
            for observation in observations
        ),
        with_xcomp_and_direct_object_count=sum(
            observation.xcomp_count > 0 and observation.direct_object_count > 0
            for observation in observations
        ),
        with_xcomp_without_direct_object_count=sum(
            observation.xcomp_count > 0 and observation.direct_object_count == 0
            for observation in observations
        ),
        ccomp_child_count=sum(observation.ccomp_count for observation in observations),
        xcomp_child_count=sum(observation.xcomp_count for observation in observations),
        ccomp_with_own_subject_count=sum(
            observation.ccomp_with_own_subject_count for observation in observations
        ),
        xcomp_with_own_subject_count=sum(
            observation.xcomp_with_own_subject_count for observation in observations
        ),
    )


def audit_source_dir(
    source_dir: Path,
    *,
    expected_files=EXPECTED_FILES,
) -> CausativeEvidenceAudit:
    observations: list[CausativeObservation] = []
    for filename in sorted(expected_files):
        path = source_dir / filename
        split = validate_source_file(path, expected_files)
        stats = SourceStats(
            filename=filename,
            split=split,
            byte_size=path.stat().st_size,
            checksum_sha256=str(expected_files[filename]["sha256"]),
        )
        for sentence in iter_sentences(path, stats):
            observations.extend(audit_sentence(sentence))
    return summarize(observations)
