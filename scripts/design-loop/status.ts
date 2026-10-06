import { DEFAULT_PORT, loopRequest } from './common.js';
export async function status(port = DEFAULT_PORT) {
  try { return await loopRequest(port, '/status'); }
  catch (error) { return { running: false, port, error: error instanceof Error ? error.message : String(error) }; }
}
