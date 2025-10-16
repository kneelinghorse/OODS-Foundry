# Storybook Agent Panel Components

This note captures the current contract and behavioural guarantees for the reusable components that render plan previews inside the Storybook agent panel.

---

## DiffViewer

- **Purpose:** render plan diffs with fast navigation, folding, and semantic JSON inspection.
- **Modes:** Unified (default), Split, JSON.
  - JSON mode activates when the diff payload includes `structured: { type: "json" }` data. The viewer compares objects and arrays semantically (key-sorted, whitespace-insensitive) and highlights additions, removals, and value edits.
- **Virtualisation:** only the visible slice of lines is mounted, keeping rendering cost stable for large diffs. Each context block larger than six lines is collapsed by default; users can show or hide the block with a keyboard-accessible toggle (`aria-expanded` is emitted).
- **Accessibility:**
  - Headings and toggle group announce the current mode.
  - Diff regions expose `aria-label`s that describe the active view and file path.
  - JSON rows use monospace output with indentation expressed through padding so screen readers can follow hierarchy.
- **Styling hooks:** `.agent-panel__diff-*` classes live in `apps/explorer/addons/storybook-addon-agent/styles/panel.css` for white-label adjustments.

## ArtifactList

- **Purpose:** list run artifacts, transcripts, and diagnostics with copy/open affordances.
- **Virtualised table body:** larger-than-12 lists stream through a windowed body while preserving semantic `<table>` markup. Spacer rows maintain scrollbar geometry without confusing assistive tech.
- **Columns:** Artifact (row header + link), Purpose, Size, SHA-256 (short hash + “Copy” button), Open (explicit new-tab action).
- **Copy affordance:** `Copy` writes the full SHA to the clipboard (native API with `execCommand` fallback) and confirms success via a screen-reader-only status line. Hash buttons disable automatically when the checksum is missing.
- **Security reminder:** a short confidentiality hint follows the table to reinforce safe handling of generated data.
- **Styling hooks:** `.agent-panel__artifact-*` classes co-located with the diff styles.

## Integration Notes

1. Import `./styles/panel.css` alongside `panel.tsx` to enable the shared tokens for both components.
2. Provide structured JSON diffs when available to unlock semantic mode:
   ```ts
   const diff: PlanDiff = {
     path: 'config/state.json',
     status: 'modified',
     hunks,
     structured: {
       type: 'json',
       before: previousConfig,
       after: nextConfig,
     },
   };
   ```
3. Artifact detail objects can omit `sha256` or `sizeBytes`; the UI will downgrade gracefully to muted placeholders.
