import net from 'node:net';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { listenOnLoopback, PortInUseError, refuseForeignHosts } from './listen.js';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });

async function occupiedPort(): Promise<number> {
  const blocker = net.createServer();
  await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  closers.push(() => new Promise<void>((resolve) => blocker.close(() => resolve())));
  return (blocker.address() as net.AddressInfo).port;
}
function server() {
  const fastify = Fastify();
  closers.push(() => fastify.close());
  return fastify;
}

describe('listening on the loopback port (s206-m03)', () => {
  it('refuses a chosen port that is taken, naming the port, the setting and what to do', async () => {
    const port = await occupiedPort();
    const attempt = listenOnLoopback(server(), { port, chosenBy: `MCP_BRIDGE_PORT=${port}` });
    await expect(attempt).rejects.toBeInstanceOf(PortInUseError);
    await expect(attempt).rejects.toThrow(`Port ${port} is already in use (MCP_BRIDGE_PORT=${port}), so OODS Foundry cannot listen there. Stop the program using that port, or choose a free port, or unset MCP_BRIDGE_PORT and the bridge picks one.`);
  });

  it("names the preview host's own flag when that chose the port", async () => {
    const port = await occupiedPort();
    await expect(listenOnLoopback(server(), { port, chosenBy: `--port ${port}` })).rejects.toThrow(`Port ${port} is already in use (--port ${port}), so OODS Foundry cannot listen there. Stop the program using that port, or choose a free port.`);
  });

  it('falls back to a free port when the default one is taken, and says so', async () => {
    const port = await occupiedPort();
    const notes: string[] = [];
    const actual = await listenOnLoopback(server(), { port, note: (line) => notes.push(line) });
    expect(actual).not.toBe(port);
    expect(actual).toBeGreaterThan(0);
    expect(notes).toEqual([`port ${port} is in use; listening on a free port instead`]);
  });

  it('listens where it was asked when the port is free', async () => {
    const fastify = server();
    fastify.get('/ping', async () => 'pong');
    const actual = await listenOnLoopback(fastify, { port: 0 });
    expect(actual).toBeGreaterThan(0);
    expect(await (await fetch(`http://127.0.0.1:${actual}/ping`)).text()).toBe('pong');
  });
});

/** Raw HTTP, because fetch will not send a Host header of the caller's choosing. */
function ask(port: number, host: string | undefined): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: '/ping', setHost: host !== undefined, headers: host === undefined ? {} : { Host: host } }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
    });
    request.once('error', reject);
    request.end();
  });
}

describe('the local servers answer only their own loopback host (s211-m01)', () => {
  it('refuses a page that rebinds another site\'s name to 127.0.0.1 before any route runs, and serves its own two names', async () => {
    const fastify = server();
    refuseForeignHosts(fastify);
    let served = 0;
    fastify.get('/ping', async () => { served += 1; return 'pong'; });
    const port = await listenOnLoopback(fastify, { port: 0 });
    // A rebinding page: the browser connects to 127.0.0.1 and names the attacker's site.
    const foreign = await ask(port, `attacker.example:${port}`);
    expect(foreign.status).toBe(403);
    expect(JSON.parse(foreign.body).error).toMatchObject({ code: 'POLICY_DENIED', details: { reason: 'FOREIGN_HOST', host: `attacker.example:${port}` } });
    expect(served).toBe(0);
    // The right name on another port is not this server either; a request naming no host Node refuses itself (400).
    expect((await ask(port, `127.0.0.1:${port + 1}`)).status).toBe(403);
    expect((await ask(port, undefined)).status).toBe(400);
    expect(served).toBe(0);
    // Workbench, the adapter and the browser preview all name 127.0.0.1 or localhost with the port.
    expect(await ask(port, `127.0.0.1:${port}`)).toEqual({ status: 200, body: 'pong' });
    expect(await ask(port, `LOCALHOST:${port}`)).toEqual({ status: 200, body: 'pong' });
    expect(await (await fetch(`http://localhost:${port}/ping`)).text()).toBe('pong');
    expect(served).toBe(3);
  });
});

