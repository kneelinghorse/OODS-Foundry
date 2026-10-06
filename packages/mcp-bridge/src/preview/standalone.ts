/**
 * The preview host on its own, for the stdio adapter: it listens on 127.0.0.1 at a free port,
 * prints one JSON line naming the URL on stdout, logs to stderr, and exits when its stdin closes
 * or it receives SIGTERM, so it never outlives the adapter that started it.
 *
 *   node dist/preview/standalone.js --server-cwd <packages/mcp-server> [--port 0]
 */
import '../load-env.js';
import Fastify from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerPreviewHost } from './host.js';
import { NativeToolClient } from './native.js';
import { resolveCompositionsDir } from './store.js';
import { listenOnLoopback, PortInUseError, refuseForeignHosts } from '../listen.js';
import { activeTokenPackageRoot, resolveTokenPackageRoot } from '../runtime-paths.js';

function parseArgs(argv: string[]): { serverCwd: string; port: number } {
  let serverCwd = fileURLToPath(new URL('../../../mcp-server/', import.meta.url));
  let port = 0;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--server-cwd') serverCwd = path.resolve(argv[++index] ?? '');
    else if (arg === '--port') port = Number(argv[++index]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be an integer between 0 and 65535');
  return { serverCwd, port };
}

async function main() {
  const { serverCwd, port } = parseArgs(process.argv.slice(2));
  const fastify = Fastify({ logger: false });
  refuseForeignHosts(fastify);
  const compositionsDir = resolveCompositionsDir(serverCwd);
  let url: string | undefined;
  // Page edits re-compose through the native server this host owns; every call names this host's own address.
  const native = new NativeToolClient(serverCwd, () => url);
  const shippedTokens = resolveTokenPackageRoot(serverCwd);
  // s213-m06: the preview follows the server to a team's token build when one becomes active.
  const status = await registerPreviewHost(fastify, { compositionsDir, tokensRoot: () => activeTokenPackageRoot(shippedTokens), runTool: native.run });
  fastify.addHook('onClose', () => native.close());
  // The adapter passes --port 0 (a free port); a port someone chose is refused plainly when taken (s206-m03).
  const actualPort = await listenOnLoopback(fastify, { port, ...(port !== 0 ? { chosenBy: `--port ${port}` } : {}) });
  url = `http://127.0.0.1:${actualPort}`;
  process.stdout.write(JSON.stringify({ previewHost: { url, port: actualPort, pid: process.pid, compositionsDir, platform: status.platform } }) + '\n');
  process.stderr.write(`[oods-preview-host] listening on ${url}; compositions from ${compositionsDir}\n`);
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    fastify.close().then(() => process.exit(0)).catch(error => { process.stderr.write(`[oods-preview-host] shutdown failed: ${error}\n`); process.exit(1); });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.stdin.once('end', stop);
  process.stdin.once('close', stop);
  process.stdin.resume();
}

main().catch(error => {
  const reason = error instanceof PortInUseError ? error.message : error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`[oods-preview-host] failed to start: ${reason}\n`);
  process.exit(1);
});
