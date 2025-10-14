export interface FlatTokenEntry {
  value: unknown;
  cssVariable?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export type FlatTokenMap = Record<string, FlatTokenEntry>;

export interface TokensFlatPayload {
  flat: FlatTokenMap;
  prefix?: string;
}

export interface ContrastRule {
  ruleId: string;
  target: string;
  foreground: string;
  background: string;
  threshold: number;
  summary: string;
}

export interface TokenSample {
  key: string;
  value: string;
  cssVariable: string;
}

export interface ContrastEvaluation {
  rule: ContrastRule;
  ratio: number;
  passed: boolean;
  foreground: TokenSample;
  background: TokenSample;
  threshold: number;
  message?: string;
}
