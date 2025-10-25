/**
 * ESLint Rule: no-provider-leakage (CommonJS build)
 *
 * Prevents billing provider-specific terminology (Stripe, Chargebee, Zuora)
 * from appearing in core packages and UI code.
 *
 * This file mirrors the TypeScript implementation located at
 * packages/eslint-plugin-oods/rules/no-provider-leakage.ts.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const DEFAULT_ALLOWED_PATHS = [
  '**/src/integrations/billing/**',
  '**/tests/integrations/billing/**',
  '**/fixtures/billing/**',
  '**/domains/saas-billing/**',
];

const PROVIDER_TERMS = new Set([
  // Stripe
  'stripe',
  'Stripe',
  'STRIPE',
  'StripeSubscription',
  'StripeInvoice',
  'StripeCustomer',
  'StripePaymentIntent',

  // Chargebee
  'chargebee',
  'Chargebee',
  'CHARGEBEE',
  'ChargebeeSubscription',
  'ChargebeeInvoice',
  'ChargebeeCustomer',

  // Zuora
  'zuora',
  'Zuora',
  'ZUORA',
  'ZuoraSubscription',
  'ZuoraInvoice',
  'ZuoraAccount',
]);

const PROVIDER_ID_PATTERNS = [
  /sub_[a-zA-Z0-9]+/,
  /in_[a-zA-Z0-9]+/,
  /cus_[a-zA-Z0-9]+/,
  /pi_[a-zA-Z0-9]+/,
  /cb_sub_[a-zA-Z0-9]+/,
  /cb_inv_[a-zA-Z0-9]+/,
  /cb_cus_[a-zA-Z0-9]+/,
];

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');

  return new RegExp(`^${escaped}$`);
}

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent billing provider terminology from leaking into core code',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      providerLeakage:
        'Provider-specific term "{{provider}}" detected outside adapter boundary. Use canonical billing types instead.',
      providerIdentifier:
        'Provider identifier "{{identifier}}" found in {{location}}. Provider IDs should only appear in adapter modules and their tests.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedPaths: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedPaths = options.allowedPaths || DEFAULT_ALLOWED_PATHS;
    const filename = normalizePath(context.getFilename());
    const allowed = allowedPaths.some((pattern) => globToRegExp(pattern).test(filename));

    if (allowed) {
      return {};
    }

    const reportIfProviderTerm = (value, node) => {
      for (const term of PROVIDER_TERMS) {
        if (value.includes(term)) {
          context.report({
            node,
            messageId: 'providerLeakage',
            data: { provider: term },
          });
          return true;
        }
      }
      return false;
    };

    const reportIfProviderId = (value, node, location) => {
      for (const pattern of PROVIDER_ID_PATTERNS) {
        if (pattern.test(value)) {
          context.report({
            node,
            messageId: 'providerIdentifier',
            data: {
              identifier: value,
              location,
            },
          });
          return true;
        }
      }
      return false;
    };

    const checkLiteral = (node) => {
      if (typeof node.value !== 'string') {
        return;
      }

      if (!reportIfProviderTerm(node.value, node)) {
        reportIfProviderId(node.value, node, 'string literal');
      }
    };

    const checkTemplateLiteral = (node) => {
      for (const quasi of node.quasis) {
        const text = quasi.value.cooked ?? quasi.value.raw ?? '';
        if (reportIfProviderTerm(text, quasi)) {
          return;
        }
        if (reportIfProviderId(text, quasi, 'template literal')) {
          return;
        }
      }
    };

    return {
      Identifier(node) {
        if (PROVIDER_TERMS.has(node.name)) {
          context.report({
            node,
            messageId: 'providerLeakage',
            data: { provider: node.name },
          });
        }
      },

      Literal: checkLiteral,

      TemplateLiteral: checkTemplateLiteral,

      Property(node) {
        if (node.key.type === 'Identifier' && PROVIDER_TERMS.has(node.key.name)) {
          context.report({
            node: node.key,
            messageId: 'providerLeakage',
            data: { provider: node.key.name },
          });
        }
      },

      ImportDeclaration(node) {
        if (typeof node.source.value !== 'string') {
          return;
        }

        const source = node.source.value.toLowerCase();
        for (const term of PROVIDER_TERMS) {
          if (
            source.includes(term.toLowerCase()) &&
            !node.source.value.includes('/integrations/billing/')
          ) {
            context.report({
              node: node.source,
              messageId: 'providerLeakage',
              data: { provider: term },
            });
            break;
          }
        }
      },

      TSTypeReference(node) {
        if (node.typeName.type === 'Identifier' && PROVIDER_TERMS.has(node.typeName.name)) {
          context.report({
            node: node.typeName,
            messageId: 'providerLeakage',
            data: { provider: node.typeName.name },
          });
        }
      },
    };
  },
};
