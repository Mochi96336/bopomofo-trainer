#!/usr/bin/env python3
"""Project sparse lexical compatibility evidence from pinned UD Chinese GSD."""

from __future__ import annotations

import argparse
from pathlib import Path

from ud_grammar_evidence import DEFAULT_SOURCE_DIR, write_json
from ud_lexical_compatibility import project_generation


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidates", required=True, type=Path)
    parser.add_argument("--candidate-manifest", required=True, type=Path)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--minimum-pair-count", type=int, default=2)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()

    artifact = project_generation(
        arguments.candidates,
        arguments.candidate_manifest,
        arguments.source_dir,
        minimum_pair_count=arguments.minimum_pair_count,
    )
    write_json(arguments.output, artifact)
    print(
        f"projected {len(artifact['surfacePairs'])} surface pairs and "
        f"{len(artifact['dependencyPairs'])} dependency pairs from "
        f"{artifact['surfaceObservationCount']} / {artifact['dependencyObservationCount']} "
        f"candidate-pair observations; digest {artifact['determinismDigest']}"
    )


if __name__ == "__main__":
    main()
