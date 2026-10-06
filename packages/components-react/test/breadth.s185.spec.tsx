/* @vitest-environment jsdom */

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CardHeader,
  ColorSwatch,
  ColorizedBadge,
  DetailHeader,
  VizAreaPreview,
} from '../src/index.js';

afterEach(cleanup);

describe('Sprint 185 React component breadth', () => {
  it('uses real default headings and lets as take precedence over level', () => {
    const { rerender } = render(<><DetailHeader /><CardHeader /></>);
    expect(screen.getByRole('heading', { level: 2, name: 'Details' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Card' })).toBeTruthy();
    rerender(<><DetailHeader level={4} /><CardHeader as="h6" level={2} /></>);
    expect(screen.getByRole('heading', { level: 4, name: 'Details' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 6, name: 'Card' })).toBeTruthy();
  });

  it.each(['title', 'label', 'text'] as const)('renders the %s heading alias without leaking it as an attribute', alias => {
    const { container } = render(<><DetailHeader {...{ [alias]: 'Detail alias' }} /><CardHeader {...{ [alias]: 'Card alias' }} /></>);
    expect(screen.getByRole('heading', { name: 'Detail alias' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Card alias' })).toBeTruthy();
    for (const header of container.querySelectorAll('header')) expect(header.hasAttribute(alias)).toBe(false);
  });

  it.each(['subtitle', 'sublabel', 'description'] as const)('preserves the DetailHeader %s alias as visible subtitle', alias => {
    const { container } = render(<DetailHeader {...{ [alias]: 'Detail supporting' }} />);
    expect(container.querySelector('[data-oods-subtitle]')?.textContent).toBe('Detail supporting');
  });

  it.each(['metadata', 'meta'] as const)('preserves the DetailHeader %s alias as visible metadata', alias => {
    const { container } = render(<DetailHeader {...{ [alias]: 'Monthly renewal' }} />);
    expect(container.querySelector('[data-oods-metadata]')?.textContent).toBe('Monthly renewal');
  });

  it.each(['supporting', 'supportingText', 'subtitle', 'description'] as const)('preserves the CardHeader %s alias as visible supporting text', alias => {
    const { container } = render(<CardHeader {...{ [alias]: 'Card supporting' }} />);
    expect(container.querySelector('[data-oods-supporting]')?.textContent).toBe('Card supporting');
  });

  it('gives scalar field content priority and retains authored heading slots', () => {
    const { container, rerender } = render(<DetailHeader title="Static title" as="h1" subtitle="Details">Bound plan name</DetailHeader>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bound plan name');
    expect(container.querySelector('[data-oods-subtitle]')?.textContent).toBe('Details');
    rerender(<CardHeader title="Static title">{['Plan ', 2]}</CardHeader>);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Plan 2');
    rerender(<DetailHeader title="Ignored"><h5>Authored title</h5><p>Authored copy</p></DetailHeader>);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 5 }).textContent).toBe('Authored title');
    expect(container.querySelector('header > p')?.textContent).toBe('Authored copy');
  });

  it('uses nonempty aliases and treats empty children as absent', () => {
    const { container } = render(<>
      <DetailHeader title=" " label="Detail fallback" subtitle="" sublabel="Subtitle fallback">{' '}</DetailHeader>
      <CardHeader title="" text="Card fallback" supporting=" " description="Supporting fallback">{false}</CardHeader>
    </>);
    expect(screen.getByRole('heading', { name: 'Detail fallback' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Card fallback' })).toBeTruthy();
    expect(container.querySelector('[data-oods-subtitle]')?.textContent).toBe('Subtitle fallback');
    expect(container.querySelector('[data-oods-supporting]')?.textContent).toBe('Supporting fallback');
  });

  it.each([
    ['DetailHeader', DetailHeader, 'h2'],
    ['CardHeader', CardHeader, 'h2'],
    ['ColorSwatch', ColorSwatch, '[data-oods-swatch-label]'],
    ['ColorizedBadge', ColorizedBadge, '[data-oods-badge-label]'],
  ] as const)('preserves authored word separators in %s while blank content falls back', (_name, Component, selector) => {
    const { container, rerender } = render(<Component label="Fallback">{['Alpha', ' ', 'Beta']}</Component>);
    expect(container.querySelector(selector)?.textContent).toBe('Alpha Beta');
    rerender(<Component label="Fallback"><>{'Alpha'}{' '}{2}</></Component>);
    expect(container.querySelector(selector)?.textContent).toBe('Alpha 2');
    rerender(<Component label="Fallback"><>{' \n '}{'\t'}</></Component>);
    expect(container.querySelector(selector)?.textContent).toBe('Fallback');
  });

  it('flattens scalar fragments and ignores empty fragments when choosing heading and preview content', () => {
    const { container, rerender } = render(<><DetailHeader><>{'Plan '}{2}</></DetailHeader><CardHeader><>{' '}</></CardHeader></>);
    expect(screen.getByRole('heading', { level: 2, name: 'Plan 2' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Card' })).toBeTruthy();
    rerender(<VizAreaPreview><>{false}{' '}<></></></VizAreaPreview>);
    expect(container.querySelector('[data-viz-preview-placeholder]')?.textContent).toBe('Area preview (640 x 360)');
    rerender(<ColorSwatch color="default" />);
    expect(container.querySelector<HTMLElement>('[data-oods-component="ColorSwatch"]')?.style.getPropertyValue('--oods-swatch-color')).toBe('');
  });

  it.each(['color', 'value', 'state'] as const)('uses ColorSwatch.%s as the chip color and visible fallback label', alias => {
    const { container } = render(<ColorSwatch {...{ [alias]: 'rebeccapurple' }} />);
    const swatch = container.querySelector<HTMLElement>('[data-oods-component="ColorSwatch"]')!;
    expect(swatch.dataset.swatchColor).toBe('rebeccapurple');
    expect(swatch.style.getPropertyValue('--oods-swatch-color')).toBe('rebeccapurple');
    expect(swatch.querySelector('[data-oods-swatch-label]')?.textContent).toBe('rebeccapurple');
    expect(swatch.querySelector('[data-oods-swatch-chip]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps visible color labels when color or authored elements cannot convey meaning', () => {
    const { container, rerender } = render(<><ColorSwatch /><ColorizedBadge /></>);
    expect(container.querySelector('[data-oods-swatch-label]')?.textContent).toBe('default');
    expect(container.querySelector('[data-oods-badge-label]')?.textContent).toBe('Color');
    expect(container.querySelector('[data-oods-component="ColorizedBadge"]')?.getAttribute('data-badge-variant')).toBe('colorized');
    rerender(<>
      <ColorSwatch color="blue" label="Primary"><span aria-hidden="true">*</span></ColorSwatch>
      <ColorizedBadge label="Reviewed"><span aria-hidden="true">*</span></ColorizedBadge>
    </>);
    expect(container.querySelector('[data-oods-swatch-label]')?.textContent).toBe('Primary');
    expect(container.querySelector('[data-oods-badge-label]')?.textContent).toBe('Reviewed');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(4);
    rerender(<><ColorSwatch label="Static">Bound swatch</ColorSwatch><ColorizedBadge label="Static">Bound badge</ColorizedBadge></>);
    expect(container.querySelector('[data-oods-swatch-label]')?.textContent).toBe('Bound swatch');
    expect(container.querySelector('[data-oods-badge-label]')?.textContent).toBe('Bound badge');
  });

  it.each(['label', 'text', 'state', 'value'] as const)('renders ColorizedBadge.%s as a noninteractive visible label', alias => {
    const { container } = render(<ColorizedBadge {...{ [alias]: 'Approved' }} />);
    expect(container.querySelector('[data-oods-badge-label]')?.textContent).toBe('Approved');
    expect(container.querySelector('button, input, a, [tabindex]')).toBeNull();
  });

  it.each(['color', 'hue', 'swatch', 'state'] as const)('uses ColorizedBadge.%s for its decorative color marker', alias => {
    const { container } = render(<ColorizedBadge {...{ [alias]: '#15803d' }} label="Approved" />);
    const badge = container.querySelector<HTMLElement>('[data-oods-component="ColorizedBadge"]')!;
    expect(badge.classList.contains('oods-badge')).toBe(true);
    expect(badge.dataset.badgeColor).toBe('#15803d');
    expect(badge.style.getPropertyValue('--oods-badge-color')).toBe('#15803d');
    expect(badge.querySelector('[data-oods-badge-marker]')?.getAttribute('aria-hidden')).toBe('true');
    expect(badge.querySelector('[data-oods-badge-label]')?.textContent).toBe('Approved');
  });

  it('retains Badge emphasis and tone while keeping the colorized variant default independent', () => {
    const { container, rerender } = render(<ColorizedBadge status="active" tone="warning" emphasis="solid" label="Review" />);
    let badge = container.querySelector<HTMLElement>('[data-oods-component="ColorizedBadge"]')!;
    expect(badge.dataset).toMatchObject({ badgeStatus: 'active', badgeVariant: 'colorized', tone: 'warning', emphasis: 'solid' });
    rerender(<ColorizedBadge variant="custom" tone="info" />);
    badge = container.querySelector<HTMLElement>('[data-oods-component="ColorizedBadge"]')!;
    expect(badge.dataset.badgeVariant).toBe('custom');
    expect(badge.dataset.tone).toBe('info');
  });

  it('renders only a preview frame and chooses authored content over the empty placeholder', () => {
    const { container, rerender } = render(<VizAreaPreview />);
    const frame = container.querySelector<HTMLElement>('[data-oods-component="VizAreaPreview"]')!;
    expect(frame.dataset).toMatchObject({ vizPreviewType: 'area', vizWidth: '640', vizHeight: '360' });
    expect(frame.style.getPropertyValue('--oods-viz-width')).toBe('640px');
    expect(frame.style.getPropertyValue('--oods-viz-height')).toBe('360px');
    expect(frame.querySelector('[data-viz-preview-placeholder]')?.textContent).toBe('Area preview (640 x 360)');
    rerender(<VizAreaPreview width={320} height={180}>{' '}{false}</VizAreaPreview>);
    expect(frame.querySelector('[data-viz-preview-placeholder]')?.textContent).toBe('Area preview (320 x 180)');
    rerender(<VizAreaPreview width={320} height={180}><p>Authored area content</p></VizAreaPreview>);
    expect(frame.querySelector('p')?.textContent).toBe('Authored area content');
    expect(frame.querySelector('[data-viz-preview-placeholder]')).toBeNull();
    expect(frame.querySelector('svg, canvas')).toBeNull();
  });

  it('forwards refs and native attributes to each canonical root', () => {
    const detail = React.createRef<HTMLElement>();
    const card = React.createRef<HTMLElement>();
    const swatch = React.createRef<HTMLSpanElement>();
    const badge = React.createRef<HTMLSpanElement>();
    const preview = React.createRef<HTMLDivElement>();
    render(<>
      <DetailHeader ref={detail} id="detail" className="custom" />
      <CardHeader ref={card} id="card" />
      <ColorSwatch ref={swatch} id="swatch" />
      <ColorizedBadge ref={badge} id="badge" />
      <VizAreaPreview ref={preview} id="preview" />
    </>);
    for (const [ref, id] of [[detail, 'detail'], [card, 'card'], [swatch, 'swatch'], [badge, 'badge'], [preview, 'preview']] as const) {
      expect(ref.current).toBe(document.getElementById(id));
      expect(ref.current?.getAttribute('data-oods-component')).toBeTruthy();
    }
    expect(detail.current?.classList.contains('custom')).toBe(true);
  });
});
