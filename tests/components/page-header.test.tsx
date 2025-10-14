import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHeader } from '../../src/components/page/PageHeader.js';

describe('<PageHeader>', () => {
  it('renders text, badges, and actions with OODS primitives', () => {
    const markup = renderToStaticMarkup(
      <PageHeader
        title="User Account"
        subtitle="Account"
        description="Manage account status and billing"
        badges={[
          { id: 'status-active', label: 'Active', tone: 'success' },
          { id: 'status-risk', label: 'At Risk', tone: 'danger' },
        ]}
        actions={[
          { id: 'primary', label: 'Edit', intent: 'success' },
          { id: 'secondary', label: 'Disable', intent: 'danger' },
        ]}
        metadata={<span>Last updated 2d ago</span>}
      />
    );

    expect(markup.startsWith('<header')).toBe(true);
    expect(markup).toContain('bg-emerald-50'); // success badge
    expect(markup).toContain('bg-rose-50'); // danger badge
    expect(markup).toContain('bg-emerald-600'); // success button
    expect(markup).toContain('bg-rose-600'); // danger button
  });
});
