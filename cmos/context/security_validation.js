/**
 * Security Validation Tools for Context Loading
 * Implements proactive security checks for CMOS context files
 */

class ContextSecurityValidator {
  constructor() {
    this.validationRules = {
      fileIntegrity: this.validateFileIntegrity.bind(this),
      pathTraversal: this.validatePathTraversal.bind(this),
      sensitiveData: this.validateSensitiveData.bind(this),
      filePermissions: this.validateFilePermissions.bind(this),
      schemaCompliance: this.validateSchemaCompliance.bind(this)
    };

    this.securityThresholds = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedExtensions: ['.json', '.jsonl', '.yaml', '.yml', '.md'],
      blockedPatterns: [
        /password\s*[:=]/i,
        /secret\s*[:=]/i,
        /key\s*[:=]/i,
        /token\s*[:=]/i,
        /api[_-]?key/i,
        /private[_-]?key/i
      ]
    };
  }

  /**
   * Comprehensive security validation for context loading
   * @param {string} filePath - Path to the context file
   * @param {string} content - File content to validate
   * @returns {Object} Validation results with security assessment
   */
  async validateContextFile(filePath, content) {
    const results = {
      isValid: true,
      securityScore: 100,
      findings: [],
      recommendations: [],
      validationDetails: {}
    };

    try {
      // Run all security validations
      for (const [ruleName, validator] of Object.entries(this.validationRules)) {
        const ruleResult = await validator(filePath, content);
        results.validationDetails[ruleName] = ruleResult;

        if (!ruleResult.passed) {
          results.isValid = false;
          results.securityScore -= ruleResult.severity;
          results.findings.push({
            rule: ruleName,
            severity: ruleResult.severity,
            message: ruleResult.message,
            details: ruleResult.details
          });
        }

        if (ruleResult.recommendations) {
          results.recommendations.push(...ruleResult.recommendations);
        }
      }

      // Ensure security score doesn't go below 0
      results.securityScore = Math.max(0, results.securityScore);

      // Add overall assessment
      if (results.securityScore >= 80) {
        results.assessment = 'SECURE';
      } else if (results.securityScore >= 60) {
        results.assessment = 'WARNING';
      } else {
        results.assessment = 'CRITICAL';
      }

    } catch (error) {
      results.isValid = false;
      results.findings.push({
        rule: 'validation_error',
        severity: 50,
        message: `Validation failed: ${error.message}`,
        details: error.stack
      });
    }

    return results;
  }

  /**
   * Validate file integrity and basic security properties
   */
  async validateFileIntegrity(filePath, content) {
    const result = { passed: true, severity: 0, message: '', details: {} };

    // Check file size
    if (content.length > this.securityThresholds.maxFileSize) {
      result.passed = false;
      result.severity = 30;
      result.message = `File size exceeds maximum allowed size (${this.securityThresholds.maxFileSize} bytes)`;
      result.details.fileSize = content.length;
    }

    // Check file extension
    const extension = filePath.substring(filePath.lastIndexOf('.'));
    if (!this.securityThresholds.allowedExtensions.includes(extension)) {
      result.passed = false;
      result.severity = 20;
      result.message = `File extension '${extension}' is not in allowed list`;
      result.details.extension = extension;
      result.details.allowed = this.securityThresholds.allowedExtensions;
    }

    // Check for null bytes (potential binary content)
    if (content.includes('\0')) {
      result.passed = false;
      result.severity = 40;
      result.message = 'File contains null bytes, indicating potential binary content';
    }

    // Check for extremely long lines (potential obfuscation)
    const lines = content.split('\n');
    const longLines = lines.filter(line => line.length > 10000);
    if (longLines.length > 0) {
      result.passed = false;
      result.severity = 15;
      result.message = `File contains ${longLines.length} extremely long lines (>10KB)`;
      result.details.longLineCount = longLines.length;
    }

    return result;
  }

  /**
   * Validate against path traversal attacks
   */
  async validatePathTraversal(filePath, content) {
    const result = { passed: true, severity: 0, message: '', details: {} };

    const pathTraversalPatterns = [
      /\.\.[\/\\]/,  // ../ or ..\
      /[\/\\]\.\./,  // /.. or \..
      /%2e%2e[\/\\]/i,  // URL encoded ../
      /[\/\\]%2e%2e/i   // URL encoded /.. or \..
    ];

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(content)) {
        result.passed = false;
        result.severity = 50;
        result.message = 'Potential path traversal attack detected';
        result.details.detectedPattern = pattern.toString();
        break;
      }
    }

    // Check for absolute paths that might be dangerous
    const absolutePathPatterns = [
      /^[\/\\]/,  // Unix absolute path
      /^[A-Za-z]:[\/\\]/,  // Windows absolute path
      /^file:\/\//i  // File URL scheme
    ];

    for (const pattern of absolutePathPatterns) {
      if (pattern.test(content)) {
        result.passed = false;
        result.severity = 25;
        result.message = 'Absolute path detected in content';
        result.details.detectedPattern = pattern.toString();
        break;
      }
    }

    return result;
  }

  /**
   * Validate for sensitive data exposure
   */
  async validateSensitiveData(filePath, content) {
    const result = { passed: true, severity: 0, message: '', details: {} };

    const foundPatterns = [];

    for (const pattern of this.securityThresholds.blockedPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundPatterns.push({
          pattern: pattern.toString(),
          matches: matches.length,
          sample: matches[0].substring(0, 50) + (matches[0].length > 50 ? '...' : '')
        });
      }
    }

    if (foundPatterns.length > 0) {
      result.passed = false;
      result.severity = 45;
      result.message = `Potential sensitive data exposure detected (${foundPatterns.length} patterns)`;
      result.details.foundPatterns = foundPatterns;
      result.recommendations = [
        'Remove or encrypt sensitive data before storing in context files',
        'Use environment variables for secrets and credentials',
        'Implement proper data sanitization before context storage'
      ];
    }

    return result;
  }

  /**
   * Validate file permissions and access controls
   */
  async validateFilePermissions(filePath, content) {
    const result = { passed: true, severity: 0, message: '', details: {} };

    try {
      // Note: In a real implementation, this would check actual file permissions
      // For now, we'll do basic validation based on file path patterns

      const sensitivePaths = [
        /\/etc\//,
        /\/private\//,
        /\/System\//,
        /\/Users\/.*\/\.ssh\//,
        /\/root\//
      ];

      for (const pattern of sensitivePaths) {
        if (pattern.test(filePath)) {
          result.passed = false;
          result.severity = 35;
          result.message = 'File path indicates access to sensitive system directories';
          result.details.sensitivePath = filePath.match(pattern)[0];
          break;
        }
      }

    } catch (error) {
      result.passed = false;
      result.severity = 10;
      result.message = `Permission validation failed: ${error.message}`;
    }

    return result;
  }

  /**
   * Validate schema compliance and structure
   */
  async validateSchemaCompliance(filePath, content) {
    const result = { passed: true, severity: 0, message: '', details: {} };

    try {
      const extension = filePath.substring(filePath.lastIndexOf('.'));

      if (['.json', '.jsonl'].includes(extension)) {
        // Validate JSON structure
        if (extension === '.json') {
          JSON.parse(content);
        } else if (extension === '.jsonl') {
          // Validate each line is valid JSON
          const lines = content.trim().split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
              try {
                JSON.parse(lines[i]);
              } catch (lineError) {
                result.passed = false;
                result.severity = 15;
                result.message = `Invalid JSON on line ${i + 1}: ${lineError.message}`;
                result.details.invalidLine = i + 1;
                result.details.error = lineError.message;
                break;
              }
            }
          }
        }
      } else if (['.yaml', '.yml'].includes(extension)) {
        // Basic YAML validation - check for basic structure
        // Note: Full YAML parsing would require a YAML library
        if (!content.trim()) {
          result.passed = false;
          result.severity = 10;
          result.message = 'YAML file is empty';
        }
      }

    } catch (error) {
      result.passed = false;
      result.severity = 20;
      result.message = `Schema validation failed: ${error.message}`;
      result.details.parseError = error.message;
    }

    return result;
  }

  /**
   * Sanitize context content for safe loading
   * @param {string} content - Raw content to sanitize
   * @returns {string} Sanitized content
   */
  sanitizeContent(content) {
    let sanitized = content;

    // Remove or mask sensitive patterns
    for (const pattern of this.securityThresholds.blockedPatterns) {
      sanitized = sanitized.replace(pattern, (match) => {
        return match.replace(/[:=].*/, ': [REDACTED]');
      });
    }

    // Remove potential script injection patterns
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '[SCRIPT REMOVED]');
    sanitized = sanitized.replace(/javascript:/gi, '[JAVASCRIPT REMOVED]:');

    return sanitized;
  }

  /**
   * Generate security report for validation results
   * @param {Object} validationResults - Results from validateContextFile
   * @returns {string} Formatted security report
   */
  generateSecurityReport(validationResults) {
    const report = [
      '# Context Security Validation Report',
      `**Overall Assessment:** ${validationResults.assessment}`,
      `**Security Score:** ${validationResults.securityScore}/100`,
      `**Validation Status:** ${validationResults.isValid ? 'PASSED' : 'FAILED'}`,
      '',
      '## Security Findings'
    ];

    if (validationResults.findings.length === 0) {
      report.push('✅ No security issues found.');
    } else {
      validationResults.findings.forEach((finding, index) => {
        report.push(`### ${index + 1}. ${finding.rule.toUpperCase()}`);
        report.push(`**Severity:** ${finding.severity}/50`);
        report.push(`**Issue:** ${finding.message}`);
        if (finding.details && Object.keys(finding.details).length > 0) {
          report.push(`**Details:** ${JSON.stringify(finding.details, null, 2)}`);
        }
        report.push('');
      });
    }

    if (validationResults.recommendations.length > 0) {
      report.push('## Security Recommendations');
      validationResults.recommendations.forEach(rec => {
        report.push(`- ${rec}`);
      });
    }

    return report.join('\n');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextSecurityValidator;
}

// Global export for browser environments
if (typeof window !== 'undefined') {
  window.ContextSecurityValidator = ContextSecurityValidator;
}
