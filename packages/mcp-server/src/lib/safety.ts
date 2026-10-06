const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function isUnsafeKey(key: string): boolean {
  return UNSAFE_KEYS.has(key);
}

