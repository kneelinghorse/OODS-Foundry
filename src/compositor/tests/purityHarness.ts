import { isDeepStrictEqual } from 'node:util';

type Modifier<Props extends object, Context extends object | undefined = undefined> = (
  props: Props,
  context?: Context
) => Partial<Props>;

export interface ValidateModifierPurityOptions<Context extends object | undefined = undefined> {
  readonly context?: Context;
  readonly iterations?: number;
}

function cloneValue<T>(value: T): T {
  const { structuredClone } = globalThis as { structuredClone?: (input: unknown) => unknown };
  if (typeof structuredClone === 'function') {
    return structuredClone(value) as T;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const asObject = value as object;

  if (seen.has(asObject)) {
    return value;
  }

  seen.add(asObject);

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item, seen);
    }
  } else if (value instanceof Map) {
    for (const [entryKey, entryValue] of value.entries()) {
      deepFreeze(entryKey, seen);
      deepFreeze(entryValue, seen);
    }
  } else if (value instanceof Set) {
    for (const item of value.values()) {
      deepFreeze(item, seen);
    }
  } else {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && 'value' in descriptor) {
        deepFreeze(descriptor.value, seen);
      }
    }
  }

  return Object.freeze(value);
}

function assertIsObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

export function validateModifierPurity<
  Props extends object,
  Context extends object | undefined = undefined,
>(
  modifier: Modifier<Props, Context>,
  props: Props,
  options: ValidateModifierPurityOptions<Context> = {}
): Partial<Props> {
  const iterations = options.iterations ?? 2;

  if (iterations < 2) {
    throw new Error('validateModifierPurity requires at least two iterations.');
  }

  const frozenProps = deepFreeze(cloneValue(props));
  const frozenContext = options.context ? deepFreeze(cloneValue(options.context)) : undefined;

  const results: Partial<Props>[] = [];

  for (let iteration = 0; iteration < iterations; iteration++) {
    const result = modifier(frozenProps, frozenContext);
    assertIsObject(result, 'Modifier must return an object literal representing prop changes.');
    if (result === frozenProps) {
      throw new Error('Modifier must return a new object instead of mutating its input.');
    }
    results.push(deepFreeze(result));
  }

  const [firstResult, ...remaining] = results;

  for (const result of remaining) {
    if (!isDeepStrictEqual(firstResult, result)) {
      throw new Error('Modifier produced inconsistent output across identical inputs.');
    }
  }

  return Object.freeze(firstResult);
}
