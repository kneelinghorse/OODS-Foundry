# Theme 0 Figma Specimens - List & Detail Contexts

These instructions define the minimum artefacts that must live in the **OODS - Theme 0** Figma library so designers can evaluate Theme 0 changes visually without drifting from repository tokens.

## Global Setup
- Create a component set **`Theme 0 > Context Frame`** with two variants: `context=list` and `context=detail`.
- Each variant contains auto-layout slots matching the canonical region IDs:
  - `Global Navigation`
  - `Page Header`
  - `Breadcrumbs`
  - `View Toolbar`
  - `Main`
  - `Context Panel`
- Annotate each slot with the Tokens Studio style expected for background (`Theme/Surface/...`) and foreground (`Theme/Text/...` or `Theme/Icon/...`).

## List Context Variant
- **Density**: Apply spacing variables `Theme > Space > Inset > Compact` to frame padding, `Theme > Space > Stack > Compact` to vertical gaps.
- **Typography**:
  - Header: `Theme/Text/Secondary` + `text.scale.heading-lg` (Tokens Studio typography style).
  - Body: `Theme/Text/Primary` + `text.scale.body-sm`.
- **Status Coverage**:
  - Insert a `StatusBanner` component referencing `Theme/Status/Info/*` for the default state and swap through `success`, `critical`, `warning`, `accent`.
  - Add a chip group using `Theme/Status/*` surface + text styles to demonstrate pill usage.
- **Interactive Elements**:
  - Primary button uses `Theme/Surface/Interactive/Primary/Default` for fill and `Theme/Text/On Interactive` for label.
  - Hover/pressed specimens appear as detached copies displaying the OKLCH-relative styles (no manual hex overrides).

## Detail Context Variant
- **Density**: Switch padding variables to `Theme > Space > Inset > Default` and `Theme > Space > Stack > Default`. Use `Theme > Space > Inline > Sm` for badges.
- **Typography**:
  - Title text style upgraded to `text.scale.heading-xl`.
  - Main body copy uses `text.scale.body-md` with relaxed line height.
- **Context Panel**:
  - Surfaces: apply `Theme/Surface/Subtle` background and `Theme/Border/Subtle` outline.
  - Include a timeline example referencing `Theme/Text/Muted`.
- **Status Coverage**: Mirror the banner + chip usage from the List variant to keep parity for Gemini validation.

## Export & Publication
- Publish both variants as components inside the **OODS - Theme 0** library so downstream product files can instance them.
- Document usage guidance with sticky notes referencing `app/docs/contexts/defaults.md` for density rationale.
- When Theme 0 tokens change, refresh the styles through Tokens Studio and republish the component set as part of the checklist in `roundtrip-checklist.md`.
