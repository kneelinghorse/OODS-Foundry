# Your own brands

OODS Foundry styles every screen through design tokens. A **brand** is one colour value for each role the design system
paints (surfaces, text, actions, borders, focus, status and charts) in a light, a dark and a high-contrast theme, and its
corner radii and fonts. It ships brands A and B; this guide is for adding yours, so `design_compose`, `design_preview`,
`viz_render`, `artifact_certify`, `code_generate` and the apps it generates all use it.

## Where they live

| Folder | Holds | Setting |
| --- | --- | --- |
| `~/.oods-foundry/brands/<id>/` | your brand's `base.json` (light), `dark.json` and `hc.json` | `OODS_BRANDS_DIR` |
| `~/.oods-foundry/brands/.build/` | the token build made from your brands and the shipped ones | |

Your brands are built there, outside the unpacked runtime, so they survive upgrades; the first start of a new version
rebuilds them for it. Set `OODS_BRANDS_DIR` in your client's `env` block to keep them somewhere else. From the runtime
archive the variable has no default: set it to create a brand.

## From your own tokens

`brand_create` accepts your team's DTCG document without renaming its groups or tokens:

```json
{"action":"derive","tokens":{"color":{"brand":{"500":{"$type":"color","$value":"#387d47"}}}}}
```

It returns a partial `recipe`, `provenance` for each value (source path, raw and resolved value, and rule), `gaps` with
candidate paths, and `warnings`. It writes nothing. Review the result, fill every required gap, then call
`{"action":"create","brand_id":"Meadow","recipe":{...}}`. Creation grades the complete brand before writing it.

| Value | Derivation rule |
| --- | --- |
| Neutral hue and chroma | Circular median OKLCH hue and median chroma of colours with chroma ≤ 0.03 whose path contains gray, grey, neutral, slate, zinc or stone |
| Accent hue | Colour nearest OKLCH lightness 0.5 whose path contains primary, accent or brand; prefer a 500 or 600 step |
| Primary action | Accent when an accent was found, neutral otherwise; a missing accent hue remains a gap |
| Radius | Median dimension whose path contains radius, converting rem to px at 16px; clamp to 0–16 and warn |
| Font and mono font | First fontFamily in document order containing sans, body or base; mono for the mono family. Use the first family of a list |
| Status hues | Mid-lightness colours containing success, warning, info, error, danger or critical; the last three become critical |

Paths match without case sensitivity; ties follow document order. Group `$type` is inherited and `{group.token}` aliases
resolve within the document. Colours may be CSS strings or DTCG color objects. Transparent or unreadable colours are
reported; an achromatic colour with no hue cannot supply a hue. Optional `hints` selects exact paths for `accent`,
`neutral`, `radius`, `font` or `fontMono`, for example `"hints":{"accent":"color.selected"}`. A bad hint is reported
instead of silently falling back to inference. Recipe font names allow letters, digits, spaces and hyphens (64 characters).

Dark and high contrast are generated from the recipe. The same contrast rules apply: 84 pairs in light and dark,
83 graded pairs and one stated exemption in high contrast, plus 7 chart pairs per theme. This recipe flow supplies values for OODS roles. Use the reviewed file intake below to preserve your token names in generated apps. Optional status families and mono font not
found in the document remain absent from the recipe; the recipe generator's documented defaults apply at creation.

### From a shadcn/ui theme

Pass the project's CSS entry as `css`, or its absolute path as `cssPath`, in place of `tokens`:

```json
{"action":"derive","cssPath":"/absolute/path/to/app/src/index.css"}
```

The light `:root` declarations and `@theme inline` fonts supply the recipe. CSS imports and project scripts are not run.

| Value | CSS source |
| --- | --- |
| Neutral | Circular median hue and median chroma of `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--input`, with chroma ≤ 0.03 |
| Accent | Chromatic `--primary`, otherwise chromatic `--ring`, otherwise a gap |
| Primary | Accent when `--primary` is chromatic, neutral otherwise |
| Radius | `--radius`, converting rem to px at 16px |
| Fonts | First family in `--font-sans` and `--font-mono`, following one `var()` reference |
| Critical status | Hue of `--destructive` |

The default neutral shadcn theme leaves an accent gap. Nothing fills it for you. Each value's provenance names its
custom property and raw value; `hints` can name a different custom property. Other properties, including `--accent`
(the hover colour), `--secondary`, chart and sidebar colours, are ignored and named in a warning. Missing fonts are
reported as gaps; the optional mono font may remain absent. This derives OODS brand values; it does not write them
back to the project's CSS or copy the project's dark theme into OODS.

## Making one from a recipe

The quickest way is a recipe: six values from which every colour, the radius set and the font stacks follow.

| Value | What it sets |
| --- | --- |
| `neutralHue` (0 to 360) and `neutralChroma` (0 to 0.03) | the greys of surfaces, text and borders: their hue, and how much of it they carry |
| `accentHue` (0 to 360) | the accent for links, focus and selection; the brand's charts take their palette from it |
| `primary` | `"neutral"` for a near-black primary action in light (near-white in dark), or `"accent"` for one in the accent |
| `radius` (0 to 16) | the control radius in px; the other radii follow from it |
| `font` | the sans family; `fontMono` sets the monospace one too |

`status` can also set the hue, and optionally the chroma, of `info`, `success`, `warning`, `critical` and `archive`.

Ask your assistant to use the `brand_create` tool:

1. `{"action": "template", "from": {"recipe": {"neutralHue": 286, "neutralChroma": 0, "accentHue": 267, "primary":
   "neutral", "radius": 6, "font": "Geist"}}}` returns the complete brand the recipe gives: one document per theme,
   graded with the rules below (`report`), and every colour a rule moved off its step (`adjustments`).
2. `{"action": "validate", "brand_id": "Harbor", "recipe": {...}}` checks it under your brand's id and names the files
   `create` will write with their sha256. Nothing is written.
3. `{"action": "create", "brand_id": "Harbor", "recipe": {...}}` writes the files into your brands folder and builds
   them, in a few seconds. The brand is then in use everywhere, without a restart; `health_check` lists it.

## Making one slot by slot

To choose every value yourself:

1. `{"action": "template"}` returns one document per theme with every slot (103 in light, 96 in dark and in high
   contrast), each with what it paints as `$description` and a starting value: brand A's, another brand's with
   `"from": {"brand": "B"}`, or a preset's with `"from": {"preset": "corporate-blue"}` (the answer lists the presets).
2. Replace the `$value`s with yours. Keep the documents as they are: `surface.canvas`, not
   `color.brand.<id>.surface.canvas`.
3. `{"action": "validate", "brand_id": "Harbor", "documents": {...}}` reports every problem by rule, with the contrast
   ratio of each pair that misses its floor, and names the files `create` will write with their sha256. Nothing is
   written.
4. `{"action": "create", "brand_id": "Harbor", "documents": {...}}` writes the files into your brands folder and builds
   them, as a recipe's are.

`create` never replaces a brand (`OODS-C005`); it refuses a brand that does not validate, with the report
(`OODS-V216`), and if the build fails the brand is removed again (`OODS-S022`).

## The rules

- **Id**: capitals then digits (`ACME`, `A1`) or a letter then lower-case letters and digits (`Harbor`, `acme2`), at most
  32 characters, and no existing brand's id in any case.
- **Colours**: any opaque CSS colour (hex, `rgb()`, `hsl()`, `oklch()`, `lab()`, a named colour), not a reference to
  another token. System colours (`Canvas`, `CanvasText`, `Highlight` and the rest) follow the user's high-contrast
  settings, so only `hc` may use them.
- **Radii and fonts**: the light document carries `radius.control`, `small`, `large`, `card` and `pill` (0 to 999px) and
  `font.sans` and `font.mono` (family lists); every theme of a brand shares them.
- **Contrast**: light and dark are graded on 84 pairs each. Text is graded at 4.5:1 on the surfaces it sits on (53 pairs,
  among them the text on the primary action at rest, hovered and pressed, and status text on its own fill and on the
  canvas, raised and subtle panels). Status icons, control borders at rest and hovered, and the focus ring on the canvas,
  on a raised panel and on the primary action are graded at 3:1 (31 pairs). In `hc`, a pair of two system colours is
  graded as Chromium resolves them without forced colours, on macOS and Linux under a light and a dark colour scheme, and
  must pass in all four; a pair of two colours is graded like light and dark, and a pair of one of each is refused.
- **Chart colours**: every theme has 27 chart slots (six series, the one-series colour, nine sequential steps and eleven
  diverging ones), and they are your brand's own in every theme. A brand made from a recipe gets its accent's palette,
  and a preset carries its own recipe's. In every theme the one-series colour and the six series are graded at 3:1 on the
  canvas (7 pairs; in `hc`, as its system colours resolve). A series that misses says whether its value is brand A's,
  which a template starts from, so you know to set it for your canvas.

## Changing one

`brand_apply` changes your brand: `{"brand": "Harbor", "delta": {"dark": {"color": {"brand": {"Harbor": {"text":
{"primary": {"$value": "#f5f5f0"}}}}}}}, "apply": true}`. The brand as the change would leave it is checked first,
exactly as `validate` checks a new one, and nothing is written unless it passes. The receipt lists each slot that
changed, and its `variables.css` holds the CSS variables the build emitted differently. The brands OODS Foundry ships
cannot be changed from the npm package: for them `brand_apply` writes only a review kit.

The next composition, preview or generated app shows a change. A preview you made before it keeps the chart it drew;
make a new one to see the chart in the new colours.

## In the apps you generate

`code_generate` for your brand adds `src/oods-brand-<id>.css`, your brand's variables and its light, dark and
high-contrast scopes, and imports it from the screen (or, for a workflow app, from `App`). The app's `@oods/tokens`
carries the shipped brands; this file carries yours, so the app needs nothing else to show it. The file is part of the
artifact and of its content hash.


## Keep your token names

Use `brand_create` to draft from a local DTCG file. It reads data only, follows aliases within that file, and never fetches or runs project code. Group `$type` is inherited. Supported colors, dimensions, durations, numeric values, font families and cubic-bezier values become scoped custom properties; unsupported values, alias cycles, CSS-name collisions and reserved OODS names are reported individually. Dots become hyphens: `team.color.primary` becomes `--team-color-primary`.

```json
{"action":"draft","brand_id":"Team","source":{"path":"/absolute/team/tokens.json","modes":{"base":"light","dark":"dark"}},"bindings":{"base":{"surface.canvas":"light.team.canvas","text.primary":"light.team.ink"},"dark":{"surface.canvas":"dark.team.canvas","text.primary":"dark.team.ink"}}}
```

`modes` selects dot-separated groups in the document. Top-level `light` and `dark` groups are recognized when both are present. Without declared modes the same tokens are available in each theme; the reader does not invent a dark palette. Mode prefixes are omitted from custom property names so the same variable takes the declared theme's value. Shared tokens remain available in both modes.

Explicit `bindings` name OODS slots and exact source token paths. A token may also declare `$extensions: {"org.oods.intake": {"slot": "surface.canvas"}}`. Otherwise only a unique matching type and value can bind a template slot; token names alone do not decide. Every unbound slot is identified as a template fallback. `from.brand` or `from.preset` chooses the starting template, default A. High contrast keeps the checked template. Review all fallbacks and unmatched tokens before acceptance.

Call `show` with the returned `draftId`:

```json
{"action":"show","draftId":"brand-<sha256>"}
```

Then call `apply` to accept it:

```json
{"action":"apply","draftId":"brand-<sha256>","accept":true}
```

Acceptance covers the whole reviewed brand, its retained token values and the listed template fallbacks. Apply uses the existing contrast/type checks, refuses replacement and rolls back a failed token build. An invalid draft cannot apply; adjust bindings/source and draft again. CSS emits the team's names and aliases bound `--theme-*` slots to them. Generated React and Vue apps carry that stylesheet. Existing brands and the recipe flow keep their previous behavior.

The files retain this mapping in `org.oods.intake` metadata. The named variable must equal the slot literal used for contrast grading. When editing a bound slot through `brand_apply`, update that variable as well (or deliberately remove its slot binding); mismatches are refused rather than bypassing contrast checks.
