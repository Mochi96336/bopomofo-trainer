from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from ud_lexical_compatibility import project_ranked_texts  # noqa: E402


def token(
    identifier: int,
    form: str,
    upos: str,
    head: int,
    deprel: str,
) -> str:
    return "\t".join([
        str(identifier), form, form, upos, "_", "_", str(head), deprel, "_", "_"
    ])


def sentence(lines: list[str], identifier: str) -> str:
    return f"# sent_id = {identifier}\n" + "\n".join(lines) + "\n\n"


class UdLexicalCompatibilityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source_dir = self.root / "ud"
        self.source_dir.mkdir()

        train = "".join([
            sentence([
                token(1, "我", "PRON", 2, "nsubj"),
                token(2, "吃", "VERB", 0, "root"),
                token(3, "飯", "NOUN", 2, "obj"),
            ], "s1"),
            sentence([
                token(1, "我", "PRON", 2, "nsubj"),
                token(2, "吃", "VERB", 0, "root"),
                token(3, "飯", "NOUN", 2, "obj"),
            ], "s2"),
            sentence([
                token(1, "我", "PRON", 2, "nsubj"),
                token(2, "吃", "VERB", 0, "root"),
                token(3, "理論", "NOUN", 2, "obj"),
            ], "s3"),
        ])
        files = {
            "zh_gsd-ud-train.conllu": train,
            "zh_gsd-ud-dev.conllu": "",
            "zh_gsd-ud-test.conllu": "",
        }
        self.expected_files = {}
        for filename, content in files.items():
            path = self.source_dir / filename
            path.write_text(content, encoding="utf-8", newline="\n")
            data = path.read_bytes()
            self.expected_files[filename] = {
                "split": filename.removeprefix("zh_gsd-ud-").removesuffix(".conllu"),
                "byteSize": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }

    def project(self, minimum_pair_count: int = 2):
        return project_ranked_texts(
            [(1, "我"), (2, "吃"), (3, "飯"), (4, "理論")],
            self.source_dir,
            minimum_pair_count=minimum_pair_count,
            expected_files=self.expected_files,
        )

    def test_projects_thresholded_surface_and_dependency_pairs(self) -> None:
        artifact = self.project()
        surface = {
            (row["leftText"], row["rightText"]): row
            for row in artifact["surfacePairs"]
        }
        dependency = {
            (row["headText"], row["dependentText"], row["relation"]): row
            for row in artifact["dependencyPairs"]
        }
        self.assertEqual(artifact["schemaVersion"], "ud-lexical-compatibility-v1")
        self.assertEqual(artifact["surfaceObservationCount"], 6)
        self.assertEqual(artifact["dependencyObservationCount"], 6)
        self.assertEqual(surface[("吃", "飯")]["count"], 2)
        self.assertGreater(surface[("吃", "飯")]["score"], 0)
        self.assertNotIn(("吃", "理論"), surface)
        self.assertEqual(dependency[("吃", "飯", "obj")]["count"], 2)
        self.assertNotIn(("吃", "理論", "obj"), dependency)

    def test_unseen_pairs_are_omitted_instead_of_encoded_as_negative_evidence(self) -> None:
        artifact = self.project(minimum_pair_count=1)
        surface = {
            (row["leftText"], row["rightText"]): row
            for row in artifact["surfacePairs"]
        }
        self.assertIn(("吃", "理論"), surface)
        self.assertGreaterEqual(surface[("吃", "理論")]["score"], 0)
        self.assertLessEqual(surface[("吃", "理論")]["score"], 1)
        self.assertNotIn(("飯", "吃"), surface)

    def test_is_deterministic_and_does_not_redistribute_sentences(self) -> None:
        first = self.project()
        second = self.project()
        self.assertEqual(first, second)
        serialized = json.dumps(first, ensure_ascii=False)
        self.assertNotIn("# sent_id", serialized)
        self.assertNotIn("s1", serialized)
        self.assertIn("吃", serialized)
        self.assertIn("飯", serialized)

    def test_rejects_invalid_threshold(self) -> None:
        with self.assertRaisesRegex(ValueError, "minimum pair count"):
            self.project(minimum_pair_count=0)


if __name__ == "__main__":
    unittest.main()
