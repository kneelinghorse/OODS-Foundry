import type { ViewExtension } from './view-extension.js';

export type TraitView<Data = unknown> = (ctx: RenderContext<Data>) => readonly ViewExtension<Data>[];

export interface TraitAdapter<Data = unknown> {
  readonly id: string;
  readonly version?: string;
  readonly view?: TraitView<Data>;
  readonly extensions?: readonly ViewExtension<Data>[];
  readonly metadata?: Record<string, unknown>;
}

export interface ObjectSpec<Data = unknown> {
  readonly id: string;
  readonly name?: string;
  readonly version?: string;
  readonly traits?: readonly (TraitAdapter<Data> | string)[];
  readonly tokens?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface Theme {
  readonly id: string;
  readonly mode?: 'light' | 'dark' | 'auto' | (string & {});
  readonly tokens: Record<string, string>;
  readonly tokenOverrides?: Record<string, string>;
}

export interface RenderViewport {
  readonly width: number;
  readonly height: number;
}

export interface RenderContext<Data = unknown> {
  readonly object: ObjectSpec<Data>;
  readonly data: Data;
  readonly theme: Theme;
  readonly permissions: readonly string[];
  readonly viewport: RenderViewport;
}
