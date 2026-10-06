export function assembleReadinessAttestation(options: {
  repositoryRoot: string;
  bundleRoot: string;
  sourceHead?: string;
  generatedAt?: string;
}): Promise<{
  path: string;
  sha256: string;
  payloadSha256: string;
  generatedAt: string;
  sourceHead: string;
  targets: Record<string, { rows: number; emissionEligible: number }>;
  references: number;
  sourceFiles: number;
  packageFiles: number;
}>;
