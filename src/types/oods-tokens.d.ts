declare module '@oods/tokens' {
  type FlatTokenRecord = {
    name?: string;
    value: unknown;
    type?: string;
    path?: string[];
    cssVariable: string;
    originalValue?: unknown;
    description?: string;
    [key: string]: unknown;
  };

  type TokenTree = Record<string, unknown>;

  export const tokens: TokenTree;
  export const flatTokens: Record<string, FlatTokenRecord>;
  export const cssVariables: Record<string, string>;
  export const meta: Record<string, unknown>;
  export const prefix: string;

  const bundle: {
    tokens: typeof tokens;
    flatTokens: typeof flatTokens;
    cssVariables: typeof cssVariables;
    meta: typeof meta;
    prefix: typeof prefix;
  };

  export default bundle;
}
