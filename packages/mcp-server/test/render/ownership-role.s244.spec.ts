import { describe, expect, it } from 'vitest';
import { renderMappedComponent } from '../../src/render/component-map.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';

/**
 * s244-m04: OwnershipSummary's and OwnershipMeta's `role` is the owner's role, a value the component shows (React and Vue
 * consume it as a prop). The HTML renderer wrote it out as an ARIA role: Agent's sponsor ("Sponsor") failed axe's
 * aria-roles on Agent's HTML card and detail, and Organization's and the bound-but-empty roles on Relationship and Plan
 * wrote role="Reseller of record" and role="" on shipped HTML screens.
 */
const ARIA_ROLES = new Set(['alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem']);
const roles = (html: string) => [...html.matchAll(/\srole="([^"]*)"/g)].map(match => match[1]!);

describe('an owner\'s role is shown, never written as an ARIA role (s244-m04)', () => {
  it('OwnershipSummary and OwnershipMeta show the role as text and write no role attribute for it', () => {
    const summary = renderMappedComponent({ id: 'owner', component: 'OwnershipSummary', props: { ownerId: 'u-1', ownerLabel: 'Ruth Adeyemi', ownerType: 'user', role: 'Sponsor' } });
    expect(summary).toContain('Sponsor');
    expect(roles(summary)).toEqual([]);
    for (const props of [{ ownerLabel: 'Ruth Adeyemi', ownerType: 'user', role: 'Sponsor' }, { ownerType: 'team', role: 'Sponsor' }, { ownerType: 'team', role: '' }]) {
      const meta = renderMappedComponent({ id: 'meta', component: 'OwnershipMeta', props });
      expect(roles(meta), JSON.stringify(props)).toEqual([]);
      if (props.role) expect(meta).toContain('Sponsor');
    }
  });

  it('every role attribute on the shipped objects\' HTML screens that bind an owner is a valid ARIA role', async () => {
    for (const object of ['Agent', 'Organization', 'Relationship', 'Plan']) for (const context of ['detail', 'card', 'workflow'] as const) {
      const composed = await compose({ object, context, options: { transient: true } });
      expect(composed.status, `${object}/${context}`).toBe('ok');
      const generated = await generate({ schema: composed.schema!, framework: 'html' });
      expect(generated.status, `${object}/${context}`).toBe('ok');
      expect(roles(String(generated.code)).filter(role => !ARIA_ROLES.has(role)), `${object}/${context}`).toEqual([]);
    }
  }, 120_000);
});
