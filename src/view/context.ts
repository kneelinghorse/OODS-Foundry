import type { RenderContext, RenderViewport, ObjectSpec, Theme } from '../types/render-context.js';

export type { RenderContext, RenderViewport, ObjectSpec, Theme } from '../types/render-context.js';

export interface CreateRenderContextOptions<Data> {
  readonly object: ObjectSpec<Data>;
  readonly data: Data;
  readonly theme: Theme;
  readonly permissions: readonly string[];
  readonly viewport: RenderViewport;
}

export function createRenderContext<Data>(
  options: CreateRenderContextOptions<Data>
): RenderContext<Data> {
  const { object, data, theme, permissions, viewport } = options;

  return Object.freeze({
    object,
    data,
    theme: Object.freeze({ ...theme }),
    permissions: Object.freeze([...permissions]),
    viewport: Object.freeze({ ...viewport }),
  });
}
