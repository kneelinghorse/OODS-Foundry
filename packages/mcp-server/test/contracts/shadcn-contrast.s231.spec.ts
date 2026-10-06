import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { measureTextContrast, readVisibleText } from '../../../../scripts/product-reality/s231-contrast.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const source = (name: string): string => JSON.parse(fs.readFileSync(path.join(root, `packages/foundry/shadcn/oods-${name}.json`), 'utf8')).files[0].content;

describe('s231: registry regeneration retains readable destructive text', () => {
  it.each(['button', 'status-badge', 'banner'])('%s supplies solid team tokens to the shadcn part without losing caller classes', name => {
    const item = source(name);
    expect(item).toContain('bg-destructive text-background');
    expect(item).toContain("className={[destructiveClass, className].filter(Boolean).join(' ')}");
    expect(item).toBe(fs.readFileSync(path.join(root, `scripts/runtime/shadcn/oods-${name}.tsx`), 'utf8'));
    expect(item).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('keeps the solid button background on hover and in dark so opacity cannot recreate the light failure', () => {
    expect(source('button')).toContain('hover:bg-destructive dark:bg-destructive dark:hover:bg-destructive');
    expect(source('status-badge')).toContain('dark:bg-destructive [a]:hover:bg-destructive');
  });

  it('preserves the team primary foreground pair, including default nova dark primary', () => {
    expect(source('button')).toContain("intent === 'primary' ? 'default'");
    expect(source('button')).not.toContain('dark:text-foreground');
    expect(source('button')).not.toContain("variant === 'default' ?");
  });

  it('overrides destructive alert-description alpha so body text keeps the same passing foreground', () => {
    expect(source('banner')).toContain('*:data-[slot=alert-description]:text-inherit');
    expect(source('banner')).toContain("role={critical ? 'alert' : 'status'}");
    expect(source('banner')).toContain("aria-live={critical ? 'assertive' : 'polite'}");
  });
});

// The nova red is outside sRGB. Blending an unclipped negative green component
// understates its pink background. Keep source clipping ahead of alpha blending.
it('composites display-clipped nova tokens before calculating a translucent background', () => {
  const row = measureTextContrast({ fg: 'oklch(0.577 0.245 27.325)', backgrounds: ['oklab(0.577 0.217662 0.112464 / 0.1)', 'oklch(1 0 0)'] });
  expect(row.foreground).toBe('#e7000b');
  expect(row.background).toBe('#fde5e7');
  expect(row.ratio).toBeGreaterThan(3.98);
  expect(row.ratio).toBeLessThan(3.99);
});

it('retains the row background beneath the critical badge in the site Subscription list case', () => {
  const row = measureTextContrast({ fg: 'oklch(0.577 0.245 27.325)', backgrounds: ['oklab(0.577 0.217662 0.112464 / 0.1)', 'oklch(0.97 0 0)', 'oklch(1 0 0)'] });
  expect(row.foreground).toBe('#e7000b');
  expect(row.background).toBe('#f4dcde');
  expect(row.ratio).toBeGreaterThan(3.66);
  expect(row.ratio).toBeLessThan(3.67);
});

it('grades the SVG glyph fill and fill opacity rather than a passing inherited text color', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.OODS_CONTRACT_BROWSER_EXECUTABLE ? { executablePath: process.env.OODS_CONTRACT_BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent('<body style="background:white;color:black"><svg width="300" height="100" style="font:16px sans-serif"><text x="0" y="20" fill="#aaa">Low contrast fill</text><text x="0" y="50" fill="black" fill-opacity=".5">Low opacity fill</text></svg></body>');
    const samples = (await page.locator('body *').evaluateAll(readVisibleText)).map(measureTextContrast);
    expect(samples).toHaveLength(2);
    expect(samples.every(row => row.kind === 'svg-text' && row.ratio < row.threshold!)).toBe(true);
    expect(samples.map(row => row.foreground)).toEqual(['#aaaaaa', '#808080']);
    expect(measureTextContrast({ fg: 'black', backgrounds: ['white'] }).ratio).toBe(21);
    await page.setContent('<body style="background:black;color:white"><svg width="150" height="50" viewBox="0 0 300 100" style="font:24px sans-serif"><rect width="300" height="100" fill="white"/><text x="0" y="30" fill="#808080">Scaled chart title</text></svg></body>');
    const [scaled] = (await page.locator('body *').evaluateAll(readVisibleText)).map(measureTextContrast);
    expect(scaled!.background).toBe('#ffffff');
    expect(scaled!.paintLimit).toBeNull();
    expect(scaled!.fontScale).toBe(.5);
    expect(scaled!.fontSize).toBe(12);
    expect(scaled!.threshold).toBe(4.5);
    expect(scaled!.ratio).toBeGreaterThan(3);
    expect(scaled!.ratio).toBeLessThan(4.5);
  } finally {
    await browser.close();
  }
}, 30_000);
