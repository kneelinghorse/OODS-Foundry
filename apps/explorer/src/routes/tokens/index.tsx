import tokensBundle, { flatTokens as exportedFlatTokens } from '@oods/tokens';
import saasBillingStatusMap from '~/tokens/maps/saas-billing.status-map.json';
import { TokenBrowser, type TokenEntry } from './TokenBrowser';
import { MappingTable } from './MappingTable';
import { resolveTokenValue } from '../../utils/tokenResolver';

type FlatTokenRecord = {
  name: string;
  value: string;
  path: string[];
  cssVariable?: string;
  originalValue?: string;
  description?: string;
};

const flatRecord = (exportedFlatTokens ?? tokensBundle?.flatTokens ?? {}) as Record<string, FlatTokenRecord>;

const tokenEntries: TokenEntry[] = Object.entries(flatRecord).map(([id, token]) => ({
  id,
  name: token.path.join('.'),
  value: token.value,
  path: token.path,
  description: token.description?.trim() ? token.description : undefined
}));

const resolveToken = resolveTokenValue;

type SaasStatusTokenBlock = {
  foreground: string;
  background: string;
  border: string;
  icon: string;
};

type SaasStatusEntry = {
  description: string;
  chip: SaasStatusTokenBlock;
  banner?: SaasStatusTokenBlock;
};

type SaasBillingStatusManifest = {
  version: string;
  generated_at: string;
  domains: Record<'subscription' | 'invoice', Record<string, SaasStatusEntry>>;
};

const buildSaasMappingManifest = (
  domain: 'subscription' | 'invoice',
  description: string
) => {
  const manifest = saasBillingStatusMap as SaasBillingStatusManifest;
  const domainDefinitions = manifest.domains[domain] ?? {};
  const mappings = Object.fromEntries(
    Object.entries(domainDefinitions).map(([status, entry]) => {
      const defaultPayload = {
        foregroundColor: entry.chip.foreground,
        backgroundColor: entry.chip.background,
        borderColor: entry.chip.border,
        iconName: entry.chip.icon
      };

      const contexts = entry.banner
        ? {
            banner: {
              foregroundColor: entry.banner.foreground,
              backgroundColor: entry.banner.background,
              borderColor: entry.banner.border,
              iconName: entry.banner.icon
            }
          }
        : undefined;

      return [
        status,
        {
          description: entry.description,
          default: defaultPayload,
          contexts
        }
      ];
    })
  );

  return {
    metadata: {
      description,
      version: manifest.version,
      owner: 'billing-platform-squad'
    },
    mappings
  };
};

const subscriptionManifest = buildSaasMappingManifest(
  'subscription',
  'Subscription Status Mapping'
);
const invoiceManifest = buildSaasMappingManifest('invoice', 'Invoice Status Mapping');

const TokensRoute = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      padding: '2rem',
      backgroundColor: 'var(--cmp-surface-subtle)',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}
  >
    <TokenBrowser tokens={tokenEntries} resolveToken={resolveToken} />

    <MappingTable manifest={subscriptionManifest} resolveToken={resolveToken} />
    <MappingTable manifest={invoiceManifest} resolveToken={resolveToken} />
  </div>
);

export default TokensRoute;
