import importlib.util
import unittest
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "scripts" / "project-polyphone-reading-source-batch.py"
SPEC = importlib.util.spec_from_file_location("polyphone_source_batch_test", PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def fake_queue():
    return {
        "version": "bulk-syntax-evidence-triage-v1",
        "tier1": {
            "scope": "tier1",
            "blockedWordUposGroups": 3,
            "rows": [
                {"word": "種", "upos": "NOUN",
                 "readingEntryIds": ["word:種:ㄓㄨㄥ3", "word:種:ㄓㄨㄥ4"]},
                {"word": "種", "upos": "VERB",
                 "readingEntryIds": ["word:種:ㄓㄨㄥ3", "word:種:ㄓㄨㄥ4"]},
                {"word": "東西", "upos": "NOUN",
                 "readingEntryIds": ["word:東西:ㄉㄨㄥ1-ㄒㄧ1", "word:東西:ㄉㄨㄥ1-ㄒㄧ5"]},
            ],
        },
    }


class SourceBatchTests(unittest.TestCase):
    def test_batch_unions_word_reading_once_across_upos(self):
        rows = MODULE.targets_from_bulk_triage(fake_queue(), "tier1")
        self.assertEqual(len(rows), 4)
        seeds = {r["entryId"]: r for r in rows}
        self.assertEqual(seeds["word:種:ㄓㄨㄥ3"]["activeUposes"], ["NOUN", "VERB"])
        self.assertEqual(seeds["word:東西:ㄉㄨㄥ1-ㄒㄧ5"]["reading"], "ㄉㄨㄥ1 ㄒㄧ5")

    def test_wrong_schema_and_truncated_queue_fail_closed(self):
        q = fake_queue()
        q["version"] = "unknown"
        with self.assertRaises(ValueError):
            MODULE.targets_from_bulk_triage(q, "tier1")
        q = fake_queue()
        q["tier1"]["blockedWordUposGroups"] = 5
        with self.assertRaises(ValueError):
            MODULE.targets_from_bulk_triage(q, "tier1")

    def test_duplicate_or_wrong_reading_identity_fails_closed(self):
        q = fake_queue()
        q["tier1"]["rows"][0]["readingEntryIds"][0] = "word:別:ㄅㄧㄝ2"
        with self.assertRaises(ValueError):
            MODULE.targets_from_bulk_triage(q, "tier1")
        q = fake_queue()
        q["tier1"]["rows"][1] = dict(q["tier1"]["rows"][0])
        with self.assertRaises(ValueError):
            MODULE.targets_from_bulk_triage(q, "tier1")

    def test_source_archive_is_not_needed_for_inventory_validation(self):
        # Unit verification is fully offline; the actual import must separately
        # pass pinned checksums for both original MOE source ZIP archives.
        rows = MODULE.targets_from_bulk_triage(fake_queue(), "tier1")
        self.assertTrue(all("sourceRows" not in row for row in rows))
        self.assertTrue(all("senseReviewStatus" not in row for row in rows))


if __name__ == "__main__":
    unittest.main()
