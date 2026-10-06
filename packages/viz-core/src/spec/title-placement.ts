export type TitlePlacement = 'chart' | 'figure';

/** The slice of a normalized spec (or a story spec derived from one) the placement reads. */
export interface TitledSpec {
  readonly name?: string;
  readonly config?: { readonly title?: { readonly placement?: string } } | undefined;
}

/** Where the spec's name is painted: inside the SVG (the default) or by the figure that places the chart. */
export function titlePlacement(spec: TitledSpec): TitlePlacement {
  return spec.config?.title?.placement === 'figure' ? 'figure' : 'chart';
}

/** The title an adapter paints inside the SVG: the spec's name unless the figure owns it. */
export function paintedTitle(spec: TitledSpec): string | undefined {
  return titlePlacement(spec) === 'figure' ? undefined : spec.name;
}
