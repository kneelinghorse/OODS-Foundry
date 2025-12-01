-- CMOS Database Query Helpers
-- Useful SQL snippets for exploring project history

-- ============================================================================
-- STRATEGIC DECISIONS
-- ============================================================================

-- View all strategic decisions chronologically
SELECT 
  id,
  created_at,
  decision_text,
  sprint_id
FROM strategic_decisions
ORDER BY created_at;

-- Recent decisions (last 10)
SELECT 
  id,
  created_at,
  decision_text
FROM strategic_decisions
ORDER BY created_at DESC
LIMIT 10;

-- Decisions by sprint
SELECT 
  sprint_id,
  COUNT(*) as decision_count,
  GROUP_CONCAT(decision_text, ' | ') as decisions
FROM strategic_decisions
WHERE sprint_id IS NOT NULL
GROUP BY sprint_id
ORDER BY sprint_id;

-- Search decisions by keyword
SELECT 
  id,
  created_at,
  decision_text,
  sprint_id
FROM strategic_decisions
WHERE decision_text LIKE '%visualization%'  -- Change keyword
ORDER BY created_at DESC;

-- ============================================================================
-- CONTEXT SNAPSHOTS (Historical Timeline)
-- ============================================================================

-- View all snapshots timeline
SELECT 
  id,
  context_id,
  created_at,
  source,
  session_id
FROM context_snapshots
ORDER BY created_at;

-- Master context evolution
SELECT 
  id,
  created_at,
  source,
  LENGTH(content) as size_bytes
FROM context_snapshots
WHERE context_id = 'master_context'
ORDER BY created_at;

-- Compare two snapshots (decision growth)
-- Replace snapshot IDs as needed
SELECT 
  'Snapshot 7' as snapshot,
  json_array_length(json_extract(content, '$.decisions_made')) as decision_count
FROM context_snapshots WHERE id = 7
UNION ALL
SELECT 
  'Snapshot 49' as snapshot,
  json_array_length(json_extract(content, '$.decisions_made')) as decision_count
FROM context_snapshots WHERE id = 49;

-- ============================================================================
-- SESSIONS
-- ============================================================================

-- Recent sessions
SELECT 
  id,
  type,
  title,
  started_at,
  completed_at,
  status
FROM sessions
ORDER BY started_at DESC
LIMIT 10;

-- Sessions by type
SELECT 
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
FROM sessions
GROUP BY type;

-- Session details with captures
SELECT 
  id,
  title,
  started_at,
  json_array_length(captures) as capture_count,
  json_array_length(next_steps) as next_step_count,
  summary
FROM sessions
WHERE id = 'PS-2025-11-13-001';  -- Change session ID

-- ============================================================================
-- SPRINT PROGRESS
-- ============================================================================

-- Sprint overview with decisions
SELECT * FROM sprint_summary ORDER BY sprint_id;

-- Sprint 20 detailed status
SELECT 
  s.id as sprint_id,
  s.title,
  s.status,
  m.id as mission_id,
  m.name,
  m.status as mission_status,
  m.completed_at
FROM sprints s
LEFT JOIN missions m ON m.sprint_id = s.id
WHERE s.id = 'Sprint 20'
ORDER BY m.id;

-- Decisions made during Sprint 20
SELECT 
  id,
  created_at,
  decision_text
FROM strategic_decisions
WHERE created_at >= '2025-11-13'  -- Sprint 20 start date
ORDER BY created_at;

-- ============================================================================
-- MISSION TRACKING
-- ============================================================================

-- Current mission with full details
SELECT * FROM mission_details WHERE status = 'Current';

-- Mission completion history
SELECT 
  m.id,
  m.name,
  m.completed_at,
  s.title as sprint
FROM missions m
LEFT JOIN sprints s ON s.id = m.sprint_id
WHERE m.status = 'Completed'
ORDER BY m.completed_at DESC
LIMIT 20;

-- ============================================================================
-- SESSION EVENTS (Mission Operations Log)
-- ============================================================================

-- Recent mission operations
SELECT 
  ts,
  mission,
  action,
  status,
  summary,
  next_hint
FROM session_events
ORDER BY ts DESC
LIMIT 20;

-- Mission operation history for specific mission
SELECT 
  ts,
  action,
  status,
  summary,
  agent
FROM session_events
WHERE mission = 'B20.1'  -- Change mission ID
ORDER BY ts;

-- ============================================================================
-- HEALTH CHECKS
-- ============================================================================

-- Table row counts
SELECT 
  'sprints' as table_name, COUNT(*) as rows FROM sprints
UNION ALL SELECT 'missions', COUNT(*) FROM missions
UNION ALL SELECT 'missions (Completed)', COUNT(*) FROM missions WHERE status = 'Completed'
UNION ALL SELECT 'missions (Active)', COUNT(*) FROM missions WHERE status IN ('Current', 'In Progress')
UNION ALL SELECT 'context_snapshots', COUNT(*) FROM context_snapshots
UNION ALL SELECT 'strategic_decisions', COUNT(*) FROM strategic_decisions
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'session_events', COUNT(*) FROM session_events;

-- Database size
SELECT 
  page_count * page_size / 1024.0 / 1024.0 as size_mb
FROM pragma_page_count(), pragma_page_size();

