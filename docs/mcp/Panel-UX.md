# Storybook Agent Panel — Approval Flow

## State Machine

| State | Description | Transitions |
| --- | --- | --- |
| `idle` | Default state after load or after changing tools. | → `planning` |
| `planning` | Bridge `/run` request issued with `apply:false`. Inputs disabled. | → `review` on success, → `error` on failure |
| `review` | Dry-run result available. Diff + artifact preview rendered. | → `planning` (re-run), → `awaiting-approval`, → `idle` (tool change) |
| `awaiting-approval` | Approval dialog visible. Focus trapped on Cancel/Approve. | → `review` on cancel, → `executing` on confirm |
| `executing` | Bridge `/run` request issued with `apply:true`. Inputs disabled. | → `summary` on success, → `error` on failure |
| `summary` | Apply completed. Success banner + applied artifacts table displayed. | → `planning` (new preview), → `idle` (tool change) |
| `error` | Error banner shown with retry/back actions + incident metadata. | → `planning` (retry, dry-run failure), → `executing` (retry, apply failure), → `review`/`idle` (back) |

## Task Runner & Queue

- **Statuses:** each queued run progresses through `Queued` → `WaitingApproval` → `Running` → `Done`, with `Denied` available for human stop-requests. `planInFlight` and `applyInFlight` overlay the status badge while the bridge call is active.
- **Queue item contract:** the list persists `tool`, canonicalised inputs, ISO `createdAt`, most recent `incidentId`, optional `deniedReason`, and telemetry link (`diagnosticsPath` → bridge `artifactHref`). Selecting an item hydrates the form with the recorded inputs.
- **Keyboard/Screen reader affordances:** queue buttons behave like radio tabs; focus returns to the invoking control, `aria-live` announces selection changes, and badges describe the visible status text.
- **Incident linking:** the active task status pillar shows the latest incident ID for plan/apply and the shared `correlationId`. When diagnostics are exposed the badge links directly to telemetry JSON; otherwise a `<code>` fallback prints the identifiers.

## Interaction Flow

1. **Queue task** — captures the current tool/input state into the task list. Newly queued work defaults to `Queued` and selection snaps to the new item.
2. **Preview selected task** — user triggers a dry run (`apply:false`). Panel announces “Plan ready.” and presents:
   - Diff viewer (Unified default, Split toggle).
   - Artifact table (transcript, bundle index, diagnostics, preview artifacts).
3. **Approve & Apply…** — opens blocking dialog (`Cancel` receives initial focus; Escape closes). Copy:
   - Title: “Approve & Apply changes?”
   - Body: “You are about to write new artifacts to `/artifacts/current-state/YYYY-MM-DD`. This action requires approval.”
   - Primary: “Approve & Apply” (Enter submits), Secondary: “Cancel”.
4. **Deny task** — optional exit that stamps the queue item as `Denied` and records an operator-supplied reason. No bridge calls occur; transcripts remain read-only.
5. **Execute** — confirmation sends { `apply:true` }. Panel announces “Applying approved changes now.” while controls are disabled.
6. **Summary** — success banner “Changes Applied” plus applied artifacts table. Denied tasks surface a `Task Denied` banner with the recorded reason and no artifact list. Panel announces “Run complete. Artifacts available.” or “Task denied.” accordingly.
7. **Errors** — failure banner “Apply Failed” includes error code and optional `Incident ID`. Buttons: `Retry`, `Back`. Screen reader announcement: “Run failed. See error details.”

## Accessibility Contracts

- `aria-live="polite"` status region relays: plan ready, apply start, apply complete, error.
- Diff viewer container focuses when entering `review`; dialog traps focus (Tab/Shift+Tab) and respects Escape.
- Focus order in `review`: Preview button → Diff viewer → Artifact table → Approve button.
- Error heading receives programmatic focus (`tabIndex=-1`) on entry.

## Outputs & Logging

- Dry-run and apply responses store transcript and bundle index paths; panel table links via bridge `/artifacts/*`.
- `planInputRef` ensures the `apply:true` request reuses reviewed inputs.
- Queue metadata forwards `incidentId`/`diagnosticsPath` for downstream telemetry aggregation and feeds `diagnostics.json` (`panel` block) with `{ tasksRun, approvals, denied }` counters per mission.
- SR announcements mirror CLI copy deck to keep CLI/Panel transcripts aligned.
