from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from ctb_grammar_evidence.xcomp_control import (  # noqa: E402
    audit_source_dir,
    audit_tree,
    parse_bracketed_forest,
    summarize,
)


SUBJECT_CONTROL = """
(IP
  (NP-PN-SBJ-1 (NN 甲))
  (VP (VV 想)
      (IP-OBJ
        (NP-SBJ (-NONE- *PRO*-1))
        (VP (VV 走)))))
"""

OBJECT_CONTROL = """
(IP
  (NP-SBJ (NN 甲))
  (VP (VV 請)
      (NP-PN-OBJ-2 (NN 乙))
      (IP-OBJ
        (NP-SBJ (-NONE- *PRO*-2))
        (VP (VV 走)))))
"""

OBJECT_WITHOUT_COINDEX = """
(IP
  (NP-SBJ (NN 甲))
  (VP (VV 安排)
      (NP-PN-OBJ-2 (NN 乙))
      (IP-OBJ
        (NP-SBJ (-NONE- *PRO*))
        (VP (VV 走)))))
"""

AMBIGUOUS_CONTROLLER = """
(IP
  (NP-PN-SBJ-3 (NN 甲))
  (VP (VV 令)
      (NP-PN-OBJ-3 (NN 乙))
      (IP-OBJ
        (NP-SBJ (-NONE- *PRO*-3))
        (VP (VV 走)))))
"""

NESTED_MATRIX_VP = """
(IP
  (NP-PN-SBJ-4 (NN 甲))
  (VP (ADVP (AD 才))
      (VP (VV 想)
          (IP-OBJ
            (NP-SBJ (-NONE- *PRO*-4))
            (VP (VV 走))))))
"""

ADJUNCT_CONTROL = """
(IP
  (NP-PN-SBJ-5 (NN 甲))
  (VP (VV 走)
      (IP-ADV
        (NP-SBJ (-NONE- *PRO*-5))
        (VP (VV 買)
            (NP-OBJ (NN 飯))))))
"""


class CtbXcompControllerEvidenceTest(unittest.TestCase):
    def parse_one(self, text: str):
        trees = parse_bracketed_forest(text)
        self.assertEqual(len(trees), 1)
        return trees[0]

    def test_classifies_subject_control_from_pro_coindexation(self) -> None:
        observations = audit_tree(self.parse_one(SUBJECT_CONTROL))
        self.assertEqual(len(observations), 1)
        observation = observations[0]
        self.assertEqual(observation.controller_kind, "subject")
        self.assertEqual(observation.controller_index, 1)
        self.assertEqual(observation.matrix_form, "想")
        self.assertEqual(observation.matrix_pos, "VV")
        self.assertTrue(observation.indexed_pro)

    def test_classifies_object_control_from_pro_coindexation(self) -> None:
        observations = audit_tree(self.parse_one(OBJECT_CONTROL))
        self.assertEqual(len(observations), 1)
        observation = observations[0]
        self.assertEqual(observation.controller_kind, "object")
        self.assertEqual(observation.controller_index, 2)
        self.assertEqual(observation.matrix_form, "請")
        self.assertEqual(observation.matrix_pos, "VV")

    def test_does_not_infer_object_control_from_object_presence(self) -> None:
        audit = summarize(audit_tree(self.parse_one(OBJECT_WITHOUT_COINDEX)))
        self.assertEqual(audit.control_candidate_count, 1)
        self.assertEqual(audit.subject_controller_count, 0)
        self.assertEqual(audit.object_controller_count, 0)
        self.assertEqual(audit.unresolved_count, 1)
        self.assertEqual(audit.unindexed_pro_count, 1)

    def test_multiple_same_index_matrix_arguments_fail_closed(self) -> None:
        audit = summarize(audit_tree(self.parse_one(AMBIGUOUS_CONTROLLER)))
        self.assertEqual(audit.control_candidate_count, 1)
        self.assertEqual(audit.subject_controller_count, 0)
        self.assertEqual(audit.object_controller_count, 0)
        self.assertEqual(audit.unresolved_count, 1)
        self.assertEqual(audit.unindexed_pro_count, 0)

    def test_finds_control_head_through_nested_matrix_vp(self) -> None:
        observations = audit_tree(self.parse_one(NESTED_MATRIX_VP))
        self.assertEqual(len(observations), 1)
        observation = observations[0]
        self.assertEqual(observation.controller_kind, "subject")
        self.assertEqual(observation.matrix_form, "想")
        self.assertEqual(observation.matrix_pos, "VV")

    def test_ignores_indexed_pro_in_adverbial_ip(self) -> None:
        self.assertEqual(audit_tree(self.parse_one(ADJUNCT_CONTROL)), [])

    def test_ignores_non_tree_wrapper_text(self) -> None:
        trees = parse_bracketed_forest(
            '<DOC>\n<S ID="1">\n' + SUBJECT_CONTROL + '\n</S>\n</DOC>\n'
        )
        self.assertEqual(len(trees), 1)
        self.assertEqual(len(audit_tree(trees[0])), 1)

    def test_rejects_malformed_parentheses(self) -> None:
        with self.assertRaisesRegex(ValueError, "unterminated CTB node"):
            parse_bracketed_forest("(IP (NP-SBJ (NN 甲))")

    def test_source_directory_audit_is_deterministic_and_aggregate_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = root / "bracketed" / "chtb_0001.fid"
            second = root / "bracketed" / "chtb_0002.fid"
            first.parent.mkdir(parents=True)
            first.write_text(SUBJECT_CONTROL, encoding="utf-8", newline="\n")
            second.write_text(OBJECT_CONTROL, encoding="utf-8", newline="\n")

            first_audit = audit_source_dir(root)
            second_audit = audit_source_dir(root)

            self.assertEqual(first_audit, second_audit)
            self.assertEqual(first_audit.source_file_count, 2)
            self.assertEqual(first_audit.tree_count, 2)
            self.assertEqual(first_audit.control_candidate_count, 2)
            self.assertEqual(first_audit.subject_controller_count, 1)
            self.assertEqual(first_audit.object_controller_count, 1)
            self.assertEqual(first_audit.unresolved_count, 0)
            self.assertEqual(len(first_audit.source_digest), 64)
            self.assertNotIn("甲", repr(first_audit))
            self.assertNotIn("乙", repr(first_audit))

    def test_source_directory_requires_local_licensed_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaisesRegex(FileNotFoundError, "contains no files"):
                audit_source_dir(root)


if __name__ == "__main__":
    unittest.main()
