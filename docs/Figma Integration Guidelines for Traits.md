Figma Integration Guidelines for Traits

Design Implementation Handbook — OODS Foundry

0. Purpose

These guidelines explain how traits are represented and managed in Figma — how designers apply them, how the plugin maintains consistency, and how variant properties and tokens correspond to the underlying code system.

The goal is to make traits visible, predictable, and maintainable inside the design tool without requiring designers to understand YAML or code.

1️⃣ What a Trait Means in Figma

A trait in OODS Foundry defines capability and semantics.
In Figma, that capability appears as a combination of:

Variant properties (representing schema values)

Style bindings (semantic token connections)

Nested component inserts (view extensions)

Metadata annotations (plugin data, hidden from UI)

Example

Trait: Stateful

Trait Concept	Figma Representation
status field	Variant property: Status = Active / Inactive / Error
Token mapping	Paint/text styles linked to semantic tokens
View extension	Optional badge component inserted in the `pageHeader` region
Metadata	JSON manifest stored via plugin in component description
2️⃣ The Traits Plugin

The OODS Figma Plugin is the bridge between code definitions and the design library.

Core Responsibilities

Read the trait registry from Git (via API or local JSON).

Display a “Traits Panel” sidebar showing available traits.

Apply selected traits to components or frames.

Generate variant properties, styles, and nested layers automatically.

Validate dependencies and prevent invalid combinations.

Annotate components with metadata for synchronization.

Plugin UI (Concept)
[ Traits Panel ]
-----------------------------------
✅ Stateful        [configurable]
⚪ Cancellable     [requires Stateful]
⚪ Taggable
⚪ Archivable
-----------------------------------
[ Apply to Component ]

Metadata Storage

The plugin writes a hidden JSON object in the component’s plugin data:

{
  "traits": ["Stateful", "Taggable"],
  "lastSync": "2025-03-10T10:30:00Z",
  "source": "git@main:traits/lifecycle/Stateful.trait.yaml"
}

3️⃣ Component Architecture

Every object in Figma (e.g., Subscription, Product, Task) is built from:

Base Component
 ├─ Variant Properties (from traits)
 ├─ Linked Tokens (from trait semantics)
 └─ Nested Components (from trait view extensions)

Naming Conventions
Type	Convention	Example
Components	ObjectName / Context / Variant	Subscription / Detail / Active
Variant Properties	TraitName:Property	Stateful:Status
Nested Components	TraitName_Component	Cancellable_Banner
Styles	Token name in kebab-case	status-warning-bg
Structural Layers
Subscription / Detail
 ├─ Global Navigation (optional; product shell)
 ├─ Page Header
 ├─ Breadcrumbs (optional)
 ├─ View Toolbar (filters / density / exports)
 ├─ Main
 └─ Context Panel (attachments, activity, comments)


Canonical region IDs must align with those defined in the code spec:
globalNavigation, pageHeader, breadcrumbs, viewToolbar, main, contextPanel

4️⃣ Variant Property Rules

Traits that define enumerations (e.g., states, roles, types) automatically generate variant properties.

Rules

Naming: TraitName:Field (e.g., Stateful:Status)

Values: use lowercase kebab-case (future, trialing, active, paused, pending-cancellation, delinquent, terminated)

Defaults: first listed value becomes the default variant

Visibility: variant properties are visible to designers but locked if they come from system traits (plugin sets “locked” flag)

Example
Variant	Values	Token Binding
Status	Future / Trialing / Active / Paused / Pending Cancellation / Delinquent / Terminated	status-info-bg / status-info-bg / status-success-bg / status-warning-bg / status-info-bg / status-error-bg / status-neutral-bg
5️⃣ Style Binding (Tokens)

Each trait defines which Figma styles should link to which tokens.

Token Type	Figma Target	Example
--status-success-bg	Fill	Green 500
--status-warning-bg	Fill	Yellow 400
--status-error-text	Text color	Red 600
--interactive-focus-outline-color	Stroke	Blue 500 outline
Rules

All style names in Figma match token paths exactly (status-success-bg).

Never use detached colors or text styles; everything references a token style.

Plugin validates token bindings during sync.

Accessibility Validation

The plugin runs a color-contrast check and flags failures directly in Figma:

⚠️ Contrast 3.9:1 < AA


Designers can fix by switching to an accessible token.

6️⃣ View Extensions (Nested Components)

Traits that define view extensions (like badges, banners, or actions) correspond to nested component instances.

Extension Type	Action	Figma Representation
section	Add new block in region	Nested component instance
action	Add button or link	Instance inside “viewToolbar” group
wrapper	Wrap existing frame	Auto-layout wrapper component
modifier	Apply variant or token update	Plugin adjusts layer props
Example

Trait: Cancellable

Adds a CancellationBanner to the `main` region in Detail context.

Plugin looks up CancellationBanner from the shared library and nests it automatically.

7️⃣ Dependency Handling

The plugin enforces trait dependencies in real time.

Example:
Cancellable requires Stateful.

When a designer tries to apply Cancellable, the plugin will prompt:

❗ This trait depends on Stateful.
Add Stateful first?
[ Add ] [ Cancel ]


Dependencies are defined in code (requires / conflicts_with) and mirrored in plugin logic.

8️⃣ Composition & Validation Flow
1. Designer opens a component

→ Plugin detects current traits via metadata.

2. Designer opens “Traits Panel”

→ Plugin loads registry and shows available traits.

3. Designer applies a new trait

→ Plugin checks dependencies and conflicts.
→ Adds variant properties, style links, and nested components.

4. Plugin runs validation

→ Ensures tokens exist, no color detachments, accessibility passes.

5. Designer syncs

→ Plugin commits a “manifest” file (object.traits.json) back to the repo via PR.

9️⃣ Plugin–Repo Sync Model
Direction	Description
Repo → Figma	CI pipeline updates Figma library using API (updates variant props, tokens, and components).
Figma → Repo	Plugin generates pull request with proposed trait changes. No direct writes.
Designer Workflow	Designers apply traits; plugin syncs metadata and variant properties.
Sync Frequency

Nightly CI sync for updates from main branch.

Manual “Sync now” option in plugin for branch testing.

🔟 Component Library Hygiene
Library Structure
OODS Components (Figma Library)
 ├─ Primitives
 ├─ Traits
 │   ├─ Stateful
 │   ├─ Taggable
 │   ├─ Cancellable
 │   └─ Archivable
 ├─ Objects
 │   ├─ Subscription
 │   ├─ Product
 │   ├─ Invoice
 │   └─ Task
 └─ Tokens (color, text, effect)

Rules

Each trait has its own Trait Component Set in the “Traits” page.

These components only contain the visual representation of the trait (badges, banners, indicators).

Objects reference traits but do not embed them directly; composition happens via nested instances.

Designers must not detach trait instances — plugin will warn.

11️⃣ Collaboration & Ownership
Role	Responsibility
System Designers	Maintain trait visuals and token mappings.
Product Designers	Compose traits into objects, create contexts.
Plugin Maintainers	Maintain registry connection, run validation scripts.
Engineers	Keep schema and semantics definitions in sync with Figma components.
12️⃣ Visual Naming Conventions
Artifact	Pattern	Example
Component	TraitName_ComponentName	Stateful_StatusBadge
Variant	lowercase kebab-case	active, past-due, canceled
Tokens	kebab-case	status-warning-bg
Styles	Title case, mirror tokens	Status / Warning / BG
13️⃣ Accessibility Workflow

All color and text styles mapped to tokens with verified contrast ratios.

Focus states visualized as dedicated variants (e.g., Focus = True / False).

Plugin’s A11y audit runs automatically during sync:

Contrast check

Presence of focus styles for interactive traits

Missing hover/disabled states

Any failure blocks “Publish to Library.”

14️⃣ Versioning in Figma

Each library update corresponds to a system version tag (v1.2.0).

Library page banner shows version:
OODS Foundry Traits Library — v1.2.0

Plugin compares versions and warns designers if they are using outdated traits.

15️⃣ Designer Workflow Summary
Step	Action	Result
1	Open Traits Panel	See all available traits
2	Apply traits to component	Plugin adds variants/styles
3	Adjust variant values	Design updates automatically
4	Validate	Plugin runs token + a11y checks
5	Sync	Plugin updates manifest + metadata
6	Publish	New version pushed to Figma Library
16️⃣ Example in Practice

Scenario: A designer creates a new “Subscription Card”.

Opens Traits Panel → checks ✅ Stateful, ✅ Cancellable.

Plugin adds:

Variant: Status = Trialing / Active / Past Due / Canceled

Nested: CancellationBanner inside body region

Style links: tokens status-* and cancel-*

Plugin validates → all tokens found, contrast passes.

Designer publishes → component metadata written:

{ "traits": ["Stateful","Cancellable"], "version":"1.0.0" }


CI sync updates code manifest; both systems remain in lockstep.

17️⃣ Best Practices
Do	Don’t
Use the plugin to apply traits — never fake them visually.	Manually recreate trait visuals.
Keep variant names lowercase and consistent.	Use inconsistent naming (Active vs active).
Always link color/text styles to semantic tokens.	Use manual color fills.
Run validation before publishing.	Publish unvalidated changes.
Propose trait updates via PR, not direct Figma edits.	Treat Figma as the source of truth.
18️⃣ Quick Reference (Designers)
Action	Where	Tool
Apply trait	Traits Panel	Plugin
Check token contrast	Inspector > Plugin Audit	Plugin
See trait docs	Object Explorer > Trait	Storybook link
Sync library	Plugin > Sync Now	CI Pipeline
Propose change	Plugin > “Propose PR”	GitHub PR template
19️⃣ Golden Rules for Designers

Always compose — never duplicate.

Figma follows code. The plugin manages mappings; don’t override manually.

Tokens over colors. Every visual style must use a token.

Traits are building blocks, not decorations. Apply intentionally.

Accessibility is design. Never publish components that fail a11y validation.

End of Document
