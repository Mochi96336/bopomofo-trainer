from __future__ import annotations
import importlib.util
import sys
import unittest
from pathlib import Path

PATH=Path(__file__).resolve().parents[2]/"scripts"/"triage-moe-reading-pos-roles.py"
SPEC=importlib.util.spec_from_file_location("triage_moe_role_test",PATH)
assert SPEC and SPEC.loader
MODULE=importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name]=MODULE
SPEC.loader.exec_module(MODULE)

class ExactRoleTriageTest(unittest.TestCase):
    def setUp(self):
        self.ids=["word:了:ㄌㄜ5","word:了:ㄌㄧㄠ3"]
        self.inventory={
            "schemaVersion":"unresolved-catalog-reading-role-input-v1",
            "sourceEdition":"20260929",
            "groups":[{
                "word":"了","upos":"PART","readingEntryIds":self.ids,
            }],
        }
        self.evidence={
            "schemaVersion":"unresolved-reading-moe-grammatical-tags-v1",
            "sourceEdition":"20260929","productionChanged":False,
            "rows":[{
                "entryId":reading_id,"word":"了","linkedUposes":["PART"],
                "sourceStatus":"both-exact","sources":[{
                    "dictionary":"revised","sourceEntryId":str(i),
                    "grammarMarkerStructure":{"markers":[{
                        "tag":tag,"previousCodepoint":"U+005B",
                        "nextCodepoint":"U+005D",
                    }]},
                },{
                    "dictionary":"concised","sourceEntryId":str(i),
                    "grammarMarkerStructure":{"markers":[]},
                }],
            } for i,(reading_id,tag) in enumerate(zip(self.ids,["助","動"]))]
        }
    def test_exact_both_source_singleton_is_review_candidate_only(self):
        result=MODULE.analyze(self.inventory,self.evidence)
        self.assertEqual(result["unresolvedGroups"],1)
        self.assertEqual(result["classificationCounts"]["singleton-explicit-pos-double-source-review"],1)
        self.assertEqual(result["rows"][0]["positiveReadings"],[self.ids[0]])
        self.assertFalse(result["productionChanged"])
        self.assertIn("not negative evidence",result["disclaimer"])
    def test_no_source_or_missing_pos_is_not_assumed_invalid(self):
        self.evidence["rows"][1]["sources"][0]["grammarMarkerStructure"]["markers"]=[]
        result=MODULE.analyze(self.inventory,self.evidence)
        self.assertEqual(result["rows"][0]["classification"],"incomplete-explicit-pos-annotation")
        self.assertFalse(result["rows"][0]["completeRevisedTagAnnotationInThisGroup"])
    def test_different_pos_is_not_implicitly_licensed(self):
        self.inventory["groups"][0]["upos"]="ADV"
        for row in self.evidence["rows"]:row["linkedUposes"]=["ADV"]
        out=MODULE.analyze(self.inventory,self.evidence)
        self.assertEqual(out["rows"][0]["positiveReadings"],[])
        self.assertEqual(out["rows"][0]["classification"],"no-matching-explicit-pos")
    def test_requires_true_origin_identity(self):
        self.evidence["rows"][0]["word"]="不"
        with self.assertRaisesRegex(ValueError,"does not match"):
            MODULE.analyze(self.inventory,self.evidence)

if __name__=="__main__":unittest.main()
