/**
 * ESLint Rule: no-unsafe-tenancy-override
 *
 * Prevents production code from mutating TenancyContext manually.
 * Tenancy overrides are only allowed in tests or dedicated tenancy scripts.
 *
 * @module eslint/rules/no-unsafe-tenancy-override
 */

const ALLOWED_PATH_PATTERNS = [
  /(^|\/)tests\//,
  /(^|\/)__tests__\//,
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /(^|\/)stories\//,
  /(^|\/)scripts\/tenancy\//,
];

const isAllowedFile = (filename) => {
  if (!filename || filename === '<input>') {
    return false;
  }
  return ALLOWED_PATH_PATTERNS.some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(filename);
    }
    return filename.includes(pattern);
  });
};

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unsafe TenancyContext overrides outside test harnesses',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noManualTenantOverride:
        'Do not call TenancyContext.{{method}}() outside authorised test harnesses. Use withTenant() or dependency injection for production code.',
      noConfigMutation:
        'Mutating TenancyContext configuration is unsafe. Configure tenancy via environment variables or initialization parameters.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();
    const allowed = isAllowedFile(filename);

    const reports = [];

    const reportManualOverride = (node, method) => {
      if (allowed) {
        return;
      }
      reports.push({ node, method });
    };

    const reportConfigMutation = (node) => {
      if (allowed) {
        return;
      }
      context.report({
        node,
        messageId: 'noConfigMutation',
      });
    };

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.object &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'TenancyContext' &&
          node.callee.property &&
          node.callee.property.type === 'Identifier'
        ) {
          const method = node.callee.property.name;
          if (method === 'setCurrentTenant' || method === 'reset' || method === 'setCurrentTenantSync') {
            reportManualOverride(node, method);
          }
        }
      },
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          !node.left.computed &&
          node.left.object &&
          node.left.object.type === 'MemberExpression' &&
          node.left.object.object &&
          node.left.object.object.type === 'Identifier' &&
          node.left.object.object.name === 'TenancyContext' &&
          node.left.object.property &&
          node.left.object.property.type === 'Identifier' &&
          node.left.object.property.name === 'config'
        ) {
          reportConfigMutation(node);
        }
      },
      'Program:exit'() {
        for (const entry of reports) {
          context.report({
            node: entry.node,
            messageId: 'noManualTenantOverride',
            data: { method: entry.method },
          });
        }
      },
    };
  },
};
