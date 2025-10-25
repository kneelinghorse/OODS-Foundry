/**
 * ESLint Rule: no-naive-date
 * 
 * Prevents direct Date construction and Date.now() usage
 * to enforce TimeService dual-time convention.
 * 
 * See: docs/policies/time.md
 * 
 * @type {import('eslint').Rule.RuleModule}
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce TimeService usage instead of naive Date operations',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/your-org/oods-foundry/blob/main/docs/policies/time.md',
    },
    messages: {
      noNewDate: 'Direct `new Date()` is forbidden. Use `TimeService.nowSystem()` or `TimeService.nowBusiness(tenant)` instead.',
      noDateNow: 'Direct `Date.now()` is forbidden. Use `TimeService.nowSystem()` instead.',
      noDateConstructor: 'Direct Date construction is forbidden. Use TimeService methods for temporal operations.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowInTests: {
            type: 'boolean',
            default: false,
          },
          allowedFiles: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowInTests = options.allowInTests ?? false;
    const allowedFiles = options.allowedFiles ?? [];

    const filename = context.getFilename();
    const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filename);
    const isAllowedFile = allowedFiles.some((pattern) => filename.includes(pattern));

    // Skip if in test file and tests are allowed, or if file is explicitly allowed
    if ((allowInTests && isTestFile) || isAllowedFile) {
      return {};
    }

    return {
      // Detect: new Date()
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'Date'
        ) {
          // Check for inline disable comment
          const sourceCode = context.getSourceCode();
          const commentsBefore = sourceCode.getCommentsBefore(node);
          const hasDisableComment = commentsBefore.some((comment) =>
            comment.value.includes('eslint-disable-next-line no-naive-date')
          );

          if (hasDisableComment) {
            return;
          }

          context.report({
            node,
            messageId: 'noNewDate',
          });
        }
      },

      // Detect: Date.now()
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Date' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'now'
        ) {
          // Check for inline disable comment
          const sourceCode = context.getSourceCode();
          const commentsBefore = sourceCode.getCommentsBefore(node);
          const hasDisableComment = commentsBefore.some((comment) =>
            comment.value.includes('eslint-disable-next-line no-naive-date')
          );

          if (hasDisableComment) {
            return;
          }

          context.report({
            node,
            messageId: 'noDateNow',
          });
        }
      },

      // Detect: Date.parse(), Date.UTC() (informational)
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'Date' &&
          node.property.type === 'Identifier' &&
          (node.property.name === 'parse' || node.property.name === 'UTC')
        ) {
          const sourceCode = context.getSourceCode();
          const commentsBefore = sourceCode.getCommentsBefore(node);
          const hasDisableComment = commentsBefore.some((comment) =>
            comment.value.includes('eslint-disable-next-line no-naive-date')
          );

          if (hasDisableComment) {
            return;
          }

          // Only warn for Date.parse and Date.UTC if they're being called
          const parent = node.parent;
          if (parent && parent.type === 'CallExpression' && parent.callee === node) {
            context.report({
              node: parent,
              messageId: 'noDateConstructor',
            });
          }
        }
      },
    };
  },
};

