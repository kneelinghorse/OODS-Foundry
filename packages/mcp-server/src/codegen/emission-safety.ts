export function tokenOverrideVariableName(key: string): string {
  const normalized = key
    .trim()
    .replace(/[.\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/gu, (character) => {
      return `-${character.codePointAt(0)!.toString(16)}-`;
    });
  return `--token-${normalized || 'override'}`;
}

export function escapeBlockComment(value: string): string {
  return value.replace(/\*\//g, '*\\/');
}

export function escapeVueScriptComment(value: string): string {
  return escapeBlockComment(value).replace(/<\/script/gi, (closingTag) => (
    `\\x3c${closingTag.slice(1)}`
  ));
}

export function escapeDoubleQuotedAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, (character) => (
      `&#${character.codePointAt(0)!};`
    ))
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function javascriptSingleQuotedString(value: string): string {
  let literal = "'";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    switch (character) {
      case "'": literal += "\\'"; break;
      case '\\': literal += '\\\\'; break;
      case '"': literal += '\\x22'; break;
      case '&': literal += '\\x26'; break;
      case '<': literal += '\\x3c'; break;
      case '>': literal += '\\x3e'; break;
      case '\b': literal += '\\b'; break;
      case '\f': literal += '\\f'; break;
      case '\n': literal += '\\n'; break;
      case '\r': literal += '\\r'; break;
      case '\t': literal += '\\t'; break;
      default:
        literal += codePoint === 0x2028 || codePoint === 0x2029 || codePoint < 0x20
          ? `\\u${codePoint.toString(16).padStart(4, '0')}`
          : character;
    }
  }
  return `${literal}'`;
}

export function serializeJavaScriptJson(value: unknown, space?: number): string {
  const serialized = JSON.stringify(value, null, space);
  if (serialized === undefined) return 'undefined';
  return serialized
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const UNSAFE_CSS_TEXT = new Set([
  '<', '>', '{', '}', ';', '@', '\\', '/', '*', "'", '"',
]);

export function escapeCssCustomPropertyValue(value: string): string {
  let escaped = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    escaped += UNSAFE_CSS_TEXT.has(character) || codePoint < 0x20 || codePoint === 0x7f
      ? `\\${codePoint.toString(16)} `
      : character;
  }
  return escaped;
}
