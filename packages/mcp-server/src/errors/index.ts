export {
  type ErrorCategory,
  type ErrorDefinition,
  type StructuredError,
  createError,
  isRetryable,
  getDefinition,
  allCodes,
  LEGACY_CODE_MAP,
} from './registry.js';

export { ToolError, isToolError } from './tool-error.js';
