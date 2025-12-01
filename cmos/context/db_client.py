#!/usr/bin/env python3
"""Shared SQLite client for CMOS runtime operations.

This module centralises connection handling, schema application, and common
query helpers so that mission lifecycle code, seeding scripts, and validation
utilities can operate against the canonical database consistently.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple


class SQLiteClientError(RuntimeError):
    """Base exception for SQLite client failures."""


class DatabaseUnavailable(SQLiteClientError):
    """Raised when the database cannot be opened or initialised."""


def _dict_factory(cursor: sqlite3.Cursor, row: Tuple[Any, ...]) -> Dict[str, Any]:
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description or [])}


@dataclass(frozen=True)
class HealthStatus:
    ok: bool
    message: str
    details: Optional[Dict[str, Any]] = None


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _canonical_json(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class SQLiteClient:
    """Thin wrapper around sqlite3 for consistent CMOS access."""

    def __init__(
        self,
        db_path: Path | str,
        *,
        schema_path: Path | str | None = None,
        timeout: float = 5.0,
        create_missing: bool = True
    ) -> None:
        self.db_path = Path(db_path)
        self.schema_path = Path(schema_path) if schema_path else None
        self.timeout = timeout
        self.create_missing = create_missing
        self._connection: Optional[sqlite3.Connection] = None

    @property
    def connection(self) -> sqlite3.Connection:
        if self._connection is None:
            if not self.db_path.exists():
                if not self.create_missing:
                    raise DatabaseUnavailable(f"Database does not exist: {self.db_path}")
                self.db_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                self._connection = sqlite3.connect(
                    str(self.db_path),
                    timeout=self.timeout,
                    detect_types=sqlite3.PARSE_DECLTYPES,
                    isolation_level=None,
                )
            except sqlite3.Error as error:
                raise DatabaseUnavailable(f"Unable to open database {self.db_path}") from error

            self._connection.row_factory = _dict_factory
            try:
                self._connection.execute("PRAGMA foreign_keys = ON;")
            except sqlite3.Error as error:
                raise SQLiteClientError(f"Failed to enable foreign keys: {error}") from error

            if self.schema_path:
                self.apply_schema()
        return self._connection

    def apply_schema(self) -> None:
        if not self.schema_path:
            return
        if not self.schema_path.exists():
            raise SQLiteClientError(f"Schema file not found: {self.schema_path}")
        sql = self.schema_path.read_text(encoding="utf-8")
        try:
            self.connection.executescript(sql)
        except sqlite3.Error as error:
            raise SQLiteClientError(f"Failed to apply schema: {error}") from error

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        conn = self.connection
        try:
            conn.execute("BEGIN;")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def execute(self, sql: str, parameters: Dict[str, Any] | Tuple[Any, ...] | None = None) -> None:
        try:
            if parameters is None:
                self.connection.execute(sql)
            else:
                self.connection.execute(sql, parameters)
        except sqlite3.Error as error:
            raise SQLiteClientError(str(error)) from error

    def executemany(self, sql: str, parameters: Iterable[Dict[str, Any] | Tuple[Any, ...]]) -> None:
        try:
            self.connection.executemany(sql, parameters)
        except sqlite3.Error as error:
            raise SQLiteClientError(str(error)) from error

    def fetchone(
        self,
        sql: str,
        parameters: Dict[str, Any] | Tuple[Any, ...] | None = None
    ) -> Optional[Dict[str, Any]]:
        try:
            cursor = self.connection.execute(sql, parameters or ())
            return cursor.fetchone()
        except sqlite3.Error as error:
            raise SQLiteClientError(str(error)) from error

    def fetchall(
        self,
        sql: str,
        parameters: Dict[str, Any] | Tuple[Any, ...] | None = None
    ) -> List[Dict[str, Any]]:
        try:
            cursor = self.connection.execute(sql, parameters or ())
            rows = cursor.fetchall()
            return rows or []
        except sqlite3.Error as error:
            raise SQLiteClientError(str(error)) from error

    def health_check(self) -> HealthStatus:
        try:
            row = self.fetchone("SELECT 1 AS ok;")
            if row and row.get("ok") == 1:
                return HealthStatus(True, "database_available")
        except SQLiteClientError as error:
            return HealthStatus(False, "query_failed", {"error": str(error)})
        return HealthStatus(False, "unexpected_health_response", {"row": row})

    def get_context(self, context_id: str) -> Optional[Dict[str, Any]]:
        """Return the JSON payload for a context record."""
        row = self.fetchone(
            "SELECT content FROM contexts WHERE id = :id",
            {"id": context_id}
        )
        if not row:
            return None
        try:
            return json.loads(row["content"])
        except json.JSONDecodeError as error:
            raise SQLiteClientError(f"Context {context_id} contains invalid JSON") from error

    def add_context_snapshot(
        self,
        context_id: str,
        payload: Dict[str, Any],
        *,
        session_id: str | None = None,
        source: str | None = None,
        created_at: str | None = None
    ) -> int | None:
        """Add a context snapshot. Returns snapshot ID if created, None if duplicate."""
        canonical = _canonical_json(payload)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        last = self.fetchone(
            "SELECT content_hash FROM context_snapshots WHERE context_id = :id ORDER BY created_at DESC LIMIT 1",
            {"id": context_id}
        )
        if last and last.get("content_hash") == digest:
            return None
        pretty = json.dumps(payload, ensure_ascii=False, indent=2)
        timestamp = created_at or _utc_now()
        self.execute(
            """
            INSERT INTO context_snapshots (context_id, session_id, source, content_hash, content, created_at)
            VALUES (:context_id, :session_id, :source, :content_hash, :content, :created_at)
            """,
            {
                "context_id": context_id,
                "session_id": session_id,
                "source": source or "",
                "content_hash": digest,
                "content": pretty,
                "created_at": timestamp,
            }
        )
        # Return the new snapshot ID
        result = self.fetchone("SELECT last_insert_rowid() as id")
        return result["id"] if result else None

    def _sync_strategic_decisions(
        self,
        master_context: Dict[str, Any],
        snapshot_id: int | None,
        timestamp: str
    ) -> None:
        """Sync decisions from MASTER_CONTEXT to strategic_decisions table."""
        decisions = []

        general_decisions = master_context.get("decisions_made") or []
        if isinstance(general_decisions, list):
            for decision_text in general_decisions:
                if isinstance(decision_text, str):
                    cleaned = decision_text.strip()
                    if cleaned:
                        decisions.append(
                            {
                                "decision_text": cleaned,
                                "project_domain": "general",
                            }
                        )

        domains = master_context.get("working_memory", {}).get("domains", {})
        if isinstance(domains, dict):
            for domain_name, domain_data in domains.items():
                if not isinstance(domain_data, dict):
                    continue
                domain_decisions = domain_data.get("decisions_made", [])
                if not isinstance(domain_decisions, list):
                    continue
                for decision_text in domain_decisions:
                    if isinstance(decision_text, str):
                        cleaned = decision_text.strip()
                        if cleaned:
                            decisions.append(
                                {
                                    "decision_text": cleaned,
                                    "project_domain": domain_name,
                                }
                            )

        if not decisions:
            return

        existing = self.fetchall(
            "SELECT decision_text FROM strategic_decisions WHERE context_id = 'master_context'"
        )
        existing_texts = {(row["decision_text"] or "").strip() for row in existing}

        new_decisions = [d for d in decisions if d["decision_text"] not in existing_texts]

        if new_decisions:
            self.executemany(
                """
                INSERT INTO strategic_decisions (
                    context_id, decision_text, created_at, snapshot_id, project_domain
                ) VALUES ('master_context', :decision_text, :created_at, :snapshot_id, :project_domain)
                """,
                [
                    {
                        "decision_text": d["decision_text"],
                        "created_at": timestamp,
                        "snapshot_id": snapshot_id,
                        "project_domain": d.get("project_domain"),
                    }
                    for d in new_decisions
                ]
            )

    def set_context(
        self,
        context_id: str,
        payload: Dict[str, Any],
        *,
        source_path: str | None = None,
        session_id: str | None = None,
        snapshot: bool = True,
        snapshot_source: str | None = None
    ) -> None:
        """Persist a JSON payload to the contexts table and stamp updated_at."""
        existing = self.fetchone(
            "SELECT source_path FROM contexts WHERE id = :id",
            {"id": context_id}
        )
        resolved_source = (
            source_path
            if source_path is not None
            else (existing.get("source_path") if existing else "")
        )
        content = json.dumps(payload, ensure_ascii=False, indent=2)
        timestamp = _utc_now()
        
        # Use UPDATE if exists, INSERT if new (avoids CASCADE DELETE)
        if existing:
            self.execute(
                """
                UPDATE contexts 
                SET source_path = :source_path, content = :content, updated_at = :updated_at
                WHERE id = :id
                """,
                {
                    "id": context_id,
                    "source_path": resolved_source,
                    "content": content,
                    "updated_at": timestamp,
                },
            )
        else:
            self.execute(
                """
                INSERT INTO contexts (id, source_path, content, updated_at)
                VALUES (:id, :source_path, :content, :updated_at)
                """,
                {
                    "id": context_id,
                    "source_path": resolved_source,
                    "content": content,
                    "updated_at": timestamp,
                },
            )
        if snapshot:
            snapshot_id = self.add_context_snapshot(
                context_id,
                payload,
                session_id=session_id,
                source=snapshot_source or resolved_source,
                created_at=timestamp,
            )
            # Sync strategic decisions if this is master_context
            if context_id == "master_context":
                self._sync_strategic_decisions(payload, snapshot_id, timestamp)


def _run_cli(args: argparse.Namespace) -> int:
    client = SQLiteClient(
        args.database,
        schema_path=args.schema,
        create_missing=not args.read_only
    )
    try:
        if args.command == "ping":
            status = client.health_check()
            print(json.dumps({"ok": status.ok, "message": status.message, "details": status.details}, indent=2))
            return 0 if status.ok else 1
        if args.command == "query":
            rows = client.fetchall(args.sql, json.loads(args.parameters) if args.parameters else None)
            print(json.dumps(rows, indent=2, ensure_ascii=False))
            return 0
        if args.command == "exec":
            payload = json.loads(args.parameters) if args.parameters else None
            if isinstance(payload, list):
                client.executemany(args.sql, payload)
            else:
                client.execute(args.sql, payload)
            return 0
    finally:
        client.close()
    return 0


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SQLite client utility for CMOS runtime.")
    parser.add_argument("command", choices=("ping", "query", "exec"), help="Command to execute.")
    parser.add_argument("--database", "-d", required=True, help="Path to the SQLite database file.")
    parser.add_argument("--schema", "-s", help="Optional schema file to apply before executing commands.")
    parser.add_argument("--sql", help="SQL statement for query/exec commands.")
    parser.add_argument("--parameters", help="JSON encoded parameters for SQL execution.")
    parser.add_argument("--read-only", action="store_true", help="Do not create the database if missing.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    exit(_run_cli(_parse_args()))
