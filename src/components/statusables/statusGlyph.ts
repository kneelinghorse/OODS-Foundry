const ICON_GLYPHS: Record<string, string> = {
  success: '✔︎',
  warning: '⚠︎',
  critical: '⨯',
  danger: '⨯',
  error: '⨯',
  negative: '⨯',
  pending: '…',
  processing: '⟳',
  paused: '⏸',
  canceled: '∅',
  cancelled: '∅',
  draft: '✎',
  void: '∅',
  paid: '✔︎',
  info: 'ℹ︎',
  trial: '★',
  future: '⏲',
  refunded: '↺',
  locked: '🔒',
  unlocked: '🔓',
  default: '•',
};

export function resolveStatusGlyph(iconName: string | undefined): string | undefined {
  if (!iconName) {
    return undefined;
  }

  const segment = iconName.split('.').pop()?.toLowerCase();
  if (!segment) {
    return undefined;
  }

  return ICON_GLYPHS[segment] ?? ICON_GLYPHS.default;
}

export function defaultStatusGlyph(): string {
  return ICON_GLYPHS.default;
}
