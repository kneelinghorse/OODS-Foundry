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

```bash
# Start planning session
./cmos/cli.py session start --type planning --title "Sprint 17 planning" --sprint "Sprint 17"

# Capture decisions during planning
./cmos/cli.py session capture decision "Focus on API performance optimization"
./cmos/cli.py session capture constraint "Must maintain backward compatibility"
./cmos/cli.py session capture next-step "Profile current API endpoints"

# Complete with summary
./cmos/cli.py session complete --summary "Sprint 17 planned: 6 missions for API optimization"
```

### Agent Onboarding

```bash
# Check current state
./cmos/cli.py session onboard

# Start onboarding
./cmos/cli.py session start --type onboarding --title "Onboarding for feature X"

# Capture context
./cmos/cli.py session capture context "Feature X requires real-time updates"
./cmos/cli.py session capture decision "Use WebSockets for real-time"

# Complete with handoff
./cmos/cli.py session complete --summary "Onboarded to Feature X implementation" \
  --next-steps "Review WebSocket library options" \
  --next-steps "Design message protocol"
```

### Weekly Review

```bash
# Start review
./cmos/cli.py session start --type review --title "Week 47 review"

# Capture learnings
./cmos/cli.py session capture learning "CI/CD pipeline needs optimization"
./cmos/cli.py session capture learning "Team velocity improved with pair programming"

# Complete
./cmos/cli.py session complete --summary "Week 47: Good progress, CI/CD needs work"
```

## Onboarding Session Template

See `templates/session-onboarding-template.md` for a checklist covering prerequisites, capture prompts, and completion steps.

## Troubleshooting

| Scenario | Resolution |
| --- | --- |
| Attempting to start while another session is active | CLI will show the active session ID; resume or complete it first |
| Invalid capture category | Use one of: decision, learning, constraint, context, next-step |
| Long or empty content | Trim input; `session_runtime` enforces 1–1000 char body |
| Missing session ID for capture/complete | Either pass `--session PS-YYYY-MM-DD-###` or ensure an active session exists |

Use `./cmos/cli.py session list` and `./cmos/cli.py session show <ID>` to inspect results at any time.
