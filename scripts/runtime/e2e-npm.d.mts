/** Shared ancestor-module isolation used by the installed-package and packed-consumer proofs. */
export function isolatedCommand(workDir: string, command: string, args: string[]): { command: string; args: string[]; blocked: string[] };
/** A tester's machine: a home and npm cache of its own, the PATH to node and npx, nothing else inherited. */
export function testerEnvironment(workDir: string): { home: string; env: Record<string, string> };
/** A real missing React peer must fail even when the checkout could satisfy it; restored afterwards. */
export function missingPeerControl(runtimeDir: string, workDir: string, env: Record<string, string>): {
  package: string;
  positive: { exitCode: number | null; resolved: string };
  negative: { exitCode: number | null; code: string };
  restored: boolean;
};
