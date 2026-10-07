#!/usr/bin/env node
// Local release gate. Retain every run; failures and skipped tests never become a green receipt.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
const root = process.cwd();
const out = path.resolve(process.argv[2] ?? `artifacts/accessibility-release/${new Date().toISOString().replaceAll(':', '-')}`);
if (fs.existsSync(path.join(out, 'receipt.json'))) throw new Error('Choose a new receipt directory; retain earlier runs.');
fs.mkdirSync(out, { recursive: true });
const receipt = { startedAt: new Date().toISOString(), builderSelfCertified: false, runs: [] };
const save = () => fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
async function run(name, args, env = {}, json = false) {
  const report = path.join(out, name + '.json');
  const browser = ['mobile', 'desktop'].includes(name);
  if (browser) { args.push('--reporter=line,json'); env = { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: report }; }
  if (json) args.push('--maxWorkers=1', '--no-file-parallelism', '--reporter=default', '--reporter=json', `--outputFile=${report}`);
  const row = { name, command: ['pnpm', ...args], startedAt: new Date().toISOString() }; receipt.runs.push(row); save(); console.log(`Starting ${name}`);
  const log = fs.openSync(path.join(out, name + '.log'), 'w');
  const child = spawn('pnpm', args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', log, log] });
  row.exitCode = await new Promise(resolve => { child.on('error', error => { row.error = error.message; resolve(-1); }); child.on('close', resolve); }); fs.closeSync(log);
  if (json && fs.existsSync(report)) { const data = JSON.parse(fs.readFileSync(report, 'utf8')); row.tests = { total: data.numTotalTests, passed: data.numPassedTests, failed: data.numFailedTests, skipped: data.numPendingTests, todo: data.numTodoTests }; }
  if (browser && fs.existsSync(report)) { const { stats } = JSON.parse(fs.readFileSync(report, 'utf8')); row.tests = { total: stats.expected + stats.unexpected + stats.skipped + stats.flaky, passed: stats.expected, failed: stats.unexpected, skipped: stats.skipped, flaky: stats.flaky }; }
  row.status = row.exitCode === 0 && (!(json || browser) || row.tests?.total > 0 && !row.tests.skipped && !row.tests.todo && !row.tests.flaky) ? 'pass' : 'fail';
  row.completedAt = new Date().toISOString(); save(); console.log(`${name}: ${row.status}`); return row.status === 'pass';
}
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const componentSpecs = walk('tests/components').filter(file => /\.(test|spec)\.tsx?$/.test(file) && (/a11y/.test(file) || /\baxe\b/.test(fs.readFileSync(file, 'utf8'))));
await run('brand-contrast', ['exec', 'vitest', 'run', '--project=guardrails'], {}, true);
await run('root-a11y', ['exec', 'vitest', 'run', '--project=a11y'], {}, true);
await run('component-axe', ['exec', 'vitest', 'run', '--project=core', ...componentSpecs], {}, true);
await run('tokens-validate', ['run', 'tokens-validate']);
const built = await run('storybook-build', ['run', 'build-storybook']);
if (built) {
  await run('storybook-axe', ['run', 'a11y:diff']);
  const directory = path.join(root, 'storybook-static');
  const server = http.createServer((request, response) => {
    const file = path.resolve(directory, '.' + decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname).replace(/\/$/, '/index.html'));
    if (!file.startsWith(directory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('content-type', ({ '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[path.extname(file)] ?? 'text/html');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { STORYBOOK_EXTERNAL: '1', STORYBOOK_URL: `http://127.0.0.1:${server.address().port}` };
  try { await run('mobile', ['run', 'vrt:mobile', '--workers=1'], env); await run('desktop', ['run', 'vrt:desktop', '--workers=1'], env); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
} else { receipt.runs.push({ name: 'storybook-axe/mobile/desktop', status: 'fail', reason: 'Cannot run against an unsuccessful Storybook build' }); }
receipt.completedAt = new Date().toISOString(); receipt.status = receipt.runs.every(run => run.status === 'pass') ? 'pass' : 'fail'; save();
if (receipt.status !== 'pass') process.exitCode = 1;
