from __future__ import annotations
import importlib.util
import json
import sys
import unittest
from pathlib import Path

PATH=Path(__file__).resolve().parents[2]/"scripts"/"audit-moe-reading-pos-tag-shapes.py"
SPEC=importlib.util.spec_from_file_location("moe_reading_pos_shape_test",PATH)
assert SPEC and SPEC.loader
MODULE=importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name]=MODULE
SPEC.loader.exec_module(MODULE)


class SourceRoleProjectionTest(unittest.TestCase):
    def test_only_marker_shapes_not_copyrighted_definition_are_published(self):
        sample="動\n測試釋義\n名\n例子"
        m=MODULE.marker_structure(sample)
        self.assertTrue(m["present"])
        self.assertGreaterEqual(len(m["markers"]),2)
        self.assertNotIn("definition",json.dumps(m,ensure_ascii=False))
        self.assertNotIn("釋義",json.dumps(m,ensure_ascii=False))
        self.assertEqual(MODULE.marker_structure(None),{"present":False,"length":0,"markers":[]})

    def test_live_inventory_and_exact_reading_identity_required(self):
        queue={
            "schemaVersion":"unresolved-catalog-reading-role-input-v1",
            "sourceEdition":"20260929",
            "groups":[{
                "word":"看","upos":"VERB",
                "readingEntryIds":["word:看:ㄎㄢ1","word:看:ㄎㄢ4"],
                "readingIdentities":[
                    {"entryId":"word:看:ㄎㄢ1","reading":"ㄎㄢ1"},
                    {"entryId":"word:看:ㄎㄢ4","reading":"ㄎㄢ4"},
                ],
            }],
        }
        candidate=lambda sid:{
            "sourceEntryId":sid,"sourcePhysicalRow":1,
            "definitionSha256":"a"*64,"definition":"動\n看護"
        }
        matched={
            "concised":{"看":{"ㄎㄢ1":[candidate("ID-1")],"ㄎㄢ4":[candidate("ID-2")]}},
            "revised":{"看":{"ㄎㄢ1":[candidate("ID-3")],"ㄎㄢ4":[candidate("ID-4")]}},
        }
        report=MODULE.project(queue,{"concised":"a"*64,"revised":"b"*64},matched)
        self.assertEqual(report["sourceMatchCounts"]["both-exact"],2)
        self.assertFalse(report["productionChanged"])
        self.assertEqual(report["rows"][0]["linkedUposes"],["VERB"])
        self.assertNotIn("看護",json.dumps(report,ensure_ascii=False))
        altered=json.loads(json.dumps(queue))
        altered["groups"][0]["readingIdentities"][0]["entryId"]="word:看:ㄎㄢ2"
        with self.assertRaisesRegex(ValueError,"identity mismatch"):
            MODULE.project(altered,{},matched)


if __name__=="__main__":
    unittest.main()
