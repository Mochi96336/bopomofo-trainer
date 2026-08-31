#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from ctb_grammar_evidence.audit import payload


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Audit controller-typed open-complement evidence from a locally licensed "
            "Penn Chinese Treebank 9.0 bracketed source. No corpus text is emitted."
        )
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        required=True,
        help="Path to a locally licensed CTB 9.0 directory containing bracketed .fid files.",
    )
    parser.add_argument(
        "--glob",
        default="*.fid",
        help="Recursive bracketed-file glob (default: *.fid).",
    )
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()

    result = payload(arguments.source_dir, pattern=arguments.glob)
    text = json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
    if arguments.output is None:
        print(text, end="")
        return
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(text, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
