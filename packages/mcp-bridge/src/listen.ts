import type { FastifyInstance } from 'fastify';

/**
 * A port someone chose is taken (s206-m03). Said in one plain sentence, without a stack: the cause, then what to do.
 * `setting` names where the port came from, so the sentence can point at it.
 */
export class PortInUseError extends Error {
  constructor(readonly port: number, readonly setting: string) {
    super(`Port ${port} is already in use (${setting}), so OODS Foundry cannot listen there. Stop the program using that port, `
      + `or choose a free port${setting.startsWith('MCP_BRIDGE_PORT') ? ', or unset MCP_BRIDGE_PORT and the bridge picks one' : ''}.`);
    this.name = 'PortInUseError';
  }
}

/**
 * Listen on 127.0.0.1 and answer the port in use. A port the caller chose (`chosenBy`) is never silently replaced: if it
 * is taken, PortInUseError. A default port that is taken falls back to one the system picks, and `note` says so.
 */
export async function listenOnLoopback(
  fastify: FastifyInstance,
  options: { port: number; chosenBy?: string; note?: (line: string) => void },
): Promise<number> {
  try {
    await fastify.listen({ port: options.port, host: '127.0.0.1' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== 'EADDRINUSE') throw error;
    if (options.chosenBy) throw new PortInUseError(options.port, options.chosenBy);
    options.note?.(`port ${options.port} is in use; listening on a free port instead`);
    await fastify.listen({ port: 0, host: '127.0.0.1' });
  }
  const address = fastify.server.address();
  return typeof address === 'object' && address ? address.port : options.port;
}

/**
 * Refuse every request whose Host is not this server's own loopback address (s211-m01). Both local servers listen on
 * 127.0.0.1 only, yet a page on another site can point its own name at 127.0.0.1 and read the answers (DNS
 * rebinding): the browser then sends that site's name as Host. Only 127.0.0.1:<port> and localhost:<port> name this
 * server, so anything else is refused before any route runs, token or not. Register it before the routes.
 */
export function refuseForeignHosts(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request, reply) => {
    const address = fastify.server.address();
    const port = typeof address === 'object' && address ? address.port : undefined;
    const host = (request.headers.host ?? '').toLowerCase();
    if (port !== undefined && (host === `127.0.0.1:${port}` || host === `localhost:${port}`)) return;
    return reply.code(403).send({ error: {
      code: 'POLICY_DENIED',
      message: `This local server answers only 127.0.0.1:${port} and localhost:${port}; the request named ${host ? `host ${host}` : 'no host'}.`,
      details: { reason: 'FOREIGN_HOST', host: host || null },
    } });
  });
}
