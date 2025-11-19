declare module '@/ViewContextProvider.jsx' {
  export function useViewContext(): string;
  export function useContextMetadata(): { density?: 'compact' | 'comfortable'; [key: string]: unknown } | null;
  export function getContextDataAttr(context: string): string;
  export const VALID_CONTEXTS: Record<string, string>;
}
