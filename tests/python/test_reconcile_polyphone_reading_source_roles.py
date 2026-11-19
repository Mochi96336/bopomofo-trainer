import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/reconcile-polyphone-reading-source-roles.py"
SPEC = importlib.util.spec_from_file_location("reconcile_polyphone_source_test", SCRIPT)
assert SPEC and SPEC.loader
MOD = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MOD
SPEC.loader.exec_module(MOD)


def sample():
    triage = {
        "version": "bulk-syntax-evidence-triage-v1",
        "tier1": {
            "scope": "tier1",
            "blockedWordUposGroups": 2,
            "rows": [
                {"word": "甲", "upos": "NOUN", "status": "already-reviewed-role-record",
                 "readingEntryIds": ["word:甲:ㄐㄧㄚ3", "word:甲:ㄐㄧㄚ4"]},
                {"word": "乙", "upos": "VERB", "status": "excluded-as-ambiguous-by-unambiguous-only-MOE-projection",
                 "readingEntryIds": ["word:乙:ㄧ3", "word:乙:ㄧ4"]},
            ],
        },
    }
    source = {
        "schemaVersion": "moe-polyphone-reading-source-batch-v1",
        "scope": "tier1",
        "wordUposGroups": 2,
        "rows": [
            {"text": "甲", "entryId": "word:甲:ㄐㄧㄚ3",
             "sourceMatchStatus": "both-dictionaries-exact-reading"},
            {"text": "甲", "entryId": "word:甲:ㄐㄧㄚ4",
             "sourceMatchStatus": "both-dictionaries-exact-reading"},
            {"text": "乙", "entryId": "word:乙:ㄧ3",
             "sourceMatchStatus": "one-dictionary-exact-reading"},
            {"text": "乙", "entryId": "word:乙:ㄧ4",
             "sourceMatchStatus": "no-exact-word-reading-source-row"},
        ],
    }
    return triage, source


class ReconcileReadingSourceTests(unittest.TestCase):
    def test_every_word_and_syntax_role_retained_but_not_automatically_licensed(self):
        triage, sources = sample()
        result = MOD.reconcile(triage, sources)
        self.assertEqual(result["wordUposGroups"], 2)
        self.assertEqual(result["readingIdentities"], 4)
        self.assertEqual(
            result["nextActionCounts"]["check-reviewed-role-draw-reachability"], 1)
        self.assertEqual(
            result["nextActionCounts"]["needs-independent-reading-specific-syntax-evidence"], 1)
        self.assertEqual(
            result["sourceSupportByGroup"]["all-alternatives-supported-by-both"], 1)
        self.assertEqual(
            result["sourceSupportByGroup"]["at-least-one-alternative-needs-source-review"], 1)
        self.assertTrue(all(not x["productionReadingLicensed"] for x in result["rows"]))

    def test_missing_duplicate_and_mismatched_sources_fail_closed(self):
        triage, source = sample()
        source["rows"] = source["rows"][:-1]
        with self.assertRaises(ValueError):
            MOD.reconcile(triage, source)
        triage, source = sample()
        source["rows"][1]["entryId"] = source["rows"][0]["entryId"]
        with self.assertRaises(ValueError):
            MOD.reconcile(triage, source)
        triage, source = sample()
        source["rows"][0]["text"] = "乙"
        with self.assertRaises(ValueError):
            MOD.reconcile(triage, source)
        triage, source = sample()
        triage["tier1"]["blockedWordUposGroups"] = 3
        with self.assertRaises(ValueError):
            MOD.reconcile(triage, source)
        triage, source = sample()
        source["rows"][0]["sourceMatchStatus"] = "guessed-reading"
        with self.assertRaises(ValueError):
            MOD.reconcile(triage, source)


if __name__ == "__main__":
    unittest.main()
