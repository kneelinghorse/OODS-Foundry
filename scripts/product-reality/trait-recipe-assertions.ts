import { expect } from 'vitest';

/** Both framework scenarios assert the same authored trait meaning, beyond mounting. */
export function assertTraitRecipeScenario(id: string, root: Element) {
  const text = root.textContent;
  switch (id) {
    case 'ArchiveEvent':
      expect(Array.from(root.querySelectorAll('time')).map(node => node.getAttribute('datetime'))).toEqual(['2026-09-01T12:00:00Z', '2026-09-02T12:00:00Z']);
      expect(text).toContain('Actor: operator-1'); expect(text).toContain('Reason: Duplicate record'); break;
    case 'CancellationEvent':
      expect(text).toContain('Cancellation requested'); expect(text).toContain('Reason: Customer request'); expect(text).toContain('Code: Customer Request'); break;
    case 'StateTransitionEvent':
      expect(text).toContain('Draft → Active'); expect(text).toContain('Actor: operator-1'); expect(text).toContain('Reason: Approved'); break;
    case 'CommunicationDetailPanel':
      for (const value of ['Email', 'Welcome', 'Retry once', 'Support: delivered']) expect(text).toContain(value);
      expect(root.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite'); break;
    case 'ColorStatePicker':
      expect(root.tagName).toBe('FIELDSET');
      expect(Array.from(root.querySelectorAll('option')).map(node => node.value)).toEqual(['neutral', 'success']);
      expect(root.querySelector('select')?.value).toBe('neutral'); break;
    case 'StatusColorLegend':
      expect(text).toContain('success (current)'); expect(text).toContain('--sys-status-success-surface');
      expect(root.querySelectorAll('[data-oods-swatch-chip]')).toHaveLength(2); break;
    case 'GeoFieldMappingForm':
      expect(root.tagName).toBe('FORM');
      expect(Array.from(root.querySelectorAll<HTMLInputElement>('input[type="text"]')).map(node => node.value)).toEqual(['lat', 'lon', 'country']);
      expect(root.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false); break;
    case 'GeoResolutionBadge': expect(text).toBe('Resolution: point'); break;
    case 'GeocodablePreview': expect(Array.from(root.querySelectorAll('dd')).map(node => node.textContent)).toEqual(['point', 'No', 'lat, lon']); break;
    default: throw new Error(`No authored trait recipe assertion for ${id}`);
  }
}
