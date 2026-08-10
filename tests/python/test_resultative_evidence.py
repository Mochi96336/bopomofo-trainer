from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from ud_grammar_evidence.common import Token  # noqa: E402
from ud_grammar_evidence.resultative_shape import audit_sentences  # noqa: E402


def token(
    identifier: int,
    form: str,
    head: int,
    deprel: str,
    *,
    upos: str = "VERB",
) -> Token:
    return Token(
        identifier=identifier,
        form=form,
        lemma=form,
        upos=upos,
        xpos="VV",
        feats="_",
        head=head,
        deprel=deprel,
    )


class ResultativeEvidenceTest(unittest.TestCase):
    def test_counts_exact_compound_vv_as_resultative_evidence(self) -> None:
        sentence = [
            token(1, "主", 0, "root"),
            token(2, "結果", 1, "compound:vv", upos="ADJ"),
        ]
        audit = audit_sentences([sentence])
        self.assertEqual(audit.exact_resultative_count, 1)
        self.assertEqual(audit.exact_parent_upos_counts, {"VERB": 1})
        self.assertEqual(audit.exact_child_upos_counts, {"ADJ": 1})
        self.assertEqual(audit.generic_verbal_compound_candidate_count, 0)

    def test_keeps_generic_verbal_compound_ambiguous(self) -> None:
        sentence = [
            token(1, "主", 0, "root"),
            token(2, "次", 1, "compound"),
        ]
        audit = audit_sentences([sentence])
        self.assertEqual(audit.exact_resultative_count, 0)
        self.assertEqual(audit.generic_verbal_compound_candidate_count, 1)
        self.assertEqual(audit.generic_candidate_child_upos_counts, {"VERB": 1})

    def test_does_not_promote_compound_ext_to_resultative(self) -> None:
        sentence = [
            token(1, "主", 0, "root"),
            token(2, "延伸", 1, "compound:ext", upos="ADJ"),
        ]
        audit = audit_sentences([sentence])
        self.assertEqual(audit.exact_resultative_count, 0)
        self.assertEqual(audit.extent_verbal_compound_count, 1)
        self.assertEqual(audit.extent_child_upos_counts, {"ADJ": 1})

    def test_requires_verbal_parent_and_verbal_or_adjectival_child_for_candidates(self) -> None:
        sentence = [
            token(1, "名詞", 0, "root", upos="NOUN"),
            token(2, "動詞", 1, "compound"),
            token(3, "名詞二", 4, "compound", upos="NOUN"),
            token(4, "主", 0, "conj"),
        ]
        audit = audit_sentences([sentence])
        self.assertEqual(audit.generic_verbal_compound_candidate_count, 0)
        self.assertEqual(audit.compound_relation_counts, {"compound": 2})


if __name__ == "__main__":
    unittest.main()
