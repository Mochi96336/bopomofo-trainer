from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Literal

ControllerKind = Literal["subject", "object", "unresolved"]
TOKEN_RE = re.compile(r"\(|\)|[^\s()]+")
LABEL_INDEX_RE = re.compile(r"-(\d+)$")
PRO_RE = re.compile(r"^\*PRO\*(?:-(\d+))?$")
VERB_TAGS = {"VV"}


@dataclass(frozen=True)
class TreeNode:
    label: str
    children: tuple[TreeNode | str, ...]


@dataclass(frozen=True)
class CtbControllerObservation:
    controller_kind: ControllerKind
    controller_index: int | None
    matrix_form: str | None
    matrix_pos: str | None
    indexed_pro: bool


@dataclass(frozen=True)
class CtbControllerAudit:
    source_file_count: int
    tree_count: int
    control_candidate_count: int
    subject_controller_count: int
    object_controller_count: int
    unresolved_count: int
    projectable_subject_controller_count: int
    projectable_object_controller_count: int
    unindexed_pro_count: int
    missing_matrix_head_count: int
    source_digest: str


def _parse_node(tokens: list[str], start: int) -> tuple[TreeNode, int]:
    if start >= len(tokens) or tokens[start] != "(":
        raise ValueError("expected '(' while parsing CTB bracket tree")
    if start + 1 >= len(tokens) or tokens[start + 1] in {"(", ")"}:
        raise ValueError("missing CTB node label")
    label = tokens[start + 1]
    children: list[TreeNode | str] = []
    index = start + 2
    while index < len(tokens):
        token = tokens[index]
        if token == ")":
            return TreeNode(label=label, children=tuple(children)), index + 1
        if token == "(":
            child, index = _parse_node(tokens, index)
            children.append(child)
            continue
        children.append(token)
        index += 1
    raise ValueError(f"unterminated CTB node {label!r}")


def parse_bracketed_forest(text: str) -> tuple[TreeNode, ...]:
    """Parse every balanced Penn-style tree and ignore non-tree wrapper text."""
    tokens = TOKEN_RE.findall(text)
    trees: list[TreeNode] = []
    index = 0
    while index < len(tokens):
        if tokens[index] != "(":
            index += 1
            continue
        tree, index = _parse_node(tokens, index)
        trees.append(tree)
    return tuple(trees)


def iter_nodes(
    root: TreeNode,
    ancestors: tuple[TreeNode, ...] = (),
) -> Iterator[tuple[TreeNode, tuple[TreeNode, ...]]]:
    yield root, ancestors
    for child in root.children:
        if isinstance(child, TreeNode):
            yield from iter_nodes(child, ancestors + (root,))


def base_label(label: str) -> str:
    return label.split("-", 1)[0]


def label_index(label: str) -> int | None:
    match = LABEL_INDEX_RE.search(label)
    return None if match is None else int(match.group(1))


def has_function(label: str, function: str) -> bool:
    return function in label.split("-")[1:]


def terminal_text(node: TreeNode) -> str | None:
    if len(node.children) != 1 or not isinstance(node.children[0], str):
        return None
    return node.children[0]


def _identity_index(values: tuple[TreeNode, ...], target: TreeNode) -> int | None:
    for index, candidate in enumerate(values):
        if candidate is target:
            return index
    return None


def _nearest_ancestor(
    ancestors: tuple[TreeNode, ...],
    label: str,
    *,
    before: TreeNode | None = None,
) -> TreeNode | None:
    values = ancestors
    if before is not None:
        before_index = _identity_index(ancestors, before)
        if before_index is None:
            return None
        values = ancestors[:before_index]
    for candidate in reversed(values):
        if base_label(candidate.label) == label:
            return candidate
    return None


def _matrix_arguments(
    matrix_clause: TreeNode,
    embedded_clause: TreeNode,
    controller_index: int,
) -> tuple[tuple[str, TreeNode], ...]:
    matches: list[tuple[str, TreeNode]] = []

    def visit(node: TreeNode, *, root: bool = False) -> None:
        if node is embedded_clause:
            return
        if not root and base_label(node.label) == "IP":
            return
        if base_label(node.label) == "NP" and label_index(node.label) == controller_index:
            if has_function(node.label, "SBJ"):
                matches.append(("subject", node))
            elif has_function(node.label, "OBJ"):
                matches.append(("object", node))
        for child in node.children:
            if isinstance(child, TreeNode):
                visit(child)

    visit(matrix_clause, root=True)
    return tuple(matches)


def _matrix_predicate_head(matrix_vp: TreeNode) -> tuple[str | None, str | None]:
    heads: list[tuple[str, str]] = []
    for child in matrix_vp.children:
        if not isinstance(child, TreeNode) or child.label not in VERB_TAGS:
            continue
        text = terminal_text(child)
        if text is not None:
            heads.append((child.label, text))
    if len(heads) != 1:
        return None, None
    pos, form = heads[0]
    return form, pos


def _selected_complement_context(
    ancestors: tuple[TreeNode, ...],
    embedded_clause: TreeNode,
) -> tuple[TreeNode, TreeNode] | None:
    """Return matrix IP/VP only for a VP-selected IP-OBJ complement."""
    if not has_function(embedded_clause.label, "OBJ"):
        return None
    embedded_index = _identity_index(ancestors, embedded_clause)
    if embedded_index is None or embedded_index <= 0:
        return None
    matrix_vp = ancestors[embedded_index - 1]
    if base_label(matrix_vp.label) != "VP":
        return None
    matrix_clause = _nearest_ancestor(ancestors, "IP", before=embedded_clause)
    if matrix_clause is None:
        return None
    return matrix_clause, matrix_vp


def audit_tree(root: TreeNode) -> list[CtbControllerObservation]:
    observations: list[CtbControllerObservation] = []
    for node, ancestors in iter_nodes(root):
        if node.label != "-NONE-":
            continue
        value = terminal_text(node)
        if value is None:
            continue
        pro_match = PRO_RE.fullmatch(value)
        if pro_match is None:
            continue

        subject_np = _nearest_ancestor(ancestors, "NP")
        if subject_np is None or not has_function(subject_np.label, "SBJ"):
            continue
        embedded_clause = _nearest_ancestor(ancestors, "IP")
        if embedded_clause is None:
            continue
        context = _selected_complement_context(ancestors, embedded_clause)
        if context is None:
            continue
        matrix_clause, matrix_vp = context

        matrix_form, matrix_pos = _matrix_predicate_head(matrix_vp)
        raw_index = pro_match.group(1)
        if raw_index is None:
            observations.append(CtbControllerObservation(
                controller_kind="unresolved",
                controller_index=None,
                matrix_form=matrix_form,
                matrix_pos=matrix_pos,
                indexed_pro=False,
            ))
            continue

        controller_index = int(raw_index)
        arguments = _matrix_arguments(matrix_clause, embedded_clause, controller_index)
        kinds = [kind for kind, _node in arguments]
        if len(kinds) == 1 and kinds[0] == "subject":
            controller_kind: ControllerKind = "subject"
        elif len(kinds) == 1 and kinds[0] == "object":
            controller_kind = "object"
        else:
            controller_kind = "unresolved"
        observations.append(CtbControllerObservation(
            controller_kind=controller_kind,
            controller_index=controller_index,
            matrix_form=matrix_form,
            matrix_pos=matrix_pos,
            indexed_pro=True,
        ))
    return observations


def _projectable(observation: CtbControllerObservation) -> bool:
    return observation.matrix_form is not None and observation.matrix_pos is not None


def summarize(
    observations: list[CtbControllerObservation],
    *,
    source_file_count: int = 0,
    tree_count: int = 0,
    source_digest: str = "",
) -> CtbControllerAudit:
    return CtbControllerAudit(
        source_file_count=source_file_count,
        tree_count=tree_count,
        control_candidate_count=len(observations),
        subject_controller_count=sum(
            observation.controller_kind == "subject" for observation in observations
        ),
        object_controller_count=sum(
            observation.controller_kind == "object" for observation in observations
        ),
        unresolved_count=sum(
            observation.controller_kind == "unresolved" for observation in observations
        ),
        projectable_subject_controller_count=sum(
            observation.controller_kind == "subject" and _projectable(observation)
            for observation in observations
        ),
        projectable_object_controller_count=sum(
            observation.controller_kind == "object" and _projectable(observation)
            for observation in observations
        ),
        unindexed_pro_count=sum(not observation.indexed_pro for observation in observations),
        missing_matrix_head_count=sum(not _projectable(observation) for observation in observations),
        source_digest=source_digest,
    )


def _source_digest(files: list[Path]) -> str:
    by_name: dict[str, Path] = {}
    for path in files:
        if path.name in by_name:
            raise ValueError(f"CTB source contains duplicate bracketed filename: {path.name}")
        by_name[path.name] = path

    digest = hashlib.sha256()
    for filename in sorted(by_name):
        digest.update(filename.encode("utf-8"))
        digest.update(b"\0")
        digest.update(by_name[filename].read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def audit_source_dir(
    source_dir: Path,
    *,
    pattern: str = "*.fid",
) -> CtbControllerAudit:
    if not source_dir.is_dir():
        raise FileNotFoundError(f"CTB source directory does not exist: {source_dir}")
    files = sorted(path for path in source_dir.rglob(pattern) if path.is_file())
    if not files:
        raise FileNotFoundError(
            f"CTB source directory contains no files matching {pattern!r}: {source_dir}"
        )

    observations: list[CtbControllerObservation] = []
    tree_count = 0
    for path in files:
        text = path.read_text(encoding="utf-8-sig")
        trees = parse_bracketed_forest(text)
        tree_count += len(trees)
        for tree in trees:
            observations.extend(audit_tree(tree))
    return summarize(
        observations,
        source_file_count=len(files),
        tree_count=tree_count,
        source_digest=_source_digest(files),
    )
