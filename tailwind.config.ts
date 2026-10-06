import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Config } from 'tailwindcss';

/**
 * s173 m02 (crawl 1) — the responsive breakpoints come from the token pipeline.
 *
 * Until now Tailwind's own defaults were the only definition of a breakpoint in this repo,
 * so the ~37 responsive-prefix usages across ~23 files and every future container query
 * agreed only by coincidence. `sys.breakpoint.{sm,md,lg,xl,2xl}` is now the single source,
 * and this generator is what makes Tailwind read it.
 *
 * THE VALUES ARE THE INSTALLED TAILWIND DEFAULTS (3.4.x: 640/768/1024/1280/1536), adopted
 * deliberately rather than chosen: identical values mean this wiring moves zero rendered
 * layout, which is what lets crawl 1 land without a visual review.
 *
 * ORDER IS LOAD-BEARING. Tailwind emits its `@media` blocks in config-key order, and later
 * blocks win ties, so an unsorted map would silently reorder the cascade. The keys are
 * written out ascending here rather than derived from the artifact's own key order.
 *
 * MECHANISM. Read from the BUILT artifact (`dist/tailwind/tokens.json`), resolved through
 * node's package resolution rather than a relative path, because this config is loaded by
 * three different runtimes (Tailwind's jiti loader, postcss, vitest) whose `__dirname` and
 * `import.meta` are not usable: under jiti `__filename` is the CALLER's, and a config that
 * CALLS `import.meta.resolve` fails outright with "Cannot use 'import.meta' outside a
 * module". `process.cwd()` is the anchor and node walks up from there.
 *
 * FAIL LOUD, NEVER FALL BACK. A missing or malformed artifact THROWS naming the command
 * that fixes it. A silent fallback to Tailwind's defaults would be indistinguishable from
 * success today — the values are identical — and would quietly un-wire the tokens the first
 * time someone changed one.
 */
export const BREAKPOINT_SCREEN_KEYS = ['sm', 'md', 'lg', 'xl', '2xl'] as const;

/** Where the built artifact lives, resolved through node rather than guessed by path. */
export function tokenArtifactPath(): string {
  const requireFrom = createRequire(join(process.cwd(), 'tailwind.config.ts'));
  return join(dirname(requireFrom.resolve('@oods/tokens/package.json')), 'dist', 'tailwind', 'tokens.json');
}

/**
 * Exported, and takes the artifact path, for ONE reason: the guard has to be provable.
 * Both failure branches and the "it really read the file" branch are only reachable with a
 * substituted artifact, and a test that re-typed this logic would prove nothing about the
 * code Tailwind actually loads. Production passes nothing.
 */
export function screensFromTokens(artifact: string = tokenArtifactPath()): Record<string, string> {
  if (!existsSync(artifact)) {
    throw new Error(
      `[tailwind.config.ts] Token artifact not found at ${artifact}. ` +
        'Tailwind\'s screens are generated from sys.breakpoint.* — run `pnpm build:tokens` first.',
    );
  }

  const { flat } = JSON.parse(readFileSync(artifact, 'utf8')) as {
    flat?: Record<string, { value?: unknown }>;
  };
  const screens: Record<string, string> = {};
  for (const key of BREAKPOINT_SCREEN_KEYS) {
    const value = flat?.[`sys-breakpoint-${key}`]?.value;
    if (typeof value !== 'number') {
      throw new Error(
        `[tailwind.config.ts] Token sys.breakpoint.${key} is missing or not a number in ${artifact} ` +
          `(got ${JSON.stringify(value)}). Run \`pnpm build:tokens\` — screens are not defaulted.`,
      );
    }
    screens[key] = `${value}px`;
  }
  return screens;
}

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    './tests/**/*.{ts,tsx}',
    './stories/**/*.{ts,tsx}',
  ],
  theme: {
    // An OVERRIDE, not an extend: the tokens are the definition of a breakpoint here, so
    // Tailwind's built-in map is replaced rather than merged with. The replacement is
    // value-identical today, so no utility changes.
    screens: screensFromTokens(),
    extend: {
      colors: {
        surface: 'var(--sys-surface-canvas, #f8fafc)',
        'surface-raised': 'var(--sys-surface-raised, #ffffff)',
        'info-surface': 'var(--sys-status-info-surface, #e0f2ff)',
        'info-border': 'var(--sys-status-info-border, #38bdf8)',
        'info-text': 'var(--sys-status-info-text, #0369a1)',
        'info-icon': 'var(--sys-status-info-icon, #0284c7)',
        text: 'var(--sys-text-primary, #0f172a)',
        'text-muted': 'var(--sys-text-muted, #64748b)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.08)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
