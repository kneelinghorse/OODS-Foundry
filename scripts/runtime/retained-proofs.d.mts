export const ROOT: string;
export const TOOL_LEDGER: string;
export const VISUAL_LEDGER: string;
export function readRetainedProofs(root?: string): {
  tool: Record<string, unknown>;
  visual: Record<string, unknown>;
  toolBytes: Buffer;
  visualBytes: Buffer;
};
export function copyRetainedToolLedger(output: string, root?: string): Record<string, unknown>;
