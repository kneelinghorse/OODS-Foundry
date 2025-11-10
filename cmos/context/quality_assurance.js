/**
 * Quality Assurance Framework for AI-Generated Code
 * Implements comprehensive validation and quality checks for CMOS-generated code
 */

class CodeQualityAssurance {
  constructor() {
    this.qualityMetrics = {
      security: this.assessSecurityQuality.bind(this),
      maintainability: this.assessMaintainability.bind(this),
      performance: this.assessPerformance.bind(this),
      testing: this.assessTestingQuality.bind(this),
      documentation: this.assessDocumentation.bind(this)
    };

    this.qualityThresholds = {
      minTestCoverage: 80,
      maxComplexityScore: 10,
      minDocumentationScore: 70,
      maxSecurityVulnerabilities: 0,
      minPerformanceScore: 75
    };
  }

  /**
   * Comprehensive quality assessment for AI-generated code
   * @param {string} code - The generated code to assess
   * @param {Object} context - Implementation context and requirements
   * @returns {Object} Detailed quality assessment report
   */
  async assessCodeQuality(code, context = {}) {
    const assessment = {
      overallScore: 100,
      grade: 'A',
      passed: true,
      metrics: {},
      issues: [],
      recommendations: [],
      assessmentDate: new Date().toISOString()
    };

    try {
      // Run all quality assessments
      for (const [metricName, assessor] of Object.entries(this.qualityMetrics)) {
        const metricResult = await assessor(code, context);
        assessment.metrics[metricName] = metricResult;

        // Adjust overall score based on metric performance
        assessment.overallScore -= (100 - metricResult.score);

        // Collect issues and recommendations
        if (metricResult.issues) {
          assessment.issues.push(...metricResult.issues.map(issue => ({
            ...issue,
            category: metricName
          })));
        }

        if (metricResult.recommendations) {
          assessment.recommendations.push(...metricResult.recommendations);
        }

        // Check if metric failed critical thresholds
        if (metricResult.critical && !metricResult.passed) {
          assessment.passed = false;
        }
      }

      // Ensure score stays within bounds
      assessment.overallScore = Math.max(0, Math.min(100, assessment.overallScore));

      // Assign grade based on score
      if (assessment.overallScore >= 90) {
        assessment.grade = 'A';
      } else if (assessment.overallScore >= 80) {
        assessment.grade = 'B';
      } else if (assessment.overallScore >= 70) {
        assessment.grade = 'C';
      } else if (assessment.overallScore >= 60) {
        assessment.grade = 'D';
      } else {
        assessment.grade = 'F';
        assessment.passed = false;
      }

      // Sort issues by severity
      assessment.issues.sort((a, b) => (b.severity || 0) - (a.severity || 0));

    } catch (error) {
      assessment.passed = false;
      assessment.issues.push({
        category: 'assessment_error',
        severity: 10,
        message: `Quality assessment failed: ${error.message}`,
        details: error.stack
      });
    }

    return assessment;
  }

  /**
   * Assess security quality of generated code
   */
  async assessSecurityQuality(code, context) {
    const result = {
      score: 100,
      passed: true,
      critical: true,
      issues: [],
      recommendations: []
    };

    // OWASP Top 10 Security Checks
    const securityChecks = [
      {
        name: 'Injection Prevention',
        patterns: [/eval\s*\(/, /exec\s*\(/, /sql\s*=.*\+/i, /query\s*\(.*\+/i],
        severity: 9,
        message: 'Potential injection vulnerability detected'
      },
      {
        name: 'Authentication Checks',
        patterns: [/password\s*=\s*["'][^"']*["']/i, /secret\s*=\s*["'][^"']*["']/i],
        severity: 8,
        message: 'Hardcoded credentials detected'
      },
      {
        name: 'Input Validation',
        patterns: [/req\.body/i, /req\.query/i, /req\.params/i],
        check: (matches) => {
          // Check if input validation is present
          const hasValidation = /validate|saniti|escape|sanitiz/i.test(code);
          return !hasValidation && matches.length > 0;
        },
        severity: 7,
        message: 'User input processing without apparent validation'
      },
      {
        name: 'Error Information Leakage',
        patterns: [/error\.stack/i, /console\.error.*error/i, /throw.*error/i],
        check: (matches) => {
          // Check if errors are properly handled
          const hasErrorHandling = /try\s*\{|catch\s*\(/.test(code);
          return !hasErrorHandling && matches.length > 0;
        },
        severity: 6,
        message: 'Potential error information leakage'
      }
    ];

    for (const check of securityChecks) {
      let failed = false;

      if (check.check) {
        const matches = code.match(new RegExp(check.patterns.map(p => p.source).join('|'), 'gi')) || [];
        failed = check.check(matches);
      } else {
        for (const pattern of check.patterns) {
          if (pattern.test(code)) {
            failed = true;
            break;
          }
        }
      }

      if (failed) {
        result.score -= check.severity;
        result.issues.push({
          severity: check.severity,
          message: check.message,
          details: `Failed check: ${check.name}`
        });
      }
    }

    // Check for security best practices
    const securityBestPractices = [
      { pattern: /https:\/\//i, score: 5, message: 'Uses HTTPS for external communications' },
      { pattern: /const\s|let\s/, score: 3, message: 'Uses modern variable declarations' },
      { pattern: /async\s|await\s/, score: 2, message: 'Uses async/await patterns' }
    ];

    for (const practice of securityBestPractices) {
      if (practice.pattern.test(code)) {
        result.score += practice.score;
      }
    }

    result.score = Math.max(0, Math.min(100, result.score));

    if (result.score < 80) {
      result.passed = false;
      result.recommendations.push(
        'Implement comprehensive input validation',
        'Use parameterized queries for database operations',
        'Avoid hardcoded credentials and secrets',
        'Implement proper error handling without information leakage'
      );
    }

    return result;
  }

  /**
   * Assess code maintainability
   */
  async assessMaintainability(code, context) {
    const result = {
      score: 100,
      passed: true,
      critical: false,
      issues: [],
      recommendations: []
    };

    const lines = code.split('\n');
    const functions = code.match(/function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*\([^)]*\)\s*{/g) || [];
    const classes = code.match(/class\s+\w+/g) || [];

    // Complexity metrics
    const complexityScore = this.calculateComplexityScore(code);
    if (complexityScore > this.qualityThresholds.maxComplexityScore) {
      result.score -= 20;
      result.issues.push({
        severity: 6,
        message: `High complexity score: ${complexityScore} (max recommended: ${this.qualityThresholds.maxComplexityScore})`,
        details: 'Consider breaking down complex functions into smaller, more focused units'
      });
    }

    // Code length checks
    if (lines.length > 300) {
      result.score -= 10;
      result.issues.push({
        severity: 4,
        message: `File is very long: ${lines.length} lines`,
        details: 'Consider splitting into multiple files or modules'
      });
    }

    // Function length checks
    const longFunctions = functions.filter(func => {
      const funcMatch = func.match(/(\w+)\s*\([^)]*\)\s*{/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const funcRegex = new RegExp(`function\\s+${funcName}|const\\s+${funcName}\\s*=\\s*\\(`, 'g');
        const funcStart = code.search(funcRegex);
        if (funcStart !== -1) {
          const funcBody = code.substring(funcStart);
          const funcLines = funcBody.substring(0, funcBody.indexOf('}')).split('\n').length;
          return funcLines > 25;
        }
      }
      return false;
    });

    if (longFunctions.length > 0) {
      result.score -= 15;
      result.issues.push({
        severity: 5,
        message: `${longFunctions.length} functions are too long (>25 lines)`,
        details: 'Break down long functions into smaller, more focused functions'
      });
    }

    // Naming convention checks
    const badNames = code.match(/\b[a-z]\w{20,}\b/g) || []; // Very long lowercase names
    if (badNames.length > 0) {
      result.score -= 5;
      result.issues.push({
        severity: 3,
        message: 'Some variable/function names are unusually long',
        details: 'Consider using more concise, descriptive names'
      });
    }

    result.score = Math.max(0, Math.min(100, result.score));

    if (result.score < 70) {
      result.passed = false;
      result.recommendations.push(
        'Break down complex functions into smaller units',
        'Use clear, descriptive naming conventions',
        'Consider splitting large files into modules',
        'Add inline comments for complex logic'
      );
    }

    return result;
  }

  /**
   * Assess performance characteristics
   */
  async assessPerformance(code, context) {
    const result = {
      score: 100,
      passed: true,
      critical: false,
      issues: [],
      recommendations: []
    };

    // Performance anti-patterns
    const performanceIssues = [
      {
        pattern: /for\s*\([^)]*in\s+\w+\s*\)/g,
        severity: 6,
        message: 'Inefficient for-in loop usage',
        recommendation: 'Use for-of loops or array methods for better performance'
      },
      {
        pattern: /\w+\.length\s*>\s*0\s*&&/g,
        severity: 3,
        message: 'Unnecessary length check before iteration',
        recommendation: 'Rely on truthiness for arrays/objects'
      },
      {
        pattern: /console\.log\s*\(/g,
        severity: 2,
        message: 'Console logging in production code',
        recommendation: 'Remove or disable console statements in production'
      }
    ];

    for (const issue of performanceIssues) {
      const matches = code.match(issue.pattern);
      if (matches && matches.length > 0) {
        result.score -= issue.severity * Math.min(matches.length, 3); // Cap impact
        result.issues.push({
          severity: issue.severity,
          message: `${issue.message} (${matches.length} instances)`,
          details: issue.recommendation
        });
      }
    }

    // Performance best practices
    const performanceBestPractices = [
      { pattern: /const\s/, score: 3, message: 'Uses const declarations' },
      { pattern: /map\s*\(|filter\s*\(|reduce\s*\(/, score: 4, message: 'Uses efficient array methods' },
      { pattern: /async\s|await\s/, score: 2, message: 'Uses async/await for non-blocking operations' }
    ];

    for (const practice of performanceBestPractices) {
      if (practice.pattern.test(code)) {
        result.score += practice.score;
      }
    }

    result.score = Math.max(0, Math.min(100, result.score));

    if (result.score < this.qualityThresholds.minPerformanceScore) {
      result.passed = false;
      result.recommendations.push(
        'Use efficient data structures and algorithms',
        'Avoid unnecessary computations in loops',
        'Implement lazy loading where appropriate',
        'Profile and optimize performance-critical sections'
      );
    }

    return result;
  }

  /**
   * Assess testing quality
   */
  async assessTestingQuality(code, context) {
    const result = {
      score: 100,
      passed: true,
      critical: false,
      issues: [],
      recommendations: []
    };

    // Check for test files or test code
    const hasTests = /test|spec|\.test\.|\.spec\./i.test(code) ||
                     /describe\s*\(|it\s*\(|test\s*\(/i.test(code);

    if (!hasTests) {
      result.score -= 40;
      result.issues.push({
        severity: 8,
        message: 'No apparent test code found',
        details: 'Consider adding unit tests for the implemented functionality'
      });
    }

    // Check for test coverage comments or annotations
    const hasCoverageInfo = /coverage|istanbul|nyc/i.test(code);
    if (hasCoverageInfo) {
      result.score += 10;
    }

    // Check for mocking/stubbing patterns
    const hasMocking = /mock|stub|spy/i.test(code);
    if (hasMocking) {
      result.score += 5;
    }

    // Check for edge case handling
    const hasEdgeCases = /edge|boundary|error|exception/i.test(code);
    if (hasEdgeCases) {
      result.score += 5;
    }

    result.score = Math.max(0, Math.min(100, result.score));

    if (result.score < 60) {
      result.passed = false;
      result.recommendations.push(
        'Add comprehensive unit tests',
        'Include edge case and error condition testing',
        'Implement integration tests for complex functionality',
        'Set up automated test coverage reporting'
      );
    }

    return result;
  }

  /**
   * Assess documentation quality
   */
  async assessDocumentation(code, context) {
    const result = {
      score: 100,
      passed: true,
      critical: false,
      issues: [],
      recommendations: []
    };

    // Check for JSDoc comments
    const jsdocComments = code.match(/\/\*\*\s*\n.*?\*\//gs) || [];
    const functions = code.match(/function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*\([^)]*\)\s*{/g) || [];

    const documentedFunctions = jsdocComments.length;
    const totalFunctions = functions.length;

    if (totalFunctions > 0) {
      const documentationRatio = (documentedFunctions / totalFunctions) * 100;
      if (documentationRatio < 50) {
        result.score -= 20;
        result.issues.push({
          severity: 5,
          message: `Low documentation coverage: ${documentationRatio.toFixed(1)}% of functions documented`,
          details: `Documented: ${documentedFunctions}/${totalFunctions} functions`
        });
      }
    }

    // Check for inline comments
    const inlineComments = code.match(/\/\/.*$/gm) || [];
    const commentLines = inlineComments.length;
    const totalLines = code.split('\n').length;
    const commentRatio = (commentLines / totalLines) * 100;

    if (commentRatio < 10) {
      result.score -= 10;
      result.issues.push({
        severity: 3,
        message: `Low comment density: ${commentRatio.toFixed(1)}% of lines have comments`,
        details: 'Consider adding more inline comments for complex logic'
      });
    }

    // Check for README or documentation files
    const hasReadme = /readme|documentation/i.test(code);
    if (hasReadme) {
      result.score += 10;
    }

    result.score = Math.max(0, Math.min(100, result.score));

    if (result.score < this.qualityThresholds.minDocumentationScore) {
      result.passed = false;
      result.recommendations.push(
        'Add JSDoc comments for all public functions',
        'Include inline comments for complex logic',
        'Create comprehensive README documentation',
        'Document API interfaces and usage examples'
      );
    }

    return result;
  }

  /**
   * Calculate cyclomatic complexity score
   */
  calculateComplexityScore(code) {
    let complexity = 1; // Base complexity

    // Count decision points
    const decisionPatterns = [
      /if\s*\(/g,
      /else\s*if/g,
      /else/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*:/g, // ternary operator
      /&&/g, // logical AND
      /\|\|/g  // logical OR
    ];

    for (const pattern of decisionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Generate quality assurance report
   * @param {Object} assessment - Results from assessCodeQuality
   * @returns {string} Formatted quality report
   */
  generateQualityReport(assessment) {
    const report = [
      '# Code Quality Assurance Report',
      `**Overall Grade:** ${assessment.grade}`,
      `**Quality Score:** ${assessment.overallScore}/100`,
      `**Assessment Status:** ${assessment.passed ? 'PASSED' : 'FAILED'}`,
      `**Assessment Date:** ${assessment.assessmentDate}`,
      '',
      '## Quality Metrics'
    ];

    for (const [metricName, metricData] of Object.entries(assessment.metrics)) {
      report.push(`### ${metricName.charAt(0).toUpperCase() + metricName.slice(1)}`);
      report.push(`**Score:** ${metricData.score}/100`);
      report.push(`**Status:** ${metricData.passed ? '✅ PASSED' : '❌ FAILED'}`);
      if (metricData.critical) {
        report.push(`**Critical:** Yes`);
      }
      report.push('');
    }

    if (assessment.issues.length > 0) {
      report.push('## Issues Found');
      assessment.issues.forEach((issue, index) => {
        report.push(`### ${index + 1}. ${issue.category.toUpperCase()}: ${issue.message}`);
        report.push(`**Severity:** ${issue.severity || 'N/A'}/10`);
        if (issue.details) {
          report.push(`**Details:** ${issue.details}`);
        }
        report.push('');
      });
    }

    if (assessment.recommendations.length > 0) {
      report.push('## Recommendations');
      const uniqueRecommendations = [...new Set(assessment.recommendations)];
      uniqueRecommendations.forEach(rec => {
        report.push(`- ${rec}`);
      });
    }

    return report.join('\n');
  }

  /**
   * Create quality checklist for manual review
   * @param {Object} assessment - Quality assessment results
   * @returns {Array} Checklist items for manual verification
   */
  createQualityChecklist(assessment) {
    const checklist = [
      {
        category: 'Security',
        items: [
          'All user inputs are validated and sanitized',
          'No hardcoded credentials or secrets',
          'Proper error handling without information leakage',
          'Secure communication protocols used',
          'Input validation prevents injection attacks'
        ]
      },
      {
        category: 'Maintainability',
        items: [
          'Functions are focused and single-purpose',
          'Code complexity is within acceptable limits',
          'Clear naming conventions used throughout',
          'Code is well-organized and modular',
          'No duplicate code or logic'
        ]
      },
      {
        category: 'Performance',
        items: [
          'Efficient algorithms and data structures used',
          'No unnecessary computations in loops',
          'Memory usage is optimized',
          'Database queries are efficient',
          'Caching implemented where appropriate'
        ]
      },
      {
        category: 'Testing',
        items: [
          'Unit tests cover all critical functionality',
          'Edge cases and error conditions tested',
          'Integration tests verify component interactions',
          'Test coverage meets minimum requirements',
          'Tests are automated and repeatable'
        ]
      },
      {
        category: 'Documentation',
        items: [
          'Public APIs have JSDoc comments',
          'Complex logic has inline explanations',
          'README provides setup and usage instructions',
          'API documentation is current and accurate',
          'Code examples are provided where helpful'
        ]
      }
    ];

    // Mark items based on assessment results
    checklist.forEach(category => {
      category.items = category.items.map(item => {
        let status = 'pending';
        let notes = '';

        // Simple heuristic to mark items based on assessment
        if (assessment.overallScore >= 80) {
          status = 'completed';
        } else if (assessment.issues.some(issue =>
          issue.category.toLowerCase() === category.category.toLowerCase() &&
          issue.severity >= 5
        )) {
          status = 'needs_attention';
          const relatedIssues = assessment.issues.filter(issue =>
            issue.category.toLowerCase() === category.category.toLowerCase()
          );
          notes = `${relatedIssues.length} issues found`;
        }

        return { item, status, notes };
      });
    });

    return checklist;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CodeQualityAssurance;
}

// Global export for browser environments
if (typeof window !== 'undefined') {
  window.CodeQualityAssurance = CodeQualityAssurance;
}
