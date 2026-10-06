import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import { digest, type BrowserStep } from './common.js';

export async function applySteps(page: Page, steps: BrowserStep[], clockStart?: number) {
  let stepIndex = 0;
  for (const step of steps) {
    // Vue rejects bubbling events timestamped at or before listener attachment.
    // Advance deterministic wall time between interactions while real timers run.
    if (clockStart !== undefined) await page.clock.setFixedTime(new Date(clockStart + ++stepIndex));
    const target = page.locator(step.selector);
    if (step.action === 'click') await target.click();
    else if (step.action === 'fill') await target.fill(step.value ?? '');
    else if (step.action === 'select') await target.selectOption(step.value ?? '');
    else if (step.action === 'check') await target.check();
    else throw new Error(`Unknown browser step: ${step.action}`);
    const workflow = page.locator('[data-oods-workflow]');
    if (await workflow.count()) await page.locator('[data-oods-workflow][data-ui-state="success"]').waitFor();
  }
}

export async function observeView(page: Page, width: number, output: string) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  const accessibility = (await page.locator('body').ariaSnapshot()) + await observeGraphicsAccessibility(page);
  const observation = await page.evaluate(() => {
    const all = Array.from(document.body.querySelectorAll('*')).filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
    const overflow = all.flatMap(element => {
      const box = element.getBoundingClientRect();
      return box.right > innerWidth + 1 || box.left < -1 ? [{ element: (element.id || element.getAttribute('data-oods-component') || element.tagName.toLowerCase()), left: box.left, right: box.right, width: box.width }] : [];
    });
    const glyphWraps: Array<{ element: string; text: string; lines: string[] }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || (!parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') || /^(SCRIPT|STYLE)$/.test(parent.tagName) || !node.textContent?.trim()) continue;
      const lines = new Map<number, string>();
      const range = document.createRange();
      for (let i = 0; i < node.textContent.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const box = range.getBoundingClientRect();
        if (!box.width && !box.height) continue;
        const top = Math.round(box.top * 10) / 10;
        lines.set(top, (lines.get(top) ?? '') + node.textContent[i]);
      }
      if (lines.size > 1) glyphWraps.push({ element: (parent.id || parent.getAttribute('data-oods-component') || parent.tagName.toLowerCase()), text: node.textContent.trim(), lines: [...lines.values()].map(text => text.trim()) });
    }
    const values = all.filter(element => /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)).map(element => {
      const input = element as HTMLInputElement;
      return { element: (element.id || element.getAttribute('data-oods-component') || element.tagName.toLowerCase()), name: element.getAttribute('aria-label') || Array.from(input.labels ?? []).map(label => label.textContent?.trim()).join(' '), value: input.value, checked: input.checked ?? false };
    });
    const regions = all.filter(element => element.hasAttribute('data-oods-component') || /(?:toolbar|items|pagination|entry)-?\d*$/.test(element.id))
      .map(element => ({ id: element.id, component: element.getAttribute('data-oods-component') ?? element.tagName.toLowerCase(), text: (element as HTMLElement).innerText?.trim() ?? '' }));
    return { visibleText: document.body.innerText.trim(), measurements: { bodyBackground: getComputedStyle(document.body).backgroundColor,
      chartCanvasFills: Array.from(document.querySelectorAll('figure[data-viz-rendered="true"] svg')).map(svg => svg.querySelector(':scope > rect')?.getAttribute('fill') ?? ''), viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, elementCount: all.length, overflow, glyphWraps }, values, regions };
  });
  const screenshot = `${width}.png`, dump = `${width}.a11y.txt`;
  await fs.writeFile(path.join(output, dump), accessibility + '\n');
  await page.screenshot({ path: path.join(output, screenshot), fullPage: true, animations: 'disabled' });
  return { width, accessibility, ...observation, screenshot, screenshotHash: digest(await fs.readFile(path.join(output, screenshot))), dump };
}

/** Playwright's text snapshot collapses SVG roles into img. Retain the browser's
 * actual graphics subtree as additional evidence; never infer it from DOM roles. */
export async function observeGraphicsAccessibility(page: Page): Promise<string> {
  const selector = 'figure[data-viz-rendered="true"]';
  if (!await page.locator(selector).count()) return '';
  const client = await page.context().newCDPSession(page);
  try {
    const { root } = await client.send('DOM.getDocument');
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { node } = await client.send('DOM.describeNode', { nodeId });
    const { nodes } = await client.send('Accessibility.getFullAXTree');
    const figure = nodes.find(entry => entry.backendDOMNodeId === node.backendNodeId);
    if (!figure) throw new Error('Rendered chart figure is absent from the browser accessibility tree.');
    const byId = new Map(nodes.map(entry => [entry.nodeId, entry]));
    const lines = ['\nBrowser AX subtree for the chart figure:'];
    const visit = (entry: (typeof nodes)[number] | undefined, depth: number): void => {
      if (!entry) return;
      lines.push(`${'  '.repeat(depth)}- ${entry.role?.value} ${JSON.stringify(entry.name?.value ?? '')}${entry.ignored ? ' [ignored]' : ''}`);
      for (const id of entry.childIds ?? []) visit(byId.get(id), depth + 1);
    };
    visit(figure, 0);
    return lines.join('\n');
  } finally { await client.detach(); }
}
