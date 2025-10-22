declare module '@oods/tokens/tailwind' {
  type TokenPath = string[];

  type TailwindToken = {
    name: string;
    value: unknown;
    path: TokenPath;
    cssVariable?: string;
    originalValue?: unknown;
    description?: string;
  };

  const tokens: {
    flat: Record<string, TailwindToken>;
    prefix?: string;
    tree?: unknown;
    metadata?: unknown;
  };

  export default tokens;
}
