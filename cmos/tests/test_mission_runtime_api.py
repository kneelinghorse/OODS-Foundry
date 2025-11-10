"""Regression tests for mission runtime helper functions."""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

CMOS_ROOT = Path(__file__).resolve().parents[1]
if str(CMOS_ROOT) not in sys.path:
    sys.path.insert(0, str(CMOS_ROOT))

from context.mission_runtime import complete, next_mission, start


class MissionRuntimeHelpersTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = CMOS_ROOT
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "cmos.sqlite"
        shutil.copy2(self.repo_root / "db" / "cmos.sqlite", self.db_path)
        self.mission_id = "TEST-RUNTIME"
        self._seed_test_mission()

    def tearDown(self) -> None:  # pragma: no cover - cleanup
        self.temp_dir.cleanup()

    def _seed_test_mission(self) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("DELETE FROM missions WHERE id = ?", (self.mission_id,))
            conn.execute(
                """
                INSERT INTO missions (id, sprint_id, name, status, completed_at, notes, metadata)
                VALUES (?, NULL, ?, 'Queued', NULL, NULL, ?)
                """,
                (
                    self.mission_id,
                    "Helper mission for API regression tests",
                    json.dumps({"metadata": {"description": "API regression mission"}}, ensure_ascii=False),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def test_next_mission_returns_candidate(self) -> None:
        candidate = next_mission(repo_root=self.repo_root, db_path=self.db_path)
        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertIn("id", candidate)
        self.assertIsInstance(candidate["id"], str)

    def test_start_and_complete_update_status(self) -> None:
        start(
            self.mission_id,
            summary="Starting helper mission",
            agent="unittest",
            repo_root=self.repo_root,
            db_path=self.db_path,
        )

        self._assert_mission_status("In Progress")

        complete(
            self.mission_id,
            summary="Finished helper mission",
            notes="Validated helper workflow",
            agent="unittest",
            promote_next=False,
            repo_root=self.repo_root,
            db_path=self.db_path,
        )

        self._assert_mission_status("Completed")

    def _assert_mission_status(self, expected: str) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            row = conn.execute(
                "SELECT status FROM missions WHERE id = ?",
                (self.mission_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertIsNotNone(row, "Mission not found in test database")
        self.assertEqual(expected, row[0])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
