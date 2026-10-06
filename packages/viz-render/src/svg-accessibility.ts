/** Headless engines cannot rely on DOM-driven ARIA. Keep metadata in the rendered bytes shared by render/certify. */
export function accessibleSvg(svg: string, title: unknown, description: unknown): string {
  const label = (Array.isArray(title) ? title.join(' ') : typeof title === 'string' ? title : '').trim()
    || (typeof description === 'string' ? description.trim() : '') || 'Chart';
  const detail = typeof description === 'string' && description.trim() ? description.trim() : label;
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  return svg.replace(/^<svg\b([^>]*)>/, (_root, attributes: string) => {
    const rest = attributes.replace(/\s+(?:role|aria-label|aria-description)=(?:"[^"]*"|'[^']*')/g, '');
    return `<svg${rest} role="img" aria-label="${escape(label)}" aria-description="${escape(detail)}"><title>${escape(label)}</title><desc>${escape(detail)}</desc>`;
  });
}
