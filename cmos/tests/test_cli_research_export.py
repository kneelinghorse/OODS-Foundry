"""Tests for the CLI research export command."""

from __future__ import annotations

import argparse
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

from cli import Environment, _research_export  # type: ignore[attr-defined]


class ResearchExportCliTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_root = Path(self.temp_dir.name)
        self.db_path = self.temp_root / "cmos.sqlite"
        shutil.copy2(CMOS_ROOT / "db" / "cmos.sqlite", self.db_path)
        self.env = Environment(
            root=self.temp_root,
            db_path=self.db_path,
            schema_path=CMOS_ROOT / "db" / "schema.sql",
        )
        self.mission_id = "R-TEST"
        self.output_path = self.temp_root / "reports" / f"{self.mission_id}.md"
        self._seed_completed_mission()

    def tearDown(self) -> None:  # pragma: no cover - cleanup helper
        self.temp_dir.cleanup()

    def _seed_completed_mission(self) -> None:
        metadata = {
            "metadata": {
                "description": "Research export workflow demo",
                "successCriteria": ["Workflow documented"],
                "deliverables": ["Sample research report"],
                "researchQuestions": ["How do we archive research outputs?"]
            },
            "started_at": "2025-11-01T00:00:00Z",
            "completed_at": "2025-11-01T01:00:00Z"
        }
        events = [
            {
                "ts": "2025-11-01T00:05:00Z",
                "agent": "tester",
                "mission": self.mission_id,
                "action": "start",
                "status": "in_progress",
                "summary": "Kicking off research",
                "next_hint": None,
            },
            {
                "ts": "2025-11-01T00:55:00Z",
                "agent": "tester",
                "mission": self.mission_id,
                "action": "complete",
                "status": "completed",
                "summary": "Findings ready",
                "next_hint": "Proceed to build",
            },
        ]

        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("DELETE FROM session_events WHERE mission = ?", (self.mission_id,))
            conn.execute("DELETE FROM missions WHERE id = ?", (self.mission_id,))
            conn.execute(
                """
                INSERT INTO missions (id, sprint_id, name, status, completed_at, notes, metadata)
                VALUES (?, 'Sprint 03', ?, 'Completed', ?, ?, ?)
                """,
                (
                    self.mission_id,
                    "Research Export Workflow",
                    "2025-11-01T01:00:00Z",
                    "Key findings captured in test",
                    json.dumps(metadata, ensure_ascii=False),
                ),
            )
            for event in events:
                conn.execute(
                    """
                    INSERT INTO session_events (ts, agent, mission, action, status, summary, next_hint, raw_event)
                    VALUES (:ts, :agent, :mission, :action, :status, :summary, :next_hint, :raw_event)
                    """,
                    {**event, "raw_event": json.dumps(event, ensure_ascii=False)},
                )
            conn.commit()
        finally:
            conn.close()

    def test_research_export_generates_markdown_report(self) -> None:
        args = argparse.Namespace(
            mission_id=self.mission_id,
            output=self.output_path,
            overwrite=False,
            allow_incomplete=False,
        )

        _research_export(self.env, args)

        self.assertTrue(self.output_path.exists(), "Research report was not created")
        contents = self.output_path.read_text(encoding="utf-8")
        self.assertIn(f"Research Report: {self.mission_id}", contents)
        self.assertIn("Research export workflow demo", contents)
        self.assertIn("Workflow documented", contents)
        self.assertIn("Findings ready", contents)
        self.assertIn("Metadata Snapshot", contents)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
