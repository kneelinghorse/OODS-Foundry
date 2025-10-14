import type { ReactNode } from 'react';
import type { CanonicalRegionID } from './regions.js';
import type { RenderContext } from './render-context.js';

export type ExtensionType = 'wrapper' | 'section' | 'modifier' | 'action';

export interface Condition {
  readonly id: string;
  readonly expression: string;
  readonly description?: string;
}

export interface ViewExtensionMetadata {
  readonly sourceTrait?: string;
  readonly tags?: readonly string[];
  readonly notes?: string;
}

export type ViewExtensionRenderResult =
  | ReactNode
  | ((content: ReactNode) => ReactNode)
  | {
      readonly wrap?: (content: ReactNode) => ReactNode;
      readonly props?: Record<string, unknown>;
    };

export interface ViewExtension<Data = unknown> {
  readonly id: string;
  readonly region: CanonicalRegionID;
  readonly type: ExtensionType;
  readonly priority?: number;
  readonly targetId?: string;
  readonly conditions?: readonly Condition[];
  readonly render: (ctx: RenderContext<Data>) => ViewExtensionRenderResult;
  readonly metadata?: ViewExtensionMetadata;
}
