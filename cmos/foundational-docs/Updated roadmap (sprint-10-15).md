Updated roadmap (next 5 sprints)
Sprint 07 (in flight) — Hardening pass

Focus: motion tokens v1, Form/Timeline density defaults, HC snapshots (Playwright), expand Dark AA & VRT coverage, diagnostics v7.
Green lights:

Motion tokens present + reduced-motion honored

Contexts.Form/Timeline MDX published

HC PNGs generated for ~10 key stories

VRT ≥25 stories (incl. Dark), ≤120s CI

Dark AA & Δ-guardrails ≥90% pair coverage



Sprint 08 — Components scale-out (states, inputs, forms)

Focus:

Add 6–8 production-grade components (Select, TextArea, Checkbox, Radio, Toggle, Tooltip, Toast, Tabs)

Form patterns v1 (field groups, validation banners, help/error text, required/optional tokens)

Keyboard/Focus contracts (roving tabindex where relevant), a11y stories

VRT coverage to ~40 stories; expand HC snapshot set accordingly
Green lights:

All new components consume --cmp-* only; zero inline color literals

AA green (light/dark/HC) for all form states

Storybook “States” + A11y Contract pages for each component

VRT: ≤150s, flakes <2%




Sprint 09 — Multi-brand theming & package releases

Focus:

Add Brand A theme (tokens only; no component changes) using var-chaining at the theme layer

Publish packages: @oods/tokens, @oods/tw-variants, @oods/a11y-tools (pre-1.0)

Figma flow: branch‐based proposals → token PR template → Chromatic link; add a tiny “review kit” page
Green lights:

Theme switch (data-brand="A") flips palette while keeping AA + guardrails green

npm dist builds reproducible; semver + CHANGELOG per package

Figma ↔ Git loop exercised with one real palette change


-------------INJECTED 4 SPRINTS FOR MCP SERVER



Program plan (4 sprints focused on MCP + agents)
Sprint 10 — Foundations & safety

Outcomes: MCP server v0.1 (local), 6 tools with dry-run; path sandbox; transcripts; Dev-tool client profile; draft tool schemas; artifact emitter.

Hard gates: writes confined to /artifacts/current-state/YYYY-MM-DD; dry-run by default; plan→approve required; transcripts saved; purity unaffected.

Artifacts: docs/mcp/Tool-Specs.md, docs/mcp/Security-Model.md, /artifacts/.../mcp-v0.1-demo.md.




Sprint 11 — Agent harness + Storybook panel

Outcomes: plan/approve UI (terminal + Storybook panel), run reviewKit.create end-to-end; role flags; error/report UX.

Hard gates: Storybook panel can run read-only tools by default; apply writes only after approval; review kit bundle lands in /artifacts/.../.

Artifacts: storybook-addon-agent/, /artifacts/.../review-kit-demo.md.




Sprint 12 — Tooling depth & governance

Outcomes: add brand.apply, release.packVerify, diag.snapshot; add policy engine (allow/deny rules per role); rate-limit/timeouts; redact logs.

Hard gates: package reproducibility verified via MCP; policy denies any non-artifacts writes; audit log index.

Artifacts: docs/mcp/Policy-Rules.md, /artifacts/.../governance-report.json.



Sprint 13 — v1.0 hardening & distribution

Outcomes: remote client profiles (Claude/OpenAI), connection templates, smoke tests; packaging + README; demo script.

Hard gates: connection profiles run the same toolset; latency targets met; install docs work from a clean clone.

Artifacts: packages/mcp-server/, /artifacts/.../v1.0-readiness.md.

Parallel “polish/app demos” can continue as a lightweight track; no coupling to MCP milestones.





RETURN TO FORMER ROADMAP




Sprint 14 — Real app flows demo (integration depth)

Focus:

“Subscriptions & Invoices” mini-app: List → Detail → Form (edit/cancel) → Timeline (events), using our enums & status tokens

Empty/Loading/Error states patterns; skeleton tokens; async focus management

Performance pass: token build <3s, Explorer TTI unchanged, CSS var count budget documented
Green lights:

Demo app hits all contexts/states with tokens only (no ad-hoc styles)

AA + guardrails + HC all green through flows

VRT: 50+ tagged stories, Δ thresholds tuned; demo flows snapshotted



Sprint 15 — Platformization & docs

Focus:

Begin mobile outputs (Swift/Android XML) for foundations + colors + typography only (no components)

Author “Design System Handbook” (short, operator-focused): tokens, contexts, themes, HC policy, VRT policy, Figma loop

Governance: token deprecation policy, approval matrix, PR template refinements
Green lights:

iOS/Android token bundles generated from the same DTCG sources

Handbook published inside repo; contributors can self-serve

First deprecation warning exercised (non-breaking)

Changes vs original roadmap

We’re front-loading robustness (a11y/HC/VRT/guardrails) before heavy component expansion—this keeps later work safe.

Multi-brand theming moved after components scale-out kickoff, but still before the demo-app sprint so we prove abstraction.

Mobile outputs narrowed to foundations only in this cycle; component parity on native is a later track.

Health gates to keep every sprint honest

AA & Δ-guardrails: green in light/dark; HC outline/focus ≥3:1.

Purity: components never read --ref-*/--theme-*; slots only.

HC: required on PR (logic + image snapshots).

VRT: coverage & runtime targets per sprint; animation stabilized.

Build perf: tokens build <3s; diagnostics script updated each sprint.

Docs: each new capability lands with a Storybook doc + short operator note.