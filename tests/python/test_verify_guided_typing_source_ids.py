from __future__ import annotations
import copy
import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[2]/"scripts"/"verify-guided-typing-source-ids.py"
SPEC=importlib.util.spec_from_file_location("verify_guided_typing_source_ids",SCRIPT)
assert SPEC and SPEC.loader
MODULE=importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name]=MODULE
SPEC.loader.exec_module(MODULE)


class GuidedTypingSourcePinsTest(unittest.TestCase):
    def setUp(self):
        self.manifest={
            "schemaVersion":"reviewed-guided-typing-readings-v1",
            "sourceEdition":"20260929",
            "groups":[{"word":"看","upos":"VERB","readings":[
                {"entryId":"word:看:ㄎㄢ1","concisedSourceId":"2550","revisedSourceId":"04501"},
                {"entryId":"word:看:ㄎㄢ4","concisedSourceId":"2562","revisedSourceId":"04519"},
            ]}],
        }
        self.source={
            "schemaVersion":"moe-polyphone-reading-source-batch-v1",
            "scope":"tier1",
            "sourceArchives":[
                {"kind":"concised","sourceVersion":"moe20260929","archiveSha256":"a"*64},
                {"kind":"revised","sourceVersion":"moe20260929","archiveSha256":"b"*64},
            ],
            "rows":[{
                "entryId":entry["entryId"],"text":"看","activeUposes":["VERB"],
                "sourceMatchStatus":"both-dictionaries-exact-reading",
                "sourceRowsByDictionary":{
                    "concised":[{"sourceEntryId":entry["concisedSourceId"]}],
                    "revised":[{"sourceEntryId":entry["revisedSourceId"]}],
                },
            } for entry in self.manifest["groups"][0]["readings"]],
        }

    def test_exact_original_ids(self):
        output=MODULE.verify(self.manifest,self.source)
        self.assertEqual(output["verifiedGroups"],1)
        self.assertEqual(output["verifiedReadingIdentities"],2)
        self.assertFalse(output["perSentencePronunciationGold"])

    def test_fails_wrong_id_and_missing_source(self):
        copy_manifest=copy.deepcopy(self.manifest)
        copy_manifest["groups"][0]["readings"][0]["revisedSourceId"]="00000"
        with self.assertRaisesRegex(ValueError,"ID mismatch"):
            MODULE.verify(copy_manifest,self.source)
        copy_source=copy.deepcopy(self.source)
        copy_source["rows"][0]["sourceMatchStatus"]="one-dictionary-exact-reading"
        with self.assertRaisesRegex(ValueError,"both dictionaries"):
            MODULE.verify(self.manifest,copy_source)

    def test_fails_wrong_upos_and_duplicate(self):
        source=copy.deepcopy(self.source)
        source["rows"][0]["activeUposes"]=["PART"]
        with self.assertRaisesRegex(ValueError,"active"):
            MODULE.verify(self.manifest,source)
        source=copy.deepcopy(self.source)
        source["rows"].append(source["rows"][0])
        with self.assertRaisesRegex(ValueError,"duplicate"):
            MODULE.verify(self.manifest,source)


if __name__=="__main__":
    unittest.main()
