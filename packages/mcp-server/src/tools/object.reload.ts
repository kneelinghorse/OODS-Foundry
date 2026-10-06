/**
 * object.reload — re-read the shipped folders and the team's own, without restarting the server (s213-m03). Returns
 * what is now in use and every file that is not, with the reason.
 */

import { definitionRegistryReport, type DefinitionRegistryReport } from '../objects/object-loader.js';
import { reloadDefinitions } from './object.register.js';

export type ObjectReloadInput = Record<string, never>;
export type ObjectReloadOutput = DefinitionRegistryReport;

export async function handle(_input: ObjectReloadInput): Promise<ObjectReloadOutput> {
  reloadDefinitions();
  return definitionRegistryReport();
}
