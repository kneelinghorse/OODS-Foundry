/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArtifactList } from '../../apps/explorer/addons/storybook-addon-agent/components/ArtifactList.js';
import type { ArtifactInfo } from '../../apps/explorer/addons/storybook-addon-agent/types.js';

const buildArtifacts = (count: number): ArtifactInfo[] =>
  Array.from({ length: count }, (_, index) => ({
    path: `artifacts/run-${index}/artifact-${index}.log`,
    name: `artifact-${index}.log`,
    purpose: `artifact purpose ${index}`,
    sizeBytes: 1024 + index,
    sha256: `1234567890abcdef${index.toString(16).padStart(2, '0')}deadbeefcafebabe`,
  }));

describe('ArtifactList component', () => {
  it('virtualises long lists and copies SHA values', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    render(
      <ArtifactList
        caption="Preview artifacts"
        artifacts={[]}
        artifactsDetail={buildArtifacts(30)}
        transcriptPath={null}
        bundleIndexPath={null}
        diagnosticsPath={null}
      />
    );

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThan(0);

    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const expectedSha = buildArtifacts(1)[0].sha256;
    expect(writeText).toHaveBeenCalledWith(expectedSha);
    expect(copyButtons[0].textContent).toBe('Copied');
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Copied full SHA');

    expect(screen.queryByText('artifact-29.log')).toBeNull();
  });

  it('renders an empty state when no artifacts exist', () => {
    render(
      <ArtifactList
        caption="Preview artifacts"
        artifacts={[]}
        artifactsDetail={[]}
        transcriptPath={null}
        bundleIndexPath={null}
        diagnosticsPath={null}
      />
    );

    screen.getByText(/No artifacts produced yet/i);
  });
});
