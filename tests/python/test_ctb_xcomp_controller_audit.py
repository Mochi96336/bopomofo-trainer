from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from ctb_grammar_evidence.audit import (  # noqa: E402
    EVIDENCE_CONTRACT,
    SCHEMA_VERSION,
    SOURCE_CATALOG_ID,
    SOURCE_ID,
    SOURCE_RELEASE,
    payload,
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


class CtbXcompControllerAuditPayloadTest(unittest.TestCase):
    def test_payload_is_deterministic_aggregate_only_and_source_fingerprinted(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bracketed = root / "bracketed"
            bracketed.mkdir()
            (bracketed / "chtb_0001.fid").write_text(
                SUBJECT_CONTROL, encoding="utf-8", newline="\n"
            )
            (bracketed / "chtb_0002.fid").write_text(
                OBJECT_CONTROL, encoding="utf-8", newline="\n"
            )

            first = payload(root)
            second = payload(root)
            nested_root = payload(bracketed)

            self.assertEqual(first, second)
            self.assertEqual(first, nested_root)
            self.assertEqual(first["schemaVersion"], SCHEMA_VERSION)
            self.assertEqual(first["sourceId"], SOURCE_ID)
            self.assertEqual(first["release"], SOURCE_RELEASE)
            self.assertEqual(first["catalogId"], SOURCE_CATALOG_ID)
            self.assertEqual(first["evidenceContract"], EVIDENCE_CONTRACT)
            self.assertEqual(first["sourceFileCount"], 2)
            self.assertEqual(first["treeCount"], 2)
            self.assertEqual(first["controlCandidateCount"], 2)
            self.assertEqual(first["subjectControllerCount"], 1)
            self.assertEqual(first["objectControllerCount"], 1)
            self.assertEqual(first["projectableSubjectControllerCount"], 1)
            self.assertEqual(first["projectableObjectControllerCount"], 1)
            self.assertEqual(first["unresolvedCount"], 0)
            self.assertEqual(first["missingMatrixHeadCount"], 0)
            self.assertEqual(len(first["sourceDigest"]), 64)
            self.assertEqual(len(first["determinismDigest"]), 64)

            encoded = repr(first)
            self.assertNotIn("甲", encoded)
            self.assertNotIn("乙", encoded)
            self.assertNotIn("想", encoded)
            self.assertNotIn("請", encoded)


if __name__ == "__main__":
    unittest.main()
