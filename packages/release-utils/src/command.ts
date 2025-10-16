import { spawn } from 'node:child_process';

export type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export type RunCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<RunCommandResult> {
  return new Promise<RunCommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', (error) => reject(error));
    child.once('close', (code) => {
      if (code && code !== 0) {
        const err = new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`);
        (err as Error & { code?: number }).code = code ?? undefined;
        reject(err);
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}
