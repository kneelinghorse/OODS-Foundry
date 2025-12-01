import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';

import hierarchySchema from '../../../schemas/viz/hierarchy-input.schema.json' assert { type: 'json' };
import networkSchema from '../../../schemas/viz/network-input.schema.json' assert { type: 'json' };
import sankeySchema from '../../../schemas/viz/sankey-input.schema.json' assert { type: 'json' };
import type {
  HierarchyInput,
  HierarchyInputFormat,
  NetworkInput,
  SankeyInput,
} from '../../types/viz/network-flow.js';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly errors: readonly ValidationIssue[];
  readonly data?: T;
}

const ajv = new Ajv({ allErrors: true, strict: false });

const hierarchyValidator = ajv.compile(hierarchySchema) as ValidateFunction<HierarchyInput>;
const networkValidator = ajv.compile(networkSchema) as ValidateFunction<NetworkInput>;
const sankeyValidator = ajv.compile(sankeySchema) as ValidateFunction<SankeyInput>;

export function detectHierarchyFormat(input: unknown): HierarchyInputFormat {
  if (!input || typeof input !== 'object') {
    return 'unknown';
  }
  const type = (input as { type?: unknown }).type;
  if (type === 'adjacency_list') {
    return 'adjacency_list';
  }
  if (type === 'nested') {
    return 'nested';
  }
  return 'unknown';
}

export function validateHierarchyInput(input: unknown): ValidationResult<HierarchyInput> {
  const errors = formatErrors(hierarchyValidator, input);

  if (!errors.validSchema) {
    return { valid: false, errors: errors.issues };
  }

  const payload = input as HierarchyInput;

  if (payload.type === 'adjacency_list') {
    const idSet = new Set<string>();
    for (let index = 0; index < payload.data.length; index += 1) {
      const node = payload.data[index];
      if (idSet.has(node.id)) {
        errors.issues.push(createIssue(`/data/${index}/id`, `Duplicate node id '${node.id}'`, 'custom'));
      } else {
        idSet.add(node.id);
      }
    }

    if (![...payload.data].some((node) => node.parentId === null)) {
      errors.issues.push(createIssue('/data', 'No root node found (parentId should be null for at least one node)', 'custom'));
    }

    payload.data.forEach((node, index) => {
      if (node.parentId !== null && !idSet.has(node.parentId)) {
        errors.issues.push(
          createIssue(
            `/data/${index}/parentId`,
            `Parent '${node.parentId}' not found in node list`,
            'custom'
          )
        );
      }
    });
  }

  return {
    valid: errors.issues.length === 0,
    errors: errors.issues,
    data: errors.issues.length === 0 ? payload : undefined,
  };
}

export function validateNetworkInput(input: unknown): ValidationResult<NetworkInput> {
  const errors = formatErrors(networkValidator, input);

  if (!errors.validSchema) {
    return { valid: false, errors: errors.issues };
  }

  const payload = input as NetworkInput;
  const nodeIds = new Set<string>();

  payload.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      errors.issues.push(createIssue(`/nodes/${index}/id`, `Duplicate node id '${node.id}'`, 'custom'));
    } else {
      nodeIds.add(node.id);
    }
  });

  payload.links.forEach((link, index) => {
    if (!nodeIds.has(link.source)) {
      errors.issues.push(
        createIssue(`/links/${index}/source`, `Link source '${link.source}' does not match a node id`, 'custom')
      );
    }
    if (!nodeIds.has(link.target)) {
      errors.issues.push(
        createIssue(`/links/${index}/target`, `Link target '${link.target}' does not match a node id`, 'custom')
      );
    }
  });

  return {
    valid: errors.issues.length === 0,
    errors: errors.issues,
    data: errors.issues.length === 0 ? payload : undefined,
  };
}

export function validateSankeyInput(input: unknown): ValidationResult<SankeyInput> {
  const errors = formatErrors(sankeyValidator, input);

  if (!errors.validSchema) {
    return { valid: false, errors: errors.issues };
  }

  const payload = input as SankeyInput;
  const nodeNames = new Set<string>();

  payload.nodes.forEach((node, index) => {
    if (nodeNames.has(node.name)) {
      errors.issues.push(createIssue(`/nodes/${index}/name`, `Duplicate node name '${node.name}'`, 'custom'));
    } else {
      nodeNames.add(node.name);
    }
  });

  payload.links.forEach((link, index) => {
    if (!nodeNames.has(link.source)) {
      errors.issues.push(
        createIssue(`/links/${index}/source`, `Link source '${link.source}' does not match a node name`, 'custom')
      );
    }
    if (!nodeNames.has(link.target)) {
      errors.issues.push(
        createIssue(`/links/${index}/target`, `Link target '${link.target}' does not match a node name`, 'custom')
      );
    }
  });

  return {
    valid: errors.issues.length === 0,
    errors: errors.issues,
    data: errors.issues.length === 0 ? payload : undefined,
  };
}

function formatErrors<T>(
  validator: ValidateFunction<T>,
  input: unknown
): { validSchema: boolean; issues: ValidationIssue[] } {
  const valid = validator(input);
  const issues = (validator.errors ?? []).map((error) => ({
    path: errorPath(error),
    message: error.message ?? 'Validation error',
    keyword: error.keyword,
  }));
  return { validSchema: valid === true, issues };
}

function createIssue(path: string, message: string, keyword: string): ValidationIssue {
  return { path, message, keyword };
}

function errorPath(error: ErrorObject): string {
  const basePath = error.instancePath === '' ? '/' : error.instancePath;
  if (error.keyword === 'required') {
    const missingProperty = (error.params as { missingProperty?: string }).missingProperty;
    if (missingProperty) {
      return basePath === '/' ? `/${missingProperty}` : `${basePath}/${missingProperty}`;
    }
  }
  return basePath;
}
