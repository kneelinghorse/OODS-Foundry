/**
 * s222-m02 (#2502 ruling 11): status marks are SVG icons, not Unicode glyphs, so a badge or banner draws the same mark
 * in every font and renderer. One 16-unit grid, stroked in the text colour (1.5 wide, round caps and joins), so each
 * mark keeps the tone's graded text contrast and reads at a badge's 12px and a banner's 16px. React, Vue and HTML all
 * draw from this table.
 */
export type StatusIconName =
  | 'check' | 'x' | 'alert' | 'info' | 'clock' | 'dots' | 'refresh' | 'pause' | 'ban' | 'pencil' | 'star' | 'undo'
  | 'lock' | 'unlock' | 'dot'
  // s223-m02 (#2527 ruling 11): the combobox's chevron, on the same grid; it is no status and no status alias names it.
  | 'chevron-down';

export type StatusIconShape = {
  readonly tag: 'path' | 'circle' | 'rect';
  readonly attrs: Readonly<Record<string, string>>;
};

const path = (d: string): StatusIconShape => ({ tag: 'path', attrs: { d } });
const circle = (cx: string, cy: string, r: string, filled = false): StatusIconShape => ({
  tag: 'circle',
  attrs: filled ? { cx, cy, r, fill: 'currentColor', stroke: 'none' } : { cx, cy, r },
});

export const STATUS_ICON_SHAPES: Readonly<Record<StatusIconName, readonly StatusIconShape[]>> = Object.freeze({
  check: [path('M3.5 8.5l3 3 6-7')],
  x: [path('M4.5 4.5l7 7M11.5 4.5l-7 7')],
  alert: [path('M8 2.5l6 11H2z'), path('M8 6.5v3'), circle('8', '11.5', '0.75', true)],
  info: [circle('8', '8', '6'), path('M8 7.5V11'), circle('8', '5', '0.75', true)],
  clock: [circle('8', '8', '6'), path('M8 5v3l2 1.5')],
  dots: [circle('4', '8', '1', true), circle('8', '8', '1', true), circle('12', '8', '1', true)],
  refresh: [path('M13 8a5 5 0 1 1-1.5-3.5'), path('M13 2.5v3h-3')],
  pause: [path('M6 4v8M10 4v8')],
  ban: [circle('8', '8', '6'), path('M3.8 12.2l8.4-8.4')],
  pencil: [path('M10.5 3L13 5.5 6 12.5H3.5V10z')],
  star: [path('M8 2.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z')],
  undo: [path('M3 8a5 5 0 1 0 1.5-3.5'), path('M3 2.5v3h3')],
  lock: [{ tag: 'rect', attrs: { x: '3.5', y: '7', width: '9', height: '6.5', rx: '1.5' } }, path('M5.5 7V5a2.5 2.5 0 0 1 5 0v2')],
  unlock: [{ tag: 'rect', attrs: { x: '3.5', y: '7', width: '9', height: '6.5', rx: '1.5' } }, path('M5.5 7V5a2.5 2.5 0 0 1 4.8-1')],
  dot: [circle('8', '8', '2.5', true)],
  'chevron-down': [path('M4 6l4 4 4-4')],
});

/** The outer svg element's attributes, in the order every renderer writes them. It is 1em square, so it takes the size of
 * the text it sits in wherever no stylesheet sizes it. */
export const STATUS_ICON_SVG_ATTRS: Readonly<Record<string, string>> = Object.freeze({
  width: '1em',
  height: '1em',
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  focusable: 'false',
});

// The status registry's icon names end in these segments (icon.status.success, …); each takes one mark. They are the keys
// the Unicode glyph table had, so every status keeps the mark it had.
const STATUS_ICON_ALIASES: Readonly<Record<string, StatusIconName>> = Object.freeze({
  success: 'check', paid: 'check',
  warning: 'alert',
  critical: 'x', danger: 'x', error: 'x', negative: 'x',
  pending: 'dots', processing: 'refresh', paused: 'pause',
  canceled: 'ban', cancelled: 'ban', void: 'ban',
  draft: 'pencil', info: 'info', trial: 'star', future: 'clock', scheduled: 'clock', refunded: 'undo',
  locked: 'lock', unlocked: 'unlock', default: 'dot',
});

/** The mark for a registry icon name; an unknown name takes the neutral dot, and no name takes no mark. */
export function resolveStatusIcon(iconName: string | undefined): StatusIconName | undefined {
  const segment = iconName?.split('.').pop()?.toLowerCase();
  if (!segment) return undefined;
  return STATUS_ICON_ALIASES[segment] ?? 'dot';
}

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attributes = (attrs: Readonly<Record<string, string>>) =>
  Object.entries(attrs).map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join('');

/** The mark as markup, for renderers that write HTML strings. */
export function statusIconMarkup(name: StatusIconName): string {
  const shapes = STATUS_ICON_SHAPES[name].map((shape) => `<${shape.tag}${attributes(shape.attrs)}></${shape.tag}>`).join('');
  return `<svg${attributes(STATUS_ICON_SVG_ATTRS)}>${shapes}</svg>`;
}
