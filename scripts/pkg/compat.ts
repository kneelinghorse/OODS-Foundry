import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST_DIR = path.join(WORKSPACE_ROOT, 'dist', 'pkg');
const TOKENS_PACKAGE_ROOT = path.join(WORKSPACE_ROOT, 'packages', 'tokens');
const SAMPLE_APP_ROOT = path.join(WORKSPACE_ROOT, 'examples', 'sample-app');

function run(command: string, args: string[], options: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? WORKSPACE_ROOT,
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function prepareSampleApp(tempRoot: string): Promise<void> {
  await fsp.cp(SAMPLE_APP_ROOT, tempRoot, { recursive: true, force: true });
  const packagePath = path.join(tempRoot, 'package.json');
  const pkg = JSON.parse(await fsp.readFile(packagePath, 'utf8')) as Record<string, unknown>;
  const dependencies = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  dependencies['@oods/trait-engine'] = `file:${DIST_DIR}`;
  dependencies['@oods/tokens'] = `file:${TOKENS_PACKAGE_ROOT}`;
  pkg.dependencies = dependencies;
  await fsp.writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

async function runSampleAppSmokeTest(): Promise<void> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'oods-sample-app-'));
  try {
    await prepareSampleApp(tempRoot);
    await run('pnpm', ['install', '--no-frozen-lockfile', '--prefer-offline', '--link-workspace-packages=false'], {
      cwd: tempRoot,
    });
    await run('pnpm', ['run', 'test'], { cwd: tempRoot });
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  await run('pnpm', ['run', 'pkg:build']);
  await run('pnpm', ['--filter', '@oods/tokens', 'run', 'build']);
  await run('pnpm', ['--filter', '@oods/tw-variants', 'run', 'build']);
  await run(
    'pnpm',
    ['run', 'build-storybook', '--quiet'],
    {
      env: {
        ...process.env,
        OODS_USE_DIST_PACKAGE: '1',
      },
    }
  );
  await runSampleAppSmokeTest();
  console.log('\n✅ pkg:compat checks passed (storybook build + sample app install)\n');
}

await main().catch((error) => {
  console.error('pkg:compat failed');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
