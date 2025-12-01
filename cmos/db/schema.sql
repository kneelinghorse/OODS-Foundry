-- CMOS SQLite Schema Prototype
-- Generated for mission B3.1 to mirror core backlog, context, telemetry, and session data.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  focus TEXT,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  total_missions INTEGER,
  completed_missions INTEGER
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  notes TEXT,
  
  -- Full mission specification fields
  objective TEXT,
  context TEXT,
  success_criteria TEXT,  -- JSON array
  deliverables TEXT,      -- JSON array
  reference_docs TEXT,    -- JSON array (renamed from 'references' to avoid SQL keyword)
  domain_fields TEXT,     -- Full JSON of domainFields section
  
  -- Legacy metadata field (for backward compatibility)
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS mission_dependencies (
  from_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id)
);

CREATE TABLE IF NOT EXISTS contexts (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS context_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_id TEXT NOT NULL,
  session_id TEXT,
  source TEXT,
  content_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_ctx ON context_snapshots (context_id, created_at);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_hash ON context_snapshots (context_id, content_hash);

CREATE TABLE IF NOT EXISTS session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  agent TEXT,
  mission TEXT,
  action TEXT,
  status TEXT,
  summary TEXT,
  next_hint TEXT,
  raw_event TEXT NOT NULL
);

-- Universal session registry for planning/onboarding/review/history
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                          -- e.g., PS-2024-11-13-001
  type TEXT NOT NULL,                           -- onboarding, planning, review, etc.
  title TEXT NOT NULL,
  sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  agent TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL,                         -- active, completed, canceled
  captures TEXT,                                -- JSON array of captured insights
  next_steps TEXT,                              -- JSON array for handoff actions
  metadata TEXT                                 -- Flexible JSON blob
);

CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions (type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_sprint ON sessions (sprint_id);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission TEXT,
  source_path TEXT NOT NULL,
  ts TEXT,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  behavior TEXT NOT NULL
);

-- Strategic decisions index for queryable project memory
-- Keeps decisions from MASTER_CONTEXT searchable without parsing JSON
CREATE TABLE IF NOT EXISTS strategic_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_id TEXT NOT NULL DEFAULT 'master_context',
  decision_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sprint_id TEXT,
  snapshot_id INTEGER,
  project_domain TEXT,  -- e.g., 'ai-studio', allows multi-project support
  FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
  FOREIGN KEY (snapshot_id) REFERENCES context_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_strategic_decisions_created ON strategic_decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategic_decisions_sprint ON strategic_decisions (sprint_id);
CREATE INDEX IF NOT EXISTS idx_strategic_decisions_domain ON strategic_decisions (project_domain);

CREATE VIEW IF NOT EXISTS active_missions AS
SELECT m.id,
       m.name,
       m.status,
       m.completed_at,
       m.notes,
       s.id AS sprint_id,
       s.title AS sprint_title
  FROM missions m
  LEFT JOIN sprints s ON s.id = m.sprint_id
 WHERE m.status IN ('Current', 'In Progress');

-- Mission detail view for easy inspection
CREATE VIEW IF NOT EXISTS mission_details AS
SELECT m.id,
       m.name,
       m.status,
       s.id AS sprint_id,
       s.title AS sprint_title,
       m.objective,
       m.context,
       m.success_criteria,
       m.deliverables,
       m.reference_docs,
       m.domain_fields,
       m.completed_at,
       m.notes
  FROM missions m
  LEFT JOIN sprints s ON s.id = m.sprint_id;

-- Sprint summary view for retrospectives and analysis
CREATE VIEW IF NOT EXISTS sprint_summary AS
SELECT 
  s.id AS sprint_id,
  s.title,
  s.status,
  s.focus,
  s.start_date,
  s.end_date,
  COUNT(m.id) AS total_missions,
  COUNT(CASE WHEN m.status = 'Completed' THEN 1 END) AS completed_missions,
  COUNT(CASE WHEN m.status = 'Blocked' THEN 1 END) AS blocked_missions,
  COUNT(CASE WHEN m.status IN ('Current', 'In Progress') THEN 1 END) AS active_missions,
  (
    SELECT COUNT(DISTINCT sd.id)
    FROM strategic_decisions sd
    WHERE sd.sprint_id = s.id
  ) AS decisions_count
FROM sprints s
LEFT JOIN missions m ON m.sprint_id = s.id
GROUP BY s.id, s.title, s.status, s.focus, s.start_date, s.end_date;
