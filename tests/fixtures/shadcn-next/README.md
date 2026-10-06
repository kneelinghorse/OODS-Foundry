# shadcn/ui Next.js Base UI fixture

Created with Node 24.6.0 and `npx shadcn@4.21.1 init -t next -b base -p nova -n shadcn-next --no-monorepo -y`, then `npx shadcn@4.21.1 add button card badge tabs select input label pagination alert -y -o`. The CLI writes `base-nova`, `rsc: true`, the `@/*` alias and `app/globals.css`.

The authored edit to the generated theme sets `--primary` and `--ring` in both `:root` and `.dark` to `oklch(0.55 0.2 262)`. The original CSS and CLI logs are in `artifacts/product-reality/sprint-230/m03/`.

Sprint 231 also pairs the authored blue dark primary with the existing `--foreground` token through `--primary-foreground: var(--foreground)`. The original default nova foreground is appropriate for its pale dark primary, but produced 3.543:1 against this authored blue. Primary adapters preserve the team’s primary token pair. The Sprint 231 before receipts retain the original fixture.

The eight initial OODS adapters were added by the pinned CLI using the same local registry items documented in COMPONENTS.md:

`npx shadcn@4.21.1 add <foundry>/shadcn/oods-button.json <foundry>/shadcn/oods-card.json <foundry>/shadcn/oods-status-badge.json <foundry>/shadcn/oods-tabs.json <foundry>/shadcn/oods-select.json <foundry>/shadcn/oods-search-input.json <foundry>/shadcn/oods-pagination-bar.json <foundry>/shadcn/oods-banner.json -y -o`

Source and dependency versions are fixed by this fixture and its npm lockfile. Run `npm ci` then `npm run build` in a copy under the sprint checkout's `.tmp/`.
