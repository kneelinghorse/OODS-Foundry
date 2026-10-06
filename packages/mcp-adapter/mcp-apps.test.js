/**
 * s213-m04: the in-conversation preview names brands by shape only; the token build says which exist.
 *
 * The adapter used to accept a composition resource's brand only when it was A or B, so a brand built later could not
 * reach the app. It now checks the id's shape (the preview host checks it against the token build and answers with the
 * known brands), and every design_preview result points the app at the live tokens resource.
 */
import { describe, expect, it } from 'vitest';
import { TOKENS_RESOURCE, parseCompositionResource, previewResources } from './mcp-apps.js';

const base = 'ui://oods-forge/compositions/cmp-0123456789ab/1/react.css';

describe('s213-m04: composition resources and the tokens resource', () => {
  it('passes any well-formed brand id through to the preview host, which checks it against the token build', () => {
    for (const brand of ['A', 'B', 'C', 'Acme']) expect(parseCompositionResource(`${base}?brand=${brand}&theme=dark`)).toMatchObject({ brand, theme: 'dark', kind: 'css' });
    for (const brand of ['A-B', '../A', '', 'A%20B']) expect(parseCompositionResource(`${base}?brand=${brand}`), brand).toBeNull();
  });

  it('points every preview at the live tokens resource', () => {
    const result = { compositionId: 'cmp-0123456789ab', version: 1, brand: 'C', theme: 'light', previews: [{ framework: 'react' }] };
    expect(TOKENS_RESOURCE).toBe('ui://oods-forge/tokens.json');
    expect(previewResources(result, null)).toMatchObject({ tokens: TOKENS_RESOURCE, styles: { react: `${base}?brand=C&theme=light` } });
  });
});
