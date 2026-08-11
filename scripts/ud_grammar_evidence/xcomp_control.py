from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Literal

from .common import (
    EXPECTED_FILES,
    OBJECT_RELATIONS,
    SUBJECT_RELATIONS,
    validate_source_file,
)

ControllerKind = Literal["subject", "object", "other", "unresolved"]
ENHANCED_HEAD_RE = re.compile(r"^[0-9]+(?:\.[0-9]+)?$")


@dataclass(frozen=True)
class EnhancedDependency:
    head: str
    relation: str


@dataclass(frozen=True)
class AuditToken:
    identifier: int
    head: int
    deprel: str
    deps: tuple[EnhancedDependency, ...]


@dataclass(frozen=True)
class XcompControllerObservation:
    matrix_id: int
    xcomp_id: int
    controller_kind: ControllerKind
    controller_id: int | None
    matrix_has_object: bool


@dataclass(frozen=True)
class XcompControllerAudit:
    xcomp_count: int
    subject_controller_count: int
    object_controller_count: int
    other_controller_count: int
    unresolved_count: int
    basic_object_plus_xcomp_count: int
    unresolved_basic_object_plus_xcomp_count: int


def relation_base(relation: str) -> str:
    return relation.split(":", 1)[0]


def parse_enhanced_dependencies(value: str) -> tuple[EnhancedDependency, ...]:
    if value == "_":
        return ()
    result: list[EnhancedDependency] = []
    for item in value.split("|"):
        head_source, separator, relation = item.partition(":")
        if not separator or ENHANCED_HEAD_RE.fullmatch(head_source) is None or not relation:
            raise ValueError(f"invalid enhanced dependency {item!r}")
        result.append(EnhancedDependency(head=head_source, relation=relation))
    return tuple(result)


def parse_audit_token(line: str, path: Path, line_number: int) -> AuditToken | None:
    columns = line.split("\t")
    if len(columns) != 10:
        raise ValueError(
            f"{path}:{line_number}: expected 10 CoNLL-U columns, found {len(columns)}"
        )
    identifier = columns[0]
    if "-" in identifier or "." in identifier:
        return None
    if not identifier.isdigit() or not columns[6].isdigit():
        raise ValueError(f"{path}:{line_number}: invalid syntactic token identity")
    return AuditToken(
        identifier=int(identifier),
        head=int(columns[6]),
        deprel=columns[7],
        deps=parse_enhanced_dependencies(columns[8]),
    )


def iter_audit_sentences(path: Path) -> Iterator[list[AuditToken]]:
    sentence: list[AuditToken] = []
    with path.open("r", encoding="utf-8", newline="") as source:
        for line_number, raw_line in enumerate(source, start=1):
            line = raw_line.rstrip("\r\n")
            if not line:
                if sentence:
                    yield sentence
                    sentence = []
                continue
            if line.startswith("#"):
                continue
            token = parse_audit_token(line, path, line_number)
            if token is not None:
                sentence.append(token)
    if sentence:
        yield sentence


def is_external_subject_relation(relation: str) -> bool:
    parts = relation.split(":")
    return parts[0] in SUBJECT_RELATIONS and "xsubj" in parts[1:]


def audit_sentence(sentence: list[AuditToken]) -> list[XcompControllerObservation]:
    children: dict[int, list[AuditToken]] = {}
    for token in sentence:
        children.setdefault(token.head, []).append(token)

    observations: list[XcompControllerObservation] = []
    for matrix in sentence:
        matrix_children = children.get(matrix.identifier, [])
        xcomps = [
            child for child in matrix_children
            if relation_base(child.deprel) == "xcomp"
        ]
        if not xcomps:
            continue
        matrix_arguments = [
            child for child in matrix_children
            if relation_base(child.deprel) in SUBJECT_RELATIONS | OBJECT_RELATIONS
        ]
        matrix_has_object = any(
            relation_base(child.deprel) in OBJECT_RELATIONS
            for child in matrix_arguments
        )

        for xcomp in xcomps:
            xcomp_head = str(xcomp.identifier)
            controllers = [
                argument for argument in matrix_arguments
                if any(
                    edge.head == xcomp_head
                    and is_external_subject_relation(edge.relation)
                    for edge in argument.deps
                )
            ]
            if len(controllers) != 1:
                observations.append(XcompControllerObservation(
                    matrix_id=matrix.identifier,
                    xcomp_id=xcomp.identifier,
                    controller_kind="unresolved",
                    controller_id=None,
                    matrix_has_object=matrix_has_object,
                ))
                continue

            controller = controllers[0]
            basic_relation = relation_base(controller.deprel)
            if basic_relation in SUBJECT_RELATIONS:
                kind: ControllerKind = "subject"
            elif basic_relation in OBJECT_RELATIONS:
                kind = "object"
            else:
                kind = "other"
            observations.append(XcompControllerObservation(
                matrix_id=matrix.identifier,
                xcomp_id=xcomp.identifier,
                controller_kind=kind,
                controller_id=controller.identifier,
                matrix_has_object=matrix_has_object,
            ))
    return observations


def summarize(observations: list[XcompControllerObservation]) -> XcompControllerAudit:
    return XcompControllerAudit(
        xcomp_count=len(observations),
        subject_controller_count=sum(
            observation.controller_kind == "subject" for observation in observations
        ),
        object_controller_count=sum(
            observation.controller_kind == "object" for observation in observations
        ),
        other_controller_count=sum(
            observation.controller_kind == "other" for observation in observations
        ),
        unresolved_count=sum(
            observation.controller_kind == "unresolved" for observation in observations
        ),
        basic_object_plus_xcomp_count=sum(
            observation.matrix_has_object for observation in observations
        ),
        unresolved_basic_object_plus_xcomp_count=sum(
            observation.matrix_has_object
            and observation.controller_kind == "unresolved"
            for observation in observations
        ),
    )


def audit_source_dir(
    source_dir: Path,
    *,
    expected_files=EXPECTED_FILES,
) -> XcompControllerAudit:
    observations: list[XcompControllerObservation] = []
    for filename in sorted(expected_files):
        path = source_dir / filename
        validate_source_file(path, expected_files)
        for sentence in iter_audit_sentences(path):
            observations.extend(audit_sentence(sentence))
    return summarize(observations)
