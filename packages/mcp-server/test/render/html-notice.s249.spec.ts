import { vi } from 'vitest';

// Decision #1833: generation work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 300_000 });

/**
 * s249-m04 (Interface 14): HTML's notice names what was pressed as it reads. Every domain action an HTML document draws,
 * pressed with the document's own script running, makes the notice say "<its words> needs your app to act. Nothing was
 * changed.", its words being its accessible name: its aria-label, else its label's text, else a button's or link's own
 * text, with each run of white space read as one space and every letter kept. The script is inlined from a template
 * literal, so a regular expression's escape written once there reaches the page as a plain letter: a check that the
 * script holds the sentence cannot see that, so these press the actions and read what the notice says.
 */
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { handle as pipeline } from '../../src/tools/pipeline.js';

type Dom = { window: Window & typeof globalThis };
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, options?: Record<string, unknown>) => Dom };
// Pages whose actions' words hold an "s", white space runs and punctuation: a list's row titles, a detail's and a form's buttons.
const PAGES = [['Approval', 'list'], ['Grant', 'list'], ['CapturedArtifact', 'list'], ['Comparison', 'list'], ['Agent', 'detail'], ['Agent', 'form']] as const;
const SENTENCE = ' needs your application to act. Nothing was changed.';

/** The words a notice should name, read from the pressed element as a person reads it. */
function wordsOf(element: Element): string {
  const labelled = element.getAttribute('aria-label')
    || ((element as HTMLInputElement).labels?.[0]?.textContent)
    || (element.matches('button,a,[role="button"]') ? element.textContent : '');
  return (labelled ?? '').split(/[ \t\n\r\f\v ]+/).filter(Boolean).join(' ') || 'This';
}

const pressed: Array<{ page: string; words: string; notice: string }> = [];

beforeAll(async () => {
  for (const [object, context] of PAGES) {
    const result = await pipeline({ object, context, framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } };
    const html = String(result.render?.html ?? '');
    expect(html, `${object}/${context}`).toContain('data-oods-action-notice');
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const document = dom.window.document;
    const notice = document.querySelector('[data-oods-action-notice]')!;
    for (const action of [...document.querySelectorAll<HTMLElement>('[data-oods-action]')].filter(element => !element.closest('[hidden]'))) {
      notice.textContent = '';
      action.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      pressed.push({ page: `${object}/${context}`, words: wordsOf(action), notice: String(notice.textContent) });
    }
    dom.window.close();
  }
}, 600_000);

describe('HTML\'s notice names what was pressed, every letter kept (Interface 14)', () => {
  it('presses actions on every page, among them words with an "s" and a run of white space', () => {
    for (const [object, context] of PAGES) expect(pressed.some(entry => entry.page === `${object}/${context}`), `${object}/${context}`).toBe(true);
    expect(pressed.filter(entry => /s/.test(entry.words)).length).toBeGreaterThan(5);
  });

  it('says the pressed element\'s words, then that the app must act and nothing changed', () => {
    for (const entry of pressed) expect(entry.notice, entry.page).toBe(entry.words + SENTENCE);
  });

  it('keeps every letter: no notice reads a word with a letter taken out or two spaces in a row', () => {
    for (const entry of pressed) {
      expect(entry.notice, entry.page).not.toMatch(/ {2}/);
      expect(entry.notice.replace(SENTENCE, '').replace(/[^A-Za-z]/g, '').length, `${entry.page}: ${entry.notice}`)
        .toBe(entry.words.replace(/[^A-Za-z]/g, '').length);
    }
    expect(pressed.map(entry => entry.notice)).toContain(`Approve publishing How prorations work when plans change${SENTENCE}`);
  });
});
