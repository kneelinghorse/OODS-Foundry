import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'module';
import { TraitCompositor, composeTraits, PageHeader } from '@oods/trait-engine';

const require = createRequire(import.meta.url);
const provenance = require('@oods/trait-engine/provenance.json');

if (typeof TraitCompositor !== 'function') {
  throw new Error('TraitCompositor export is unavailable');
}

if (typeof composeTraits !== 'function') {
  throw new Error('composeTraits export is unavailable');
}

const compositor = new TraitCompositor();
if (typeof compositor.compose !== 'function') {
  throw new Error('TraitCompositor instance is missing compose');
}

const subtitle =
  typeof provenance.sb_build_hash === 'string' && provenance.sb_build_hash !== 'unavailable'
    ? `sb:${provenance.sb_build_hash.slice(0, 12)}`
    : 'sb:pending';

const markup = renderToString(
  React.createElement(PageHeader, {
    title: 'Trait Engine Sample',
    subtitle,
    description: 'Internal package smoke render',
    actions: [],
  })
);

if (!markup.includes('Trait Engine Sample')) {
  throw new Error('Failed to render PageHeader component');
}

if (typeof provenance.vr_baseline_id !== 'string') {
  throw new Error('Provenance metadata missing vr_baseline_id');
}

console.log('Trait Engine smoke test passed.');
console.log('  Storybook hash:', provenance.sb_build_hash);
console.log('  VR baseline id:', provenance.vr_baseline_id);
