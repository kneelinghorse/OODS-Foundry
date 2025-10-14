import tokensJson from '../../../../../packages/tokens/dist/tailwind/tokens.json';
import subscriptionMapping from '../../../../../examples/mapping/saas.Subscription.status.json';
import invoiceMapping from '../../../../../examples/mapping/saas.Invoice.status.json';
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

const flatRecord = tokensJson.flat as Record<string, FlatTokenRecord>;

const tokenEntries: TokenEntry[] = Object.entries(flatRecord).map(([id, token]) => ({
  id,
  name: token.path.join('.'),
  value: token.value,
  path: token.path,
  description: token.description?.trim() ? token.description : undefined
}));

const resolveToken = resolveTokenValue;

const TokensRoute = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      padding: '2rem',
      backgroundColor: '#f1f5f9',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}
  >
    <TokenBrowser tokens={tokenEntries} resolveToken={resolveToken} />

    <MappingTable manifest={subscriptionMapping} resolveToken={resolveToken} title="Subscription Status Mapping" />
    <MappingTable manifest={invoiceMapping} resolveToken={resolveToken} title="Invoice Status Mapping" />
  </div>
);

export default TokensRoute;
