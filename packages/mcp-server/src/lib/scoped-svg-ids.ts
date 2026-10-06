/** Give an embedded render its own identities and references, preserving authored labels and text. */
export function scopedSvgIds(svg: string, scope: string): string {
  const token = (value: string) => value.replace(/^oods-(id|zr)-(\d+)$/, `oods-$1-${scope}-$2`);
  const references = new Set(['fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end', 'cursor', 'style']);
  const css = (value: string, selectors: boolean): string => {
    let declaration = !selectors;
    // The renderer emits flat CSS rules. Comments and quoted literals are consumed whole before
    // looking for selectors or URLs; the quotes inside a real url() belong to that reference.
    return value.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\(\s*(?:"#oods-(?:id|zr)-\d+"|'#oods-(?:id|zr)-\d+'|#oods-(?:id|zr)-\d+)\s*\)|[{}]|[.#]oods-(?:id|zr)-\d+(?![\w-])/gi, part => {
      if (part === '{') declaration = true;
      else if (part === '}') declaration = !selectors;
      else if (/^url\(/i.test(part)) return part.replace(/oods-(?:id|zr)-\d+/, token);
      else if (!declaration && /^[.#]/.test(part)) return part[0] + token(part.slice(1));
      return part;
    });
  };
  const tag = (markup: string): string => {
    if (/^<\s*(?:\/|!|\?)/.test(markup)) return markup;
    return markup.replace(/(\s+)([\w:-]+)(\s*=\s*)(["'])([\s\S]*?)\4/g, (attribute, space, name, equals, quote, value: string) => {
      const key = name.toLowerCase();
      let scoped = value;
      if (key === 'id') scoped = token(value);
      else if (['class', 'aria-labelledby', 'aria-describedby'].includes(key)) scoped = value.replace(/\S+/g, token);
      else if ((key === 'href' || key === 'xlink:href') && value.startsWith('#')) scoped = `#${token(value.slice(1))}`;
      else if (references.has(key)) scoped = css(value, false);
      return scoped === value ? attribute : `${space}${name}${equals}${quote}${scoped}${quote}`;
    });
  };
  return svg.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>|<[^>]+>/gi, markup => {
    if (!/^<style\b/i.test(markup)) return tag(markup);
    const start = markup.indexOf('>') + 1, end = markup.toLowerCase().lastIndexOf('</style');
    return tag(markup.slice(0, start)) + css(markup.slice(start, end), true) + markup.slice(end);
  });
}
