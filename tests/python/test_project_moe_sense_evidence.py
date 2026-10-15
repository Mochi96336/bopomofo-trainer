from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests" / "python"))
from test_project_moe_concised_readings import fixture_archive as concised_fixture  # noqa: E402
from test_project_moe_revised_readings import fixture_archive as revised_fixture  # noqa: E402


def load_pilot():
    path = ROOT / "scripts" / "project-moe-sense-evidence.py"
    spec = importlib.util.spec_from_file_location("project_moe_sense_pilot_test", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class MoeSensePilotEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.pilot = load_pilot()
        self.concised = self.pilot.load_adapter("concised")
        self.revised = self.pilot.load_adapter("revised")
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def setup_concised(self, rows):
        archive = self.root / "concised.zip"
        workbook = concised_fixture(archive, self.concised, rows)
        self.concised.EXPECTED_ARCHIVE_SHA256 = hashlib.sha256(archive.read_bytes()).hexdigest()
        self.concised.EXPECTED_MEMBER_SIZE = len(workbook)
        self.concised.EXPECTED_MEMBER_SHA256 = hashlib.sha256(workbook).hexdigest()
        self.concised.EXPECTED_DIMENSION = f"A1:O{len(rows) + 1}"
        return archive

    def setup_revised(self, rows):
        archive = self.root / "revised.zip"
        workbook, guide = revised_fixture(archive, self.revised, rows)
        self.revised.EXPECTED_ARCHIVE_SHA256 = hashlib.sha256(archive.read_bytes()).hexdigest()
        self.revised.EXPECTED_MAIN_MEMBER_SIZE = len(workbook)
        self.revised.EXPECTED_MAIN_MEMBER_SHA256 = hashlib.sha256(workbook).hexdigest()
        self.revised.EXPECTED_FIELD_GUIDE_SIZE = len(guide)
        self.revised.EXPECTED_FIELD_GUIDE_SHA256 = hashlib.sha256(guide).hexdigest()
        self.revised.EXPECTED_DIMENSION = f"A1:R{len(rows) + 1}"
        return archive

    def test_polyphonic_exact_reading_match_and_definition_privacy(self):
        # Entirely synthetic workbook test strings; no MOE content is shipped.
        concised = self.setup_concised([
            {"headword": "種", "entry_id": "MOCK-C1", "order": 1,
             "bopomofo": "ㄓㄨㄥˇ", "definition": "MOCK: category sense"},
            {"headword": "種", "entry_id": "MOCK-C2", "order": 2,
             "bopomofo": "ㄓㄨㄥˋ", "definition": "MOCK: planting sense"},
        ])
        revised = self.setup_revised([
            {"headword": "東西", "entry_id": "MOCK-R1", "order": 1,
             "bopomofo": "ㄉㄨㄥ　ㄒㄧ", "definition": "MOCK: compass sense"},
            {"headword": "東西", "entry_id": "MOCK-R2", "order": 2,
             "bopomofo": "ㄉㄨㄥ　˙ㄒㄧ", "definition": "MOCK: object sense"},
        ])
        _, default, _, _ = self.concised.read_source_rows(concised, {"種"})
        self.assertIsNone(default["種"][0].definition)
        _, with_sense, _, _ = self.concised.read_source_rows(
            concised, {"種"}, include_definition=True
        )
        self.assertEqual(with_sense["種"][0].definition, "MOCK: category sense")

        c_hash, c = self.pilot.source_candidates(self.concised, "concised", concised, {"種", "東西"})
        r_hash, r = self.pilot.source_candidates(self.revised, "revised", revised, {"種", "東西"})
        targets = [
            {"text": "種", "reading": "ㄓㄨㄥ3", "entryId": "word:種:ㄓㄨㄥ3"},
            {"text": "種", "reading": "ㄓㄨㄥ4", "entryId": "word:種:ㄓㄨㄥ4"},
            {"text": "東西", "reading": "ㄉㄨㄥ1 ㄒㄧ1", "entryId": "word:東西:ㄉㄨㄥ1-ㄒㄧ1"},
            {"text": "東西", "reading": "ㄉㄨㄥ1 ㄒㄧ5", "entryId": "word:東西:ㄉㄨㄥ1-ㄒㄧ5"},
            {"text": "種", "reading": "ㄓㄨㄥ5", "entryId": "word:種:ㄓㄨㄥ5"},
        ]
        public, private = self.pilot.project_evidence(
            targets, [("moe-concised", c_hash, c), ("moe-revised", r_hash, r)]
        )
        self.assertEqual(public["matchCounts"]["one-source-row-awaiting-sense-review"], 4)
        self.assertEqual(public["matchCounts"]["no-exact-source-reading"], 1)
        self.assertEqual(public["rows"][0]["sourceRows"][0]["sourceEntryId"], "MOCK-C1")
        self.assertEqual(public["rows"][3]["sourceRows"][0]["sourceKind"], "moe-revised")
        self.assertEqual(public["rows"][0]["sourceRows"][0]["definitionSha256"],
                         hashlib.sha256(b"MOCK: category sense").hexdigest())
        self.assertNotIn("MOCK: category sense", json.dumps(public, ensure_ascii=False))
        self.assertNotIn('"definition":', json.dumps(public))
        self.assertIn("MOCK: category sense", json.dumps(private))
        self.assertTrue(private["PRIVATE_DO_NOT_COMMIT"])
        self.assertEqual(public["rows"][0]["senseReviewStatus"], "unreviewed")

    def test_duplicate_exact_source_rows_are_not_silently_disambiguated(self):
        concised = self.setup_concised([
            {"headword": "種", "entry_id": "MOCK-C1", "bopomofo": "ㄓㄨㄥˇ",
             "definition": "MOCK: sense A"},
            {"headword": "種", "entry_id": "MOCK-C2", "bopomofo": "ㄓㄨㄥˇ",
             "definition": "MOCK: sense B"},
        ])
        checksum, c = self.pilot.source_candidates(self.concised, "concised", concised, {"種"})
        public, _ = self.pilot.project_evidence(
            [{"text": "種", "reading": "ㄓㄨㄥ3", "entryId": "word:種:ㄓㄨㄥ3"}],
            [("moe-concised", checksum, c)],
        )
        self.assertEqual(public["rows"][0]["matchStatus"], "multiple-source-rows-review-required")
        self.assertEqual(len(public["rows"][0]["sourceRows"]), 2)

    def test_rejects_tampered_target_identity_and_private_path_outside_ignore(self):
        path = self.root / "targets.json"
        mock = {
            "schemaVersion": "moe-sense-pilot-targets-v1",
            "pilotTexts": ["種", "說", "東西", "給", "為"],
            "rows": [{"text": text, "reading": "ㄉㄚ3", "entryId": f"word:{text}:bad"}
                     for text in ["種", "說", "東西", "給", "為"]],
        }
        path.write_text(json.dumps(mock, ensure_ascii=False), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "exact entry ID"):
            self.pilot.read_targets(path)
        with self.assertRaisesRegex(ValueError, "MUST be under ignored"):
            self.pilot.validate_output_paths(self.root / "public.json", self.root / "private.json")

    def test_pinned_archive_checksum_is_still_enforced(self):
        concised = self.setup_concised([
            {"headword": "種", "entry_id": "MOCK-C1", "bopomofo": "ㄓㄨㄥˇ",
             "definition": "MOCK: category sense"},
        ])
        self.concised.EXPECTED_ARCHIVE_SHA256 = "0" * 64
        with self.assertRaisesRegex(ValueError, "archive checksum"):
            self.pilot.source_candidates(self.concised, "concised", concised, {"種"})


if __name__ == "__main__":
    unittest.main()
