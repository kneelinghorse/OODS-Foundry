# Session Management Guide

Sessions capture planning, onboarding, research, and review activities that fall outside mission-oriented build work. Each session writes directly to SQLite, snapshots the project context, and produces a durable transcript that future agents can replay.

## Session Types

| Type | Use Case |
| --- | --- |
| onboarding | Ramp up a new agent or hand off a feature |
| planning | Sprint, roadmap, or architecture planning |
| review | Weekly reviews, retrospectives, or post-mission evaluations |
| research | Exploratory spikes, benchmarking, or investigations |
| check-in | Quick syncs to capture status and blockers |
| custom | Any structured collaboration that needs a permanent record |

All types share the same lifecycle: start → capture → complete.

## Basic Workflow

### Using MCP (Recommended for AI Agents)

```
# 1. Start a session
cmos_session_start(
  type="planning",
  title="Sprint 17 planning",
  sprintId="sprint-17"
)

# 2. Capture insights (repeat as needed)
cmos_session_capture(category="decision", content="Focus on API performance")
cmos_session_capture(category="constraint", content="Must maintain backward compatibility")
cmos_session_capture(category="next-step", content="Profile current latency")

# 3. Complete the session
cmos_session_complete(
  summary="Sprint 17 scoped and prioritized",
  nextSteps=["Finalize API metrics", "Update backlog with perf missions"]
)
```

### Using CLI (For Human Operators)

```bash
# 1. Start a session
./cmos/cli.py session start --type planning --title "Sprint 17 planning" --sprint "Sprint 17"

# 2. Capture insights (repeat as needed)
./cmos/cli.py session capture decision "Focus on API performance"
./cmos/cli.py session capture constraint "Must maintain backward compatibility"
./cmos/cli.py session capture next-step "Profile current latency"

# 3. Complete the session
./cmos/cli.py session complete --summary "Sprint 17 scoped and prioritized" \
  --next-steps "Finalize API metrics" \
  --next-steps "Update backlog with perf missions"
```

Tips:
- Keep captures concise (<1000 chars) so runtime validation passes.
- Use next steps to seed future missions, then review them via `project_context.working_memory.next_steps`.
- If you leave a session open for >24h, the CLI will prompt you to resume or complete before starting a new one.

## Worked Examples

### Sprint Planning

**MCP:**
```
cmos_session_start(type="planning", title="Sprint 17 planning", sprintId="sprint-17")

cmos_session_capture(category="decision", content="Focus on API performance optimization")
cmos_session_capture(category="constraint", content="Must maintain backward compatibility")
cmos_session_capture(category="next-step", content="Profile current API endpoints")

cmos_session_complete(summary="Sprint 17 planned: 6 missions for API optimization")
```

**CLI:**
```bash
./cmos/cli.py session start --type planning --title "Sprint 17 planning" --sprint "Sprint 17"
./cmos/cli.py session capture decision "Focus on API performance optimization"
./cmos/cli.py session capture constraint "Must maintain backward compatibility"
./cmos/cli.py session capture next-step "Profile current API endpoints"
./cmos/cli.py session complete --summary "Sprint 17 planned: 6 missions for API optimization"
```

### Agent Onboarding

**MCP:**
```
# Get quick context (recommended first step)
cmos_agent_onboard()

# Start formal onboarding session
cmos_session_start(type="onboarding", title="Onboarding for feature X")

cmos_session_capture(category="context", content="Feature X requires real-time updates")
cmos_session_capture(category="decision", content="Use WebSockets for real-time")

cmos_session_complete(
  summary="Onboarded to Feature X implementation",
  nextSteps=["Review WebSocket library options", "Design message protocol"]
)
```

**CLI:**
```bash
./cmos/cli.py session onboard
./cmos/cli.py session start --type onboarding --title "Onboarding for feature X"
./cmos/cli.py session capture context "Feature X requires real-time updates"
./cmos/cli.py session capture decision "Use WebSockets for real-time"
./cmos/cli.py session complete --summary "Onboarded to Feature X implementation" \
  --next-steps "Review WebSocket library options" \
  --next-steps "Design message protocol"
```

### Weekly Review

**MCP:**
```
cmos_session_start(type="review", title="Week 47 review")

cmos_session_capture(category="learning", content="CI/CD pipeline needs optimization")
cmos_session_capture(category="learning", content="Team velocity improved with pair programming")

cmos_session_complete(summary="Week 47: Good progress, CI/CD needs work")
```

**CLI:**
```bash
./cmos/cli.py session start --type review --title "Week 47 review"
./cmos/cli.py session capture learning "CI/CD pipeline needs optimization"
./cmos/cli.py session capture learning "Team velocity improved with pair programming"
./cmos/cli.py session complete --summary "Week 47: Good progress, CI/CD needs work"
```

## Onboarding Session Template

See `templates/session-onboarding-template.md` for a checklist covering prerequisites, capture prompts, and completion steps.

## Troubleshooting

| Scenario | Resolution |
| --- | --- |
| Attempting to start while another session is active | Check `cmos_session_list(status="active")` or CLI; complete the active session first |
| Invalid capture category | Use one of: decision, learning, constraint, context, next-step |
| Long or empty content | Trim input; enforces 1–1000 char body |
| Missing session ID for capture/complete | MCP uses active session automatically; CLI requires `--session PS-YYYY-MM-DD-###` or active session |

**Inspect sessions:**
- MCP: `cmos_session_list()`
- CLI: `./cmos/cli.py session list` and `./cmos/cli.py session show <ID>`

---

**Last Updated**: 2025-12-10
**CMOS Version**: 2.1 (MCP-enabled)
**See Also**: `cmos/docs/mcp-reference.md` for complete MCP tool documentation
