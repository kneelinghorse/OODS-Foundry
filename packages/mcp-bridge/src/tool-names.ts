import fs from 'node:fs';

const toolSurface: Record<string, { name: string }> = JSON.parse(
  fs.readFileSync(new URL('../../mcp-adapter/tool-surface.json', import.meta.url), 'utf8'),
);

export function toExternalName(internal: string): string {
  return toolSurface[internal]?.name ?? internal.replace(/\./g, '_');
}

/** Only renamed 0.6.2 wire names are aliases; dotted native calls remain supported. */
export function legacyToolWarning(name: string, internal: string): string | undefined {
  const current = toExternalName(internal);
  return name === internal.replace(/\./g, '_') && name !== current
    ? `Warning: ${name} is deprecated; use ${current}. This alias is supported through 0.7.x and removed in 0.8.0.`
    : undefined;
}

export type ToolNameMaps = {
  externalToInternal: Map<string, string>;
  internalToExternal: Map<string, string>;
  allowedExternalTools: Set<string>;
};

export function buildToolNameMaps(internalTools: Iterable<string>): ToolNameMaps {
  const externalToInternal = new Map<string, string>();
  const internalToExternal = new Map<string, string>();

  for (const internal of internalTools) {
    const external = toExternalName(internal);
    externalToInternal.set(external, internal);
    externalToInternal.set(internal.replace(/\./g, '_'), internal);
    internalToExternal.set(internal, external);
  }

  return {
    externalToInternal,
    internalToExternal,
    allowedExternalTools: new Set(internalToExternal.values()),
  };
}

export function resolveInternalToolName(externalOrInternal: string, externalToInternal: Map<string, string>): string | undefined {
  return externalToInternal.get(externalOrInternal) ?? externalToInternal.get(toExternalName(externalOrInternal));
}
