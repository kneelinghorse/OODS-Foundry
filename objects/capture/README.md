# Capture objects

Five alpha objects hold what a capture run records. **Run**, **Finding** and **CapturedArtifact** were born from a
direct read of real runs and landed with the screen that needed them. **Comparison** holds one read-only derived
drift analysis, and **ComparisonSignal** one recorded drift signal with its live and design comparands.

The authoritative shape is the capture tool's run output, read from disk: run `6e435ce7` (designsystem.digital.gov,
2026-09-17) for the fields, and every app-mode run on disk with an `a11y_report` at 2.2.0 for Run's sample
records. Every field's `examples` are one real record per index. Four of Run's six sample runs captured private
products, so their target names, URLs and record ids are neutral stand-ins (`app.example.com`); the two public runs
keep their real values. Each sample's provenance source reads `Capture tool`.

At runtime OODS Foundry reads a run only through `structuredData.fetch`'s admitted run-view kinds (`design.preview`
`runPath`); it never calls the capture tool and writes nothing into a run.

## Naming

The capture tool calls its attested files "evidence". The registry keys objects by name and keeps the first file it
finds for a name, and `Evidence` is the research domain's (`research.data`), so a second `Evidence` would silently lose.
This object is named for what its records are — a file the run wrote under the manifest's sha256 attestation —
`CapturedArtifact`.

## Traits

`core/Assessable` (result state — its own visual family, never red, green or scored) and `core/Provenanced` (source,
record, locator, method, time) were authored for these screens. Every Finding on run 6e435ce7 is a `violation`:
the capture writes axe's needs-review, passing and not-applicable answers only as page counts.

These objects hold records OODS Foundry only reads, so they are **read-only**: `metadata.supportedContexts` lists
`card, detail, inline, list, timeline`, so they compose no form and no workflow, their detail offers no Edit or
Delete, and a request for either is refused with the context named (`OODS-V003`). Standalone previews still show
their real records: the seed comes from the list composition instead of a workflow.
