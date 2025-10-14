/**
 * ESLint rule enforcing the "pure modifier" contract: React hooks are not permitted in
 * `.modifier.ts` files. Modifiers must remain synchronous, deterministic transforms.
 */

const HOOK_PATTERN = /^use[A-Z0-9].*/u;
const DEFAULT_ALLOWLIST = new Set(['useModifier']);

function extractCalleeName(node) {
  if (!node) {
    return null;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }

  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow React hooks in modifier modules to preserve purity/determinism.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noHookUsage:
        'React hook "{{name}}" is not permitted within modifiers. Use a pure function instead.',
    },
  },
  create(context) {
    const filename = context.getFilename();

    if (!filename.endsWith('.modifier.ts') && !filename.endsWith('.modifier.tsx')) {
      return {};
    }

    const options = context.options?.[0];
    const allow = new Set(DEFAULT_ALLOWLIST);
    if (options && Array.isArray(options.allow)) {
      for (const name of options.allow) {
        if (typeof name === 'string') {
          allow.add(name);
        }
      }
    }

    return {
      CallExpression(node) {
        const name = extractCalleeName(node.callee);
        if (!name) {
          return;
        }

        if (!HOOK_PATTERN.test(name) || allow.has(name)) {
          return;
        }

        context.report({
          node,
          messageId: 'noHookUsage',
          data: { name },
        });
      },
    };
  },
};
