/**
 * Tests for MapControls component.
 */

import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapControls } from '../../../../src/components/viz/spatial/MapControls.js';

describe('MapControls', () => {
  it('calls zoom handlers', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomReset = vi.fn();

    render(
      <MapControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
        zoomLevel={1}
        position="top-left"
      />
    );

    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Reset zoom'));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onZoomReset).toHaveBeenCalledTimes(1);
  });

  it('toggles layers and updates checkbox state', () => {
    const onLayerToggle = vi.fn();
    const layers = [
      { id: 'regions', label: 'Regions', visible: true },
      { id: 'symbols', label: 'Symbols', visible: false },
    ];

    render(<MapControls layers={layers} onLayerToggle={onLayerToggle} position="bottom-right" />);

    const checkbox = screen.getByLabelText('Toggle Regions') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(onLayerToggle).toHaveBeenCalledWith('regions', false);
    expect(checkbox.checked).toBe(false);
  });

  it('shows current zoom value', () => {
    render(<MapControls onZoomIn={() => {}} onZoomOut={() => {}} zoomLevel={1.5} />);
    expect(screen.getByText(/1\.5x/)).toBeInTheDocument();
  });
});
