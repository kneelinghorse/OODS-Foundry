from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

CMOS_ROOT = Path(__file__).resolve().parents[1]
if str(CMOS_ROOT) not in sys.path:
    sys.path.insert(0, str(CMOS_ROOT))

from scripts.refresh_structured_data import (  # noqa: E402
    DEFAULT_BASELINE_COMPONENTS_PATH,
    DEFAULT_BASELINE_TOKENS_PATH,
    OUTPUT_DIR,
    compute_etag,
    generate_structured_payloads,
    refresh_structured_data,
)

EXPECTED_GENERATED_AT = "2025-11-22T01:09:14Z"


class RefreshStructuredDataTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.components_payload, cls.tokens_payload = generate_structured_payloads(
            generated_at=EXPECTED_GENERATED_AT
        )

    def test_defaults_target_planning_directory(self) -> None:
        self.assertEqual(OUTPUT_DIR, CMOS_ROOT / "planning")
        self.assertEqual(DEFAULT_BASELINE_COMPONENTS_PATH, OUTPUT_DIR / "oods-components.json")
        self.assertEqual(DEFAULT_BASELINE_TOKENS_PATH, OUTPUT_DIR / "oods-tokens.json")

    def test_structured_payloads_match_snapshot(self) -> None:
        expected_components = json.loads(DEFAULT_BASELINE_COMPONENTS_PATH.read_text())
        expected_tokens = json.loads(DEFAULT_BASELINE_TOKENS_PATH.read_text())

        self.assertEqual(self.components_payload, expected_components)
        self.assertEqual(self.tokens_payload, expected_tokens)

    def test_etags_are_stable(self) -> None:
        self.assertEqual(
            compute_etag(self.components_payload),
            "d1fb2f20e80d08a156eb7eeffb5dcd09fed055839796aedd9058e21e6f224be6",
        )
        self.assertEqual(
            compute_etag(self.tokens_payload),
            "0194d6f1863cebe4dcc751640d3708bda48a1bc59490352212d86d300d224ce5",
        )

    def test_refresh_writes_outputs_and_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            result = refresh_structured_data(
                output_dir=tmp_path,
                baseline_components_path=DEFAULT_BASELINE_COMPONENTS_PATH,
                baseline_tokens_path=DEFAULT_BASELINE_TOKENS_PATH,
                generated_at=EXPECTED_GENERATED_AT,
                artifact_dir=tmp_path / "artifacts",
                version_tag="test-run",
            )

            self.assertTrue(result.components.path.exists())
            self.assertTrue(result.tokens.path.exists())
            self.assertTrue(result.delta_path and result.delta_path.exists())
            self.assertTrue(result.manifest_path and result.manifest_path.exists())

            delta_contents = result.delta_path.read_text()
            self.assertIn("Structured Data Delta", delta_contents)
            self.assertIn("## Catalogue Stats", delta_contents)
            self.assertIn("## Token Stats", delta_contents)

            manifest = json.loads(result.manifest_path.read_text())
            self.assertEqual(manifest["version"], "test-run")
            self.assertEqual(manifest["artifacts"][0]["etag"], result.components.etag)
            self.assertEqual(manifest["artifacts"][1]["etag"], result.tokens.etag)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
