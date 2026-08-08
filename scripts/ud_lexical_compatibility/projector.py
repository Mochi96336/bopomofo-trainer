from __future__ import annotations

import math
from collections import Counter
from pathlib import Path
from typing import Any, Mapping, Sequence

from lexicon_candidate_set import load_candidate_set
from ud_grammar_evidence.common import (
    EXPECTED_FILES,
    SOURCE_ID,
    SOURCE_LICENSE,
    SOURCE_RELEASE,
    SOURCE_REPOSITORY,
    SourceStats,
    canonical_digest,
    iter_sentences,
    validate_source_file,
)

ADAPTER_VERSION = "ud-chinese-gsd-lexical-compatibility-adapter-v1"
SCHEMA_VERSION = "ud-lexical-compatibility-v1"
DEFAULT_MINIMUM_PAIR_COUNT = 2


def _association_score(
    count: int,
    left_count: int,
    right_count: int,
    total: int,
) -> float:
    """Return a reliability-shrunk positive PMI score in [0, 1]."""
    if count <= 0 or left_count <= 0 or right_count <= 0 or total <= 0:
        return 0.0
    ratio = (count * total) / (left_count * right_count)
    if ratio <= 1.0:
        return 0.0
    ppmi = math.log2(ratio)
    normalized = min(ppmi / 8.0, 1.0)
    confidence = count / (count + 3.0)
    return round(normalized * confidence, 6)


def _surface_rows(
    pair_counts: Counter[tuple[str, str]],
    left_counts: Counter[str],
    right_counts: Counter[str],
    total: int,
    minimum_pair_count: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for (left, right), count in sorted(pair_counts.items()):
        if count < minimum_pair_count:
            continue
        rows.append({
            "leftText": left,
            "rightText": right,
            "count": count,
            "score": _association_score(count, left_counts[left], right_counts[right], total),
        })
    return rows


def _dependency_rows(
    pair_counts: Counter[tuple[str, str, str]],
    head_counts: Counter[tuple[str, str]],
    dependent_counts: Counter[tuple[str, str]],
    totals: Counter[str],
    minimum_pair_count: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for (head, dependent, relation), count in sorted(pair_counts.items()):
        if count < minimum_pair_count:
            continue
        rows.append({
            "headText": head,
            "dependentText": dependent,
            "relation": relation,
            "count": count,
            "score": _association_score(
                count,
                head_counts[(relation, head)],
                dependent_counts[(relation, dependent)],
                totals[relation],
            ),
        })
    return rows


def project_ranked_texts(
    ranked_texts: Sequence[tuple[int, str]],
    source_dir: Path,
    *,
    minimum_pair_count: int = DEFAULT_MINIMUM_PAIR_COUNT,
    expected_files: Mapping[str, Mapping[str, Any]] = EXPECTED_FILES,
) -> dict[str, Any]:
    if not isinstance(minimum_pair_count, int) or minimum_pair_count <= 0:
        raise ValueError("minimum pair count must be a positive integer")
    if not ranked_texts:
        raise ValueError("lexical compatibility projection requires candidates")
    texts = [text for _, text in ranked_texts]
    ranks = [rank for rank, _ in ranked_texts]
    if any(not text for text in texts) or len(set(texts)) != len(texts):
        raise ValueError("lexical compatibility candidates require unique non-empty text")
    if any(not isinstance(rank, int) or rank <= 0 for rank in ranks) or len(set(ranks)) != len(ranks):
        raise ValueError("lexical compatibility candidates require unique positive ranks")

    candidate_texts = set(texts)
    surface_pairs: Counter[tuple[str, str]] = Counter()
    surface_left: Counter[str] = Counter()
    surface_right: Counter[str] = Counter()
    dependency_pairs: Counter[tuple[str, str, str]] = Counter()
    dependency_heads: Counter[tuple[str, str]] = Counter()
    dependency_dependents: Counter[tuple[str, str]] = Counter()
    dependency_totals: Counter[str] = Counter()
    source_files: list[dict[str, Any]] = []

    for filename in expected_files:
        path = source_dir / filename
        if not path.is_file():
            raise ValueError(f"missing UD source file: {path}")
        split = validate_source_file(path, expected_files)
        expected = expected_files[filename]
        stats = SourceStats(
            filename=filename,
            split=split,
            byte_size=path.stat().st_size,
            checksum_sha256=str(expected["sha256"]),
        )
        for sentence in iter_sentences(path, stats):
            ordered = sorted(sentence, key=lambda token: token.identifier)
            by_id = {token.identifier: token for token in ordered}
            for left_token, right_token in zip(ordered, ordered[1:]):
                if left_token.form not in candidate_texts or right_token.form not in candidate_texts:
                    continue
                key = (left_token.form, right_token.form)
                surface_pairs[key] += 1
                surface_left[left_token.form] += 1
                surface_right[right_token.form] += 1
            for dependent in ordered:
                if dependent.head == 0 or dependent.form not in candidate_texts:
                    continue
                head = by_id.get(dependent.head)
                if head is None or head.form not in candidate_texts:
                    continue
                relation = dependent.deprel
                dependency_pairs[(head.form, dependent.form, relation)] += 1
                dependency_heads[(relation, head.form)] += 1
                dependency_dependents[(relation, dependent.form)] += 1
                dependency_totals[relation] += 1
        source_files.append({
            "filename": filename,
            "split": split,
            "byteSize": stats.byte_size,
            "checksumSha256": stats.checksum_sha256,
            "sentenceCount": stats.sentence_count,
            "syntacticTokenCount": stats.syntactic_token_count,
        })

    surface_total = sum(surface_pairs.values())
    surface_rows = _surface_rows(
        surface_pairs,
        surface_left,
        surface_right,
        surface_total,
        minimum_pair_count,
    )
    dependency_rows = _dependency_rows(
        dependency_pairs,
        dependency_heads,
        dependency_dependents,
        dependency_totals,
        minimum_pair_count,
    )
    core = {
        "adapterVersion": ADAPTER_VERSION,
        "schemaVersion": SCHEMA_VERSION,
        "source": {
            "sourceId": SOURCE_ID,
            "release": SOURCE_RELEASE,
            "repository": SOURCE_REPOSITORY,
            "license": SOURCE_LICENSE,
            "files": source_files,
            "redistributionBoundary": (
                "complete CoNLL-U files and source sentences remain local; output contains only "
                "aggregate candidate-to-candidate pair counts and association scores"
            ),
        },
        "candidateCount": len(ranked_texts),
        "minimumPairCount": minimum_pair_count,
        "surfaceObservationCount": surface_total,
        "dependencyObservationCount": sum(dependency_pairs.values()),
        "surfacePairs": surface_rows,
        "dependencyPairs": dependency_rows,
    }
    return {**core, "determinismDigest": canonical_digest(core)}


def project_generation(
    candidate_path: Path,
    candidate_manifest_path: Path,
    source_dir: Path,
    *,
    minimum_pair_count: int = DEFAULT_MINIMUM_PAIR_COUNT,
    expected_files: Mapping[str, Mapping[str, Any]] = EXPECTED_FILES,
) -> dict[str, Any]:
    generation = load_candidate_set(
        candidate_path,
        candidate_manifest_path,
        require_manifest=True,
    )
    artifact = project_ranked_texts(
        [(record.general_rank, record.text) for record in generation.records],
        source_dir,
        minimum_pair_count=minimum_pair_count,
        expected_files=expected_files,
    )
    core = {key: value for key, value in artifact.items() if key != "determinismDigest"}
    core["candidateSource"] = {
        "path": candidate_path.as_posix(),
        "canonicalChecksumSha256": generation.candidate_checksum_sha256,
        "manifestLineage": generation.lineage(),
    }
    return {**core, "determinismDigest": canonical_digest(core)}
