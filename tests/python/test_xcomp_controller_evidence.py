from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from ud_grammar_evidence.xcomp_control import (  # noqa: E402
    audit_sentence,
    iter_audit_sentences,
    parse_audit_token,
    summarize,
)


def token(
    identifier: int,
    form: str,
    head: int,
    deprel: str,
    deps: str = "_",
) -> str:
    return "\t".join([
        str(identifier), form, form, "VERB", "VV", "_", str(head), deprel, deps, "_"
    ])


class XcompControllerEvidenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def audit_lines(self, lines: list[str]):
        path = self.root / "fixture.conllu"
        path.write_text("\n".join(lines) + "\n\n", encoding="utf-8", newline="\n")
        sentences = list(iter_audit_sentences(path))
        self.assertEqual(len(sentences), 1)
        return summarize(audit_sentence(sentences[0]))

    def test_classifies_subject_control_only_from_xsubj_edge(self) -> None:
        audit = self.audit_lines([
            token(1, "甲", 2, "nsubj", "2:nsubj|4:nsubj:xsubj"),
            token(2, "想", 0, "root", "0:root"),
            token(4, "走", 2, "xcomp", "2:xcomp"),
        ])
        self.assertEqual(audit.xcomp_count, 1)
        self.assertEqual(audit.subject_controller_count, 1)
        self.assertEqual(audit.object_controller_count, 0)
        self.assertEqual(audit.unresolved_count, 0)

    def test_classifies_object_control_only_from_xsubj_edge(self) -> None:
        audit = self.audit_lines([
            token(1, "甲", 2, "nsubj", "2:nsubj"),
            token(2, "讓", 0, "root", "0:root"),
            token(3, "乙", 2, "obj", "2:obj|4:nsubj:xsubj"),
            token(4, "走", 2, "xcomp", "2:xcomp"),
        ])
        self.assertEqual(audit.xcomp_count, 1)
        self.assertEqual(audit.subject_controller_count, 0)
        self.assertEqual(audit.object_controller_count, 1)
        self.assertEqual(audit.unresolved_count, 0)
        self.assertEqual(audit.basic_object_plus_xcomp_count, 1)
        self.assertEqual(audit.unresolved_basic_object_plus_xcomp_count, 0)

    def test_keeps_basic_object_plus_xcomp_unresolved_without_enhanced_control(self) -> None:
        audit = self.audit_lines([
            token(1, "甲", 2, "nsubj"),
            token(2, "設置", 0, "root"),
            token(3, "設備", 2, "obj"),
            token(4, "歸", 2, "xcomp"),
        ])
        self.assertEqual(audit.xcomp_count, 1)
        self.assertEqual(audit.object_controller_count, 0)
        self.assertEqual(audit.unresolved_count, 1)
        self.assertEqual(audit.basic_object_plus_xcomp_count, 1)
        self.assertEqual(audit.unresolved_basic_object_plus_xcomp_count, 1)

    def test_multiple_xsubj_candidates_fail_closed_as_unresolved(self) -> None:
        audit = self.audit_lines([
            token(1, "甲", 2, "nsubj", "2:nsubj|4:nsubj:xsubj"),
            token(2, "令", 0, "root", "0:root"),
            token(3, "乙", 2, "obj", "2:obj|4:nsubj:xsubj"),
            token(4, "走", 2, "xcomp", "2:xcomp"),
        ])
        self.assertEqual(audit.xcomp_count, 1)
        self.assertEqual(audit.subject_controller_count, 0)
        self.assertEqual(audit.object_controller_count, 0)
        self.assertEqual(audit.unresolved_count, 1)

    def test_rejects_malformed_enhanced_dependencies(self) -> None:
        path = self.root / "bad.conllu"
        line = token(1, "甲", 0, "root", "not-a-dependency")
        with self.assertRaisesRegex(ValueError, "invalid enhanced dependency"):
            parse_audit_token(line, path, 1)


if __name__ == "__main__":
    unittest.main()
