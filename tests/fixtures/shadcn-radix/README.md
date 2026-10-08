# shadcn/ui Radix fixture

Created with Node 24.6.0 and `npx shadcn@4.21.1 init -t vite -b radix -p nova -n shadcn-radix --no-monorepo -y`, then `npx shadcn@4.21.1 add button card badge tabs select input label pagination alert -y -o`.

The authored change to the generated theme sets `--primary` and `--ring` in both `:root` and `.dark` to `oklch(0.55 0.2 262)`. The original light-theme values are retained in the Sprint 229 fixture receipts. Source and dependency versions are fixed by this fixture and its npm lockfile.

Sprint 231 also pairs the authored blue dark primary with the existing `--foreground` token through `--primary-foreground: var(--foreground)`. The original default nova foreground is appropriate for its pale dark primary, but produced 3.543:1 against this authored blue. Primary adapters preserve the team’s primary token pair. The Sprint 231 before receipts retain the original fixture.

The no-plugin `postcss.config.mjs` prevents Vite from reading this repository's parent Tailwind 3 PostCSS configuration. OODS adapters are installed from the OODS Foundry registry items by the proof; they are not fixture source.

Run `npm ci` then `npm run build` in a copy under the sprint checkout's `.tmp/`.
