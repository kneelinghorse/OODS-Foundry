/**
 * s220-m02: Style Dictionary 5 catches a transform that throws, logs a warning and carries on with a fallback value, where
 * 4.4.0 stopped the build. A token build must still fail on it: a brand built with a silently wrong value is worse than
 * no build. `recordTransformFailures` wraps every registered transform so a throw, or a rejected promise, is recorded;
 * `assertNoTransformFailures` fails the build with the list once it has run.
 */
export function recordTransformFailures(StyleDictionary) {
  const failures = [];
  for (const [name, hook] of Object.entries(StyleDictionary.hooks.transforms)) {
    const transform = hook.transform;
    const record = (token, error) => failures.push(`${name}: ${(token?.path ?? []).join('.')}: ${error?.message ?? String(error)}`);
    StyleDictionary.registerTransform({
      ...hook,
      name,
      transform: (token, ...rest) => {
        try {
          const result = transform(token, ...rest);
          return result && typeof result.then === 'function' ? result.catch((error) => { record(token, error); throw error; }) : result;
        } catch (error) {
          record(token, error);
          throw error;
        }
      },
    });
  }
  return failures;
}

export function assertNoTransformFailures(failures) {
  if (failures.length) throw new Error(`Token transforms failed (${failures.length}):\n${[...new Set(failures)].join('\n')}`);
}
