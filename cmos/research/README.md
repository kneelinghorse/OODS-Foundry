# Research Reports Directory

This folder stores immutable artifacts generated from completed research missions.

Workflow:

1. Complete the mission using the normal runtime commands (start ➝ execute ➝ complete).
2. Run `./cmos/cli.py research export <mission-id>` to render a Markdown report at `cmos/research/<mission-id>.md`.
3. Review and commit the generated report as the durable research output. The mission itself stays tracked in SQLite.

Use `--output` to place the file elsewhere or `--overwrite` to regenerate an existing report intentionally. Only the exported Markdown should be checked into version control—mission state continues to live exclusively in the database.
