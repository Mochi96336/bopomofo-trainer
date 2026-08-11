from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from ud_grammar_evidence.causative_shape import (  # noqa: E402
    audit_sentence,
    has_feature,
    summarize,
)
from ud_grammar_evidence.common import Token  # noqa: E402


def token(
    identifier: int,
    form: str,
    head: int,
    deprel: str,
    *,
    upos: str = "VERB",
    feats: str = "_",
) -> Token:
    return Token(
        identifier=identifier,
        form=form,
        lemma=form,
        upos=upos,
        xpos="VV",
        feats=feats,
        head=head,
        deprel=deprel,
    )


class CausativeEvidenceTest(unittest.TestCase):
    def test_classifies_ccomp_with_embedded_subject_separately(self) -> None:
        sentence = [
            token(1, "甲", 2, "nsubj", upos="NOUN"),
            token(2, "使得", 0, "root", feats="Voice=Cau"),
            token(3, "乙", 4, "nsubj", upos="NOUN"),
            token(4, "高興", 2, "ccomp"),
        ]
        audit = summarize(audit_sentence(sentence))
        self.assertEqual(audit.causative_token_count, 1)
        self.assertEqual(audit.with_ccomp_count, 1)
        self.assertEqual(audit.with_xcomp_count, 0)
        self.assertEqual(audit.with_direct_object_count, 0)
        self.assertEqual(audit.ccomp_with_own_subject_count, 1)
        self.assertEqual(audit.valency_signature_counts, {"ccomp=1|nsubj=1": 1})

    def test_classifies_object_plus_xcomp_without_inventing_ccomp(self) -> None:
        sentence = [
            token(1, "甲", 2, "nsubj", upos="NOUN"),
            token(2, "讓", 0, "root", feats="Voice=Cau"),
            token(3, "乙", 2, "obj", upos="NOUN"),
            token(4, "走", 2, "xcomp"),
        ]
        audit = summarize(audit_sentence(sentence))
        self.assertEqual(audit.causative_token_count, 1)
        self.assertEqual(audit.with_ccomp_count, 0)
        self.assertEqual(audit.with_xcomp_count, 1)
        self.assertEqual(audit.with_direct_object_count, 1)
        self.assertEqual(audit.with_xcomp_and_direct_object_count, 1)
        self.assertEqual(audit.xcomp_with_own_subject_count, 0)
        self.assertEqual(
            audit.valency_signature_counts,
            {"nsubj=1|obj=1|xcomp=1": 1},
        )

    def test_keeps_xcomp_with_overt_subject_visible_as_a_data_boundary(self) -> None:
        sentence = [
            token(1, "使", 0, "root", feats="Voice=Cau"),
            token(2, "乙", 3, "nsubj", upos="NOUN"),
            token(3, "走", 1, "xcomp"),
        ]
        audit = summarize(audit_sentence(sentence))
        self.assertEqual(audit.with_xcomp_count, 1)
        self.assertEqual(audit.xcomp_with_own_subject_count, 1)

    def test_ignores_tokens_without_exact_causative_voice_feature(self) -> None:
        passive = token(1, "被", 0, "root", feats="Voice=Pass")
        compound = token(2, "使", 0, "root", feats="Aspect=Perf|Voice=Cau")
        self.assertFalse(has_feature(passive, "Voice=Cau"))
        self.assertTrue(has_feature(compound, "Voice=Cau"))
        audit = summarize(audit_sentence([passive]))
        self.assertEqual(audit.causative_token_count, 0)


if __name__ == "__main__":
    unittest.main()
