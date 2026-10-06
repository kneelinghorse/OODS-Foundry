/**
 * XSS Security Tests — Sprint 48 Mission 01
 *
 * Validates that the HTML render pipeline properly escapes all user-controlled
 * values before interpolation into HTML output. Covers:
 *   - Script injection in text props
 *   - Attribute breakout in style/class values
 *   - Event handler injection via props
 *   - Malformed Unicode edge cases
 *   - Nested component prop escalation
 *   - Node ID injection in tree-renderer section wrapper
 *   - Token value injection in style attributes
 *
 * Interpolation point catalogue (audited files):
 *   tree-renderer.ts:
 *     - node.id in section data-layout-node-id attribute (FIXED: now escaped)
 *     - sectionStyle in section style attribute (FIXED: now escaped)
 *   component-map.ts:
 *     - All text content: escapeHtml() via renderButton, renderText, etc.
 *     - All attributes: escapeHtml() via renderAttribute() + buildAttributes()
 *     - Select option values/labels: escapeHtml()
 *     - Table cell content: escapeHtml() via serializePropValue()
 *     - Timeline event fields: escapeHtml()
 *   document.ts:
 *     - title, lang, theme, brand: escapeHtml()
 *     - screenHtml: pre-rendered (by design)
 *   escape-html.ts (shared):
 *     - Escapes: & < > " '
 */
import { describe, expect, it } from 'vitest';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { renderMappedComponent } from '../../src/render/component-map.js';
import { renderDocument } from '../../src/render/document.js';
import { renderFragments, renderTree } from '../../src/render/tree-renderer.js';
import { escapeHtml } from '../../src/render/escape-html.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeNode(
  component: string,
  props: Record<string, unknown> = {},
  extras: Partial<UiElement> = {},
): UiElement {
  return {
    id: extras.id ?? `${component.toLowerCase()}-node`,
    component,
    props,
    children: extras.children,
    layout: extras.layout,
    meta: extras.meta,
    route: extras.route,
    style: extras.style,
    bindings: extras.bindings,
  };
}

function makeSchema(screens: UiElement[]): UiSchema {
  return { version: '2026.02', screens };
}

// Common XSS payloads
const XSS_VECTORS = {
  scriptTag: '<script>alert("xss")</script>',
  imgOnerror: '<img onerror=alert(1) src=x>',
  attrBreakout: '"><img onerror=alert(1) src=x>',
  singleQuoteBreakout: "'>alert(1)<'",
  eventHandler: '" onmouseover="alert(1)" data-x="',
  svgOnload: '<svg onload=alert(1)>',
  jsProtocol: 'javascript:alert(1)',
  encodedScript: '&lt;script&gt;alert(1)&lt;/script&gt;',
  nullByte: 'test\x00<script>alert(1)</script>',
  unicodeEscape: '\u003cscript\u003ealert(1)\u003c/script\u003e',
};

// ---------------------------------------------------------------------------
// escapeHtml unit tests
// ---------------------------------------------------------------------------
describe('escapeHtml shared utility', () => {
  it('escapes all five critical HTML entities', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('escapes a combined attack string', () => {
    const input = `<script>alert("xss")</script>`;
    const output = escapeHtml(input);
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('</script>');
    expect(output).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('preserves safe characters', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
  });
});

// ---------------------------------------------------------------------------
// Script injection in text props
// ---------------------------------------------------------------------------
describe('XSS: script injection in text props', () => {
  it.each([
    { component: 'Button', propKey: 'label' },
    { component: 'Text', propKey: 'text' },
    { component: 'Badge', propKey: 'label' },
    { component: 'Banner', propKey: 'message' },
    { component: 'CardHeader', propKey: 'title' },
    { component: 'DetailHeader', propKey: 'title' },
    { component: 'InlineLabel', propKey: 'label' },
  ])('$component escapes <script> in $propKey prop', ({ component, propKey }) => {
    const html = renderMappedComponent(
      makeNode(component, { [propKey]: XSS_VECTORS.scriptTag }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('Text escapes script tag in value prop', () => {
    const html = renderMappedComponent(
      makeNode('Text', { value: XSS_VECTORS.scriptTag }),
    );
    expect(html).not.toContain('<script>');
  });

  it('Card escapes script tag in body prop', () => {
    const html = renderMappedComponent(
      makeNode('Card', { body: XSS_VECTORS.scriptTag }),
    );
    expect(html).not.toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// Attribute breakout in style/class values
// ---------------------------------------------------------------------------
describe('XSS: attribute breakout via props', () => {
  it('Button escapes double-quote breakout in label', () => {
    const html = renderMappedComponent(
      makeNode('Button', { label: XSS_VECTORS.attrBreakout }),
    );
    expect(html).not.toContain('"><img');
    expect(html).toContain('&quot;');
  });

  it('escapes double-quote in className preventing attribute breakout', () => {
    const html = renderMappedComponent(
      makeNode('Badge', { className: XSS_VECTORS.eventHandler }),
    );
    // Quotes escaped so attribute boundary holds — onmouseover appears as
    // harmless text inside the escaped attribute value, not as a real attribute.
    expect(html).toContain('&quot;');
    expect(html).not.toContain('class="" onmouseover');
  });

  it('escapes double-quote in style preventing attribute breakout', () => {
    const html = renderMappedComponent(
      makeNode('Card', { style: '"; onclick=alert(1) data-x="' }),
    );
    // The " is escaped so onclick cannot become a standalone attribute
    expect(html).toContain('&quot;');
    expect(html).not.toContain('style="" onclick');
  });

  it('drops undeclared props containing attribute breakout', () => {
    const html = renderMappedComponent(
      makeNode('Badge', { customProp: XSS_VECTORS.attrBreakout }),
    );
    // Authoring metadata cannot become an attribute or executable markup.
    expect(html).not.toContain('data-prop-custom-prop');
    expect(html).not.toContain('"><img');
    expect(html).not.toContain('onerror');
  });

  it('escapes attribute breakout in id prop', () => {
    const html = renderMappedComponent(
      makeNode('Text', { id: '"><script>alert(1)</script>' }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });

  it('escapes single-quote breakout in aria-label prop', () => {
    const html = renderMappedComponent(
      makeNode('Button', { 'aria-label': XSS_VECTORS.singleQuoteBreakout }),
    );
    expect(html).not.toContain("'>alert");
    expect(html).toContain('&#39;');
  });
});

// ---------------------------------------------------------------------------
// Event handler injection
// ---------------------------------------------------------------------------
describe('XSS: event handler injection', () => {
  it('cannot inject onmouseover via prop value — quotes escaped', () => {
    const html = renderMappedComponent(
      makeNode('Button', { label: '" onmouseover="alert(1)' }),
    );
    // Quotes are escaped, so the text content is safely contained.
    // The literal "onmouseover=" appears inside the escaped value but
    // cannot become a real attribute because " is &quot;.
    expect(html).toContain('&quot;');
    expect(html).not.toContain('>" onmouseover=');
  });

  it('cannot inject onclick via title prop — quotes escaped', () => {
    const html = renderMappedComponent(
      makeNode('Text', { title: '" onclick="alert(1)' }),
    );
    expect(html).toContain('&quot;');
    expect(html).not.toContain('title="" onclick');
  });

  it('cannot inject onfocus via Input placeholder — quotes escaped', () => {
    const html = renderMappedComponent(
      makeNode('Input', { placeholder: '" onfocus="alert(1)' }),
    );
    expect(html).toContain('&quot;');
    expect(html).not.toContain('placeholder="" onfocus');
  });
});

// ---------------------------------------------------------------------------
// Malformed Unicode
// ---------------------------------------------------------------------------
describe('XSS: Unicode edge cases', () => {
  it('escapes Unicode-encoded angle brackets', () => {
    const html = renderMappedComponent(
      makeNode('Text', { text: XSS_VECTORS.unicodeEscape }),
    );
    // \u003c is '<', \u003e is '>'. JavaScript resolves these at string level,
    // so they arrive as actual < and > characters to escapeHtml.
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('handles null bytes in text content', () => {
    const html = renderMappedComponent(
      makeNode('Text', { text: XSS_VECTORS.nullByte }),
    );
    expect(html).not.toContain('<script>');
  });

  it('escapes mixed RTL/LTR markers with script', () => {
    const payload = '\u200F<script>alert(1)</script>\u200E';
    const html = renderMappedComponent(
      makeNode('Text', { text: payload }),
    );
    expect(html).not.toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// Nested component prop escalation
// ---------------------------------------------------------------------------
describe('XSS: nested prop escalation', () => {
  it('escapes XSS in Select option values and labels', () => {
    const html = renderMappedComponent(
      makeNode('Select', {
        name: 'status',
        options: [
          { value: XSS_VECTORS.attrBreakout, label: XSS_VECTORS.scriptTag },
          { value: 'safe', label: '<img src=x onerror=alert(1)>' },
        ],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  it('escapes XSS in Table column headers', () => {
    const html = renderMappedComponent(
      makeNode('Table', {
        columns: [{ key: 'a', label: XSS_VECTORS.scriptTag }],
        rows: [{ a: 'safe' }],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes XSS in Table cell values', () => {
    const html = renderMappedComponent(
      makeNode('Table', {
        columns: [{ key: 'a', label: 'A' }],
        rows: [{ a: XSS_VECTORS.imgOnerror }],
      }),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('escapes XSS in Tabs label and panel content', () => {
    const html = renderMappedComponent(
      makeNode('Tabs', {
        tabs: [
          { id: 'xss-tab', label: XSS_VECTORS.scriptTag, content: XSS_VECTORS.imgOnerror },
        ],
      }),
    );
    // Tabs ships one fixed first-party behavior bootstrap. Untrusted content
    // remains escaped and never enters that script body.
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain('<script data-oods-runtime="tabs">');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img onerror=alert(1) src=x&gt;');
  });

  it('escapes XSS in timeline event fields', () => {
    const html = renderMappedComponent(
      makeNode('AuditTimeline', {
        title: XSS_VECTORS.scriptTag,
        events: [
          {
            label: XSS_VECTORS.imgOnerror,
            timestamp: XSS_VECTORS.attrBreakout,
            detail: XSS_VECTORS.svgOnload,
          },
        ],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('"><img');
  });

  it('escapes XSS in RoleBadgeList role items', () => {
    const html = renderMappedComponent(
      makeNode('RoleBadgeList', {
        roles: [XSS_VECTORS.scriptTag, XSS_VECTORS.imgOnerror],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
  });

  it('escapes XSS in TagPills tag items', () => {
    const html = renderMappedComponent(
      makeNode('TagPills', {
        tags: [XSS_VECTORS.scriptTag, XSS_VECTORS.imgOnerror],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
  });

  it('escapes XSS in form control labels and values', () => {
    const html = renderMappedComponent(
      makeNode('AddressEditor', {
        title: XSS_VECTORS.scriptTag,
        street: XSS_VECTORS.attrBreakout,
        city: XSS_VECTORS.imgOnerror,
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('"><img');
    expect(html).not.toContain('<img onerror');
  });

  it('escapes XSS in summary section fields', () => {
    const html = renderMappedComponent(
      makeNode('OwnershipSummary', {
        title: XSS_VECTORS.scriptTag,
        ownerId: XSS_VECTORS.attrBreakout,
        ownerType: XSS_VECTORS.imgOnerror,
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
  });
});

// ---------------------------------------------------------------------------
// tree-renderer: node.id injection in section wrapper (FIXED)
// ---------------------------------------------------------------------------
describe('XSS: tree-renderer section wrapper', () => {
  it('escapes malicious node.id in section data-layout-node-id attribute', () => {
    const schema = makeSchema([
      {
        id: '"><img onerror=alert(1) src=x data-x="',
        component: 'Card',
        layout: { type: 'section' },
        children: [{ id: 'safe-child', component: 'Text', props: { text: 'Content' } }],
      },
    ]);
    const html = renderTree(schema);
    // < is escaped to &lt; — no new tag creation
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    // " is escaped preventing attribute breakout
    expect(html).toContain('&quot;');
    expect(html).toContain('data-layout-node-id=');
  });

  it('escapes node.id with single-quote breakout attempt', () => {
    const schema = makeSchema([
      {
        id: "' onmouseover='alert(1)",
        component: 'Card',
        layout: { type: 'section' },
        children: [],
      },
    ]);
    const html = renderTree(schema);
    // Single quotes are escaped to &#39;
    expect(html).toContain('&#39;');
    // Attribute boundary intact — cannot break out
    expect(html).not.toContain("data-layout-node-id=\"' onmouseover=");
  });
});

// ---------------------------------------------------------------------------
// tree-renderer: token value injection in style attributes (FIXED)
// ---------------------------------------------------------------------------
describe('XSS: tree-renderer style attribute injection', () => {
  it('escapes malicious gapToken in section style attribute', () => {
    const schema = makeSchema([
      {
        id: 'section-node',
        component: 'Card',
        layout: { type: 'section', gapToken: '") onclick=alert(1) data-x=("' },
        children: [],
      },
    ]);
    const html = renderTree(schema);
    // " is escaped preventing style attribute breakout
    expect(html).toContain('&quot;');
    // The style attribute boundary holds — onclick cannot become a real attribute
    expect(html).not.toContain('style="" onclick');
  });

  it('escapes malicious spacingToken in section style attribute', () => {
    const schema = makeSchema([
      {
        id: 'section-node',
        component: 'Card',
        layout: { type: 'section' },
        style: { spacingToken: '"><script>alert(1)</script>' },
        children: [],
      },
    ]);
    const html = renderTree(schema);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });

  it('normal tokens render without double-escaping', () => {
    const schema = makeSchema([
      {
        id: 'section-node',
        component: 'Card',
        layout: { type: 'section', gapToken: 'inset-default' },
        style: { spacingToken: 'inset-compact' },
        children: [],
      },
    ]);
    const html = renderTree(schema);
    expect(html).toContain('gap:var(--sys-space-inset-default, var(--ref-space-inset-default))');
    expect(html).toContain('padding:var(--sys-space-inset-compact, var(--ref-space-inset-compact))');
    // No unintended escaping of safe values
    expect(html).not.toContain('&amp;');
    expect(html).not.toContain('&lt;');
  });
});

// ---------------------------------------------------------------------------
// document.ts: attribute injection
// ---------------------------------------------------------------------------
describe('XSS: document wrapper injection', () => {
  it('escapes script injection in title', () => {
    const html = renderDocument({
      screenHtml: '<div>safe</div>',
      title: XSS_VECTORS.scriptTag,
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes attribute breakout in theme', () => {
    const html = renderDocument({
      screenHtml: '<div>safe</div>',
      theme: XSS_VECTORS.eventHandler,
    });
    // " is escaped preventing data-theme attribute breakout
    expect(html).toContain('&quot;');
    expect(html).not.toContain('data-theme="" onmouseover');
  });

  it('escapes attribute breakout in brand', () => {
    const html = renderDocument({
      screenHtml: '<div>safe</div>',
      brand: XSS_VECTORS.attrBreakout,
    });
    // < and > escaped preventing new tags; " escaped preventing breakout
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&quot;');
  });

  it('escapes attribute breakout in lang', () => {
    const html = renderDocument({
      screenHtml: '<div>safe</div>',
      lang: '" onmouseover="alert(1)',
    });
    // " is escaped preventing lang attribute breakout
    expect(html).toContain('&quot;');
    expect(html).not.toContain('lang="" onmouseover');
  });
});

// ---------------------------------------------------------------------------
// Fragment mode: XSS vectors pass through escaping
// ---------------------------------------------------------------------------
describe('XSS: fragment mode escaping', () => {
  it('escapes XSS vectors in fragment text content', () => {
    const schema = makeSchema([
      {
        id: 'frag-screen',
        component: 'Stack',
        children: [
          { id: 'frag-xss', component: 'Text', props: { text: XSS_VECTORS.scriptTag } },
        ],
      },
    ]);
    const fragments = renderFragments(schema);
    const frag = fragments.get('frag-xss');
    expect(frag).toBeDefined();
    expect(frag!.html).not.toContain('<script>');
    expect(frag!.html).toContain('&lt;script&gt;');
  });

  it('escapes XSS vectors in fragment label prop', () => {
    const schema = makeSchema([
      {
        id: 'frag-screen',
        component: 'Stack',
        children: [
          { id: 'frag-badge', component: 'Badge', props: { label: XSS_VECTORS.imgOnerror } },
        ],
      },
    ]);
    const fragments = renderFragments(schema);
    const frag = fragments.get('frag-badge');
    expect(frag!.html).not.toContain('<img');
    expect(frag!.html).toContain('&lt;img');
  });
});

// ---------------------------------------------------------------------------
// Fallback renderer escaping
// ---------------------------------------------------------------------------
describe('XSS: fallback renderer', () => {
  it('escapes malicious component name in fallback label', () => {
    const html = renderMappedComponent(
      makeNode('<script>alert(1)</script>', {}),
    );
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('data-oods-fallback="true"');
  });
});

// ---------------------------------------------------------------------------
// Grid component: token injection through style merging
// ---------------------------------------------------------------------------
describe('XSS: Grid component token injection', () => {
  it('escapes malicious gap token in Grid component', () => {
    const html = renderMappedComponent(
      makeNode('Grid', { gap: '"><script>alert(1)</script>' }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });

  it('escapes malicious columnGap token in Grid component', () => {
    const html = renderMappedComponent(
      makeNode('Grid', { columnGap: '" onmouseover="alert(1)' }),
    );
    // " is escaped preventing style attribute breakout
    expect(html).toContain('&quot;');
    expect(html).not.toContain('style="" onmouseover');
  });

  it('normal Grid tokens render correctly', () => {
    const html = renderMappedComponent(
      makeNode('Grid', { columns: 3, gap: 'inset-default', rowGap: 'cluster-tight' }),
    );
    expect(html).toContain('--oods-grid-columns:3');
    expect(html).toContain('data-max-columns="3"');
    expect(html).toContain('--oods-layout-gap:var(--ref-space-inset-default)');
    expect(html).toContain('row-gap:var(--ref-space-scale-sm)');
  });
});

// ---------------------------------------------------------------------------
// meta.label injection
// ---------------------------------------------------------------------------
describe('XSS: meta.label injection', () => {
  it('escapes XSS in meta.label used as fallback text', () => {
    const html = renderMappedComponent(
      makeNode('Button', {}, { meta: { label: XSS_VECTORS.scriptTag } }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes XSS in meta.label on data attribute', () => {
    const html = renderMappedComponent(
      makeNode('Card', {}, { meta: { label: XSS_VECTORS.attrBreakout } }),
    );
    expect(html).not.toContain('"><img');
    expect(html).toContain('&quot;');
  });
});
