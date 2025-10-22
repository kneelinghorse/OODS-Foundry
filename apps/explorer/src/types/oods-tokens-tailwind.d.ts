declare module '@oods/tokens/tailwind' {
  import type { TokenTree, FlatTokenEntry, TokenMeta } from '@oods/tokens';

  interface TailwindTokensJson {
    tokens: TokenTree;
    flat: Record<string, FlatTokenEntry>;
    cssVariables: Record<string, string>;
    meta?: Partial<TokenMeta>;
    prefix?: string;
    [key: string]: unknown;
  }

  const tokensJson: TailwindTokensJson;
  export default tokensJson;
}
