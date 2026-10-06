import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/** A real CLI fixture installation, cached by lock bytes; specs never rely on a planner's scratch folder. */
export function installedShadcnFixture(root: string): string {
  const fixture = path.join(root, 'tests/fixtures/shadcn-radix');
  const key = createHash('sha256').update(fs.readFileSync(path.join(fixture, 'package-lock.json'))).digest('hex').slice(0, 12);
  const directory = path.join(root, '.tmp', `shadcn-tests-${key}`);
  if (fs.existsSync(path.join(directory, '.installed'))) return directory;
  fs.mkdirSync(directory, { recursive: true }); fs.cpSync(fixture, directory, { recursive: true });
  fs.mkdirSync(path.join(root, '.tmp/t'), { recursive: true });
  const log = fs.openSync(path.join(directory, 'install.log'), 'w');
  try { execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: directory, timeout: 180_000, stdio: ['ignore', log, log], env: { ...process.env, npm_config_cache: path.join(root, '.tmp/npm-cache'), TMPDIR: fs.realpathSync(path.join(root, '.tmp/t')) } }); }
  finally { fs.closeSync(log); }
  fs.writeFileSync(path.join(directory, '.installed'), key); return directory;
}
