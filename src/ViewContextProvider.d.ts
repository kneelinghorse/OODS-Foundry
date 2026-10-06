import type { ComponentType, Context, ReactNode } from "react";

export type ViewContextName =
  | "list"
  | "detail"
  | "form"
  | "timeline"
  | "grid"
  | "card";

export interface ViewContextMetadata {
  readonly purpose?: string;
  readonly density?: "compact" | "comfortable" | "default";
  readonly interactivity?: "low" | "medium" | "high";
  readonly current_context?: ViewContextName;
  readonly timestamp?: string;
  readonly urn?: string;
  readonly [key: string]: unknown;
}

export interface ViewContextChange {
  readonly from: ViewContextName;
  readonly to: ViewContextName;
  readonly metadata: ViewContextMetadata;
}

export interface ViewContextState {
  readonly context: ViewContextName;
  readonly setContext: (context: ViewContextName) => void;
  readonly contextHistory: readonly ViewContextName[];
  readonly protocolMetadata: ViewContextMetadata | null;
  readonly isValid: (context: string) => context is ViewContextName;
  readonly getMetadata: (
    context?: ViewContextName,
  ) => ViewContextMetadata | undefined;
}

export interface ViewContextProviderProps {
  readonly value?: ViewContextName;
  readonly children?: ReactNode;
  readonly enableProtocolTracking?: boolean;
  readonly onContextChange?: (change: ViewContextChange) => void;
}

export const VALID_CONTEXTS: {
  readonly LIST: "list";
  readonly DETAIL: "detail";
  readonly FORM: "form";
  readonly TIMELINE: "timeline";
  readonly GRID: "grid";
  readonly CARD: "card";
};

export function ViewContextProvider(props: ViewContextProviderProps): ReactNode;
export function useViewContext(): ViewContextName;
export function useViewContextState(): ViewContextState;
export function useContextMetadata(): ViewContextMetadata | null;
export function useContextConditional(): {
  readonly is: (context: ViewContextName) => boolean;
  readonly oneOf: (contexts: readonly ViewContextName[]) => boolean;
  readonly not: (context: ViewContextName) => boolean;
  readonly context: ViewContextName;
};
export function withViewContext<
  Props extends { readonly viewContext: ViewContextName },
>(component: ComponentType<Props>): ComponentType<Omit<Props, "viewContext">>;
export function getContextDataAttr(context: string): ViewContextName;
export function getRecommendedPropsForContext(
  context: ViewContextName,
  componentType?: string,
): Record<string, unknown>;
export function validateComponentForContext(
  componentName: string,
  context: ViewContextName,
  props: Record<string, unknown>,
): boolean;

declare const ViewContext: Context<ViewContextState>;
export default ViewContext;
