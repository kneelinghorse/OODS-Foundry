/**
 * Normalize unsafe user input before it reaches downstream integrations.
 * @param {string} input - Free-form text captured from the user or another agent.
 * @returns {string} Trimmed and sanitized string safe for configuration usage.
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a normalized configuration payload used by integration tests.
 * @param {string} userInput - Raw value that will be sanitized.
 * @param {{warn: Function, error: Function}} logger - Logger implementation for diagnostics.
 * @returns {{valid: boolean, value?: string, metadata?: object, reason?: string}}
 */
function createConfig(userInput, logger = console) {
  try {
    const value = sanitizeInput(userInput);

    if (!value) {
      logger.warn('integration-test: empty input received'); // test hook for QA runner
      return { valid: false, reason: 'empty_input' };
    }

    return {
      valid: true,
      value,
      createdAt: new Date().toISOString(),
      metadata: {
        validated: true,
        source: 'integration-runner'
      }
    };
  } catch (error) {
    logger.error('createConfig failure handled', { message: error.message });
    return { valid: false, reason: 'exception' };
  }
}

module.exports = { sanitizeInput, createConfig };
