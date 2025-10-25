import type { Rule } from 'eslint';

type ProviderLeakageOptions = {
  allowedPaths?: string[];
};

type MessageIds = 'providerLeakage' | 'providerIdentifier';

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

const PROVIDER_ID_PATTERNS: RegExp[] = [
  /sub_[a-zA-Z0-9]+/,
  /in_[a-zA-Z0-9]+/,
  /cus_[a-zA-Z0-9]+/,
  /pi_[a-zA-Z0-9]+/,
  /cb_sub_[a-zA-Z0-9]+/,
  /cb_inv_[a-zA-Z0-9]+/,
  /cb_cus_[a-zA-Z0-9]+/,
];

const noProviderLeakageRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent billing provider terminology from leaking into core code',
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
    const option = (context.options[0] as ProviderLeakageOptions | undefined) ?? {};
    const allowedPaths = option.allowedPaths ?? DEFAULT_ALLOWED_PATHS;
    const filename = normalizePath(context.getFilename());
    const allowed = allowedPaths.some((pattern) => globToRegExp(pattern).test(filename));

    if (allowed) {
      return {};
    }

    const reportIfProviderTerm = (value: string, node: Rule.Node): boolean => {
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

    const reportIfProviderId = (value: string, node: Rule.Node, location: string): boolean => {
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

    const checkLiteral = (node: Rule.Node & { value?: unknown }) => {
      if (typeof node.value !== 'string') {
        return;
      }

      const value = node.value;
      if (!reportIfProviderTerm(value, node)) {
        reportIfProviderId(value, node, 'string literal');
      }
    };

    const checkTemplateLiteral = (
      node: Rule.Node & {
        quasis: Array<{
          value: { cooked: string | null; raw: string | null };
        }>;
      }
    ) => {
      for (const quasi of node.quasis) {
        const text = quasi.value.cooked ?? quasi.value.raw ?? '';
        if (reportIfProviderTerm(text, quasi as unknown as Rule.Node)) {
          return;
        }
        if (reportIfProviderId(text, quasi as unknown as Rule.Node, 'template literal')) {
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
            data: {
              provider: node.name,
            },
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
            data: {
              provider: node.key.name,
            },
          });
        }
      },

      ImportDeclaration(node) {
        if (typeof node.source.value !== 'string') {
          return;
        }

        const source = node.source.value.toLowerCase();
        for (const term of PROVIDER_TERMS) {
          if (source.includes(term.toLowerCase()) && !node.source.value.includes('/integrations/billing/')) {
            context.report({
              node: node.source,
              messageId: 'providerLeakage',
              data: {
                provider: term,
              },
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
            data: {
              provider: node.typeName.name,
            },
          });
        }
      },
    };
  },
};

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');

  return new RegExp(`^${escaped}$`);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export { noProviderLeakageRule };
export default noProviderLeakageRule;
