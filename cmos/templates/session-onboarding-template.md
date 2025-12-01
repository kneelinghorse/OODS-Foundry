# Onboarding Session Template

## Prerequisites
- [ ] Run: `./cmos/cli.py session onboard`
- [ ] Review output and note blockers, recent sessions, and active missions

## Session Start
```bash
./cmos/cli.py session start --type onboarding --title "Onboarding for [TASK]"
```

## Context to Capture
- [ ] Current sprint and focus
- [ ] Relevant decisions from recent sessions
- [ ] Active constraints or risks
- [ ] Immediate next planned work

## Suggested Captures
```bash
./cmos/cli.py session capture context "Key context item"
./cmos/cli.py session capture decision "Important decision"
./cmos/cli.py session capture constraint "Known constraint"
./cmos/cli.py session capture next-step "Immediate action"
```

## Session Completion
```bash
./cmos/cli.py session complete --summary "[AGENT] onboarded to [TASK]" \
  --next-steps "First action item" \
  --next-steps "Second action item"
```

Store the completed session ID in your handoff doc so the next agent can replay it with `./cmos/cli.py session show <ID>`.
