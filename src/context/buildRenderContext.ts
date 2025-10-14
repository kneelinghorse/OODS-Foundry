import { createRenderContext } from '../view/context.js';
import type {
  ObjectSpec,
  RenderContext,
  RenderViewport,
  Theme,
} from '../types/render-context.js';

export interface BuildRenderContextInput<Data = unknown> {
  readonly object: ObjectSpec<Data>;
  readonly data: Data;
  readonly theme?: Theme;
  readonly permissions?: readonly string[];
  readonly viewport?: RenderViewport;
}

const DEFAULT_THEME: Theme = Object.freeze({
  id: 'default',
  mode: 'light',
  tokens: Object.freeze({}),
});

const DEFAULT_VIEWPORT: RenderViewport = Object.freeze({
  width: 1280,
  height: 720,
});

export function buildRenderContext<Data = unknown>(
  input: BuildRenderContextInput<Data>
): RenderContext<Data> {
  const {
    object,
    data,
    theme = DEFAULT_THEME,
    permissions = [],
    viewport = DEFAULT_VIEWPORT,
  } = input;

  return createRenderContext<Data>({
    object,
    data,
    theme,
    permissions,
    viewport,
  });
}
