export type RuntimeTreeDigest = { algorithm: string; sha256: string; entryCount: number };
export type RuntimeManifest = { schemaVersion: string; commit: string; [key: string]: unknown };
export const RUNTIME_MANIFEST_FILE: string;
export const RUNTIME_SBOM_FILE: string;
export const TERMS_FILES: readonly string[];
export const BRAND_SOURCE_PATH: string;
export function canonicalJson(value: unknown): string;
export function sha256(value: string | Uint8Array): string;
export function sha256File(filePath: string): Promise<string>;
export function treeDigest(root: string, options?: { exclude?: Iterable<string> }): Promise<RuntimeTreeDigest>;
export function verifyEmbeddedManifest(payloadRoot: string): Promise<{
  manifest: RuntimeManifest;
  manifestBytes: string;
  payload: RuntimeTreeDigest;
}>;
