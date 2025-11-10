const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ContextSecurityValidator = require('./security_validation');
const CodeQualityAssurance = require('./quality_assurance');

/**
 * Integration test runner combines security, quality, performance, and compatibility checks.
 */
class IntegrationTestRunner {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || path.resolve(__dirname, '..');
    this.manifestPath = this.resolvePath(options.manifest || 'tests/integration/test_manifest.json');
    this.outputPath = options.output ? this.resolvePath(options.output) : path.resolve(this.repoRoot, 'telemetry/events/testing-summary.json');
    this.securityValidator = new ContextSecurityValidator();
    this.qualityAssurance = new CodeQualityAssurance();
  }

  resolvePath(target) {
    if (!target) return target;
    return path.isAbsolute(target) ? target : path.resolve(this.repoRoot, target);
  }

  async run() {
    const startedAt = new Date().toISOString();
    const manifest = await this.loadManifest();
    const suites = [];

    for (const suite of manifest.suites || []) {
      const suiteResult = await this.runSuite(suite);
      suites.push(suiteResult);
    }

    const failedSuites = suites.filter(suite => suite.status !== 'passed').length;
    const totalTests = suites.reduce((sum, suite) => sum + suite.summary.total, 0);
    const failedTests = suites.reduce((sum, suite) => sum + suite.summary.failed, 0);

    const report = {
      meta: {
        mission: manifest.meta?.mission || 'unknown',
        manifestVersion: manifest.meta?.version || 'unknown',
        startedAt,
        completedAt: new Date().toISOString(),
        manifestPath: path.relative(this.repoRoot, this.manifestPath),
        outputPath: path.relative(this.repoRoot, this.outputPath)
      },
      status: failedSuites > 0 || failedTests > 0 ? 'failed' : 'passed',
      summary: {
        suites: suites.length,
        suitesFailed: failedSuites,
        tests: totalTests,
        testsFailed: failedTests
      },
      suites
    };

    await this.writeReport(report);
    return report;
  }

  async loadManifest() {
    const data = await fsp.readFile(this.manifestPath, 'utf8');
    return JSON.parse(data);
  }

  async runSuite(suite) {
    const tests = [];

    for (const test of suite.tests || []) {
      const testResult = await this.runTest(test);
      tests.push(testResult);
    }

    const failed = tests.filter(test => test.status !== 'passed').length;

    return {
      id: suite.id,
      name: suite.name,
      description: suite.description,
      status: failed > 0 ? 'failed' : 'passed',
      summary: {
        total: tests.length,
        passed: tests.length - failed,
        failed
      },
      tests
    };
  }

  async runTest(test) {
    const result = {
      id: test.id,
      type: test.type,
      description: test.description || '',
      status: 'passed'
    };

    try {
      switch (test.type) {
        case 'file_exists':
          await this.assertFileExists(test, result);
          break;
        case 'directory_exists':
          await this.assertDirectoryExists(test, result);
          break;
        case 'content_includes':
          await this.assertContentIncludes(test, result);
          break;
        case 'security_scan':
          await this.runSecurityScan(test, result);
          break;
        case 'code_quality':
          await this.runCodeQualityAssessment(test, result);
          break;
        case 'performance_snapshot':
          await this.runPerformanceSnapshot(test, result);
          break;
        default:
          throw new Error(`Unsupported test type: ${test.type}`);
      }
    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
    }

    return result;
  }

  async assertFileExists(test, result) {
    const targetPath = this.resolvePath(test.target);
    const expectation = test.expectation || 'pass';

    let stat;
    try {
      stat = await fsp.stat(targetPath);
    } catch (error) {
      if (expectation === 'fail') {
        result.status = 'passed';
        result.details = { target: path.relative(this.repoRoot, targetPath), expectation };
        return;
      }
      throw new Error(`File not found: ${targetPath}`);
    }

    const isFile = stat.isFile();
    if (expectation === 'pass' && !isFile) {
      throw new Error(`Expected file but found different type: ${targetPath}`);
    }

    if (expectation === 'fail' && isFile) {
      result.status = 'failed';
      result.details = { target: path.relative(this.repoRoot, targetPath), expectation };
      return;
    }

    result.details = { target: path.relative(this.repoRoot, targetPath), expectation };
  }

  async assertDirectoryExists(test, result) {
    const targetPath = this.resolvePath(test.target);
    const expectation = test.expectation || 'pass';

    let stat;
    try {
      stat = await fsp.stat(targetPath);
    } catch (error) {
      if (expectation === 'fail') {
        result.details = { target: path.relative(this.repoRoot, targetPath), expectation };
        return;
      }
      throw new Error(`Directory not found: ${targetPath}`);
    }

    const isDirectory = stat.isDirectory();
    if (expectation === 'pass' && !isDirectory) {
      throw new Error(`Expected directory but found different type: ${targetPath}`);
    }

    if (expectation === 'fail' && isDirectory) {
      result.status = 'failed';
    }

    result.details = { target: path.relative(this.repoRoot, targetPath), expectation };
  }

  async assertContentIncludes(test, result) {
    const targetPath = this.resolvePath(test.target);
    const content = await fsp.readFile(targetPath, 'utf8');
    const expectation = test.expectation || 'pass';
    const includes = Array.isArray(test.includes) ? test.includes : [test.includes].filter(Boolean);

    const missing = includes.filter(snippet => !content.includes(snippet));

    if (expectation === 'pass' && missing.length > 0) {
      result.status = 'failed';
      result.details = { target: path.relative(this.repoRoot, targetPath), missing };
      return;
    }

    if (expectation === 'fail' && missing.length === 0) {
      result.status = 'failed';
      result.details = { target: path.relative(this.repoRoot, targetPath), expectation };
      return;
    }

    result.details = {
      target: path.relative(this.repoRoot, targetPath),
      includes,
      expectation
    };
  }

  async runSecurityScan(test, result) {
    const targetPath = this.resolvePath(test.target);
    const content = await fsp.readFile(targetPath, 'utf8');
    const expectation = test.expectation || 'pass';

    const scan = await this.securityValidator.validateContextFile(targetPath, content);
    const passed = expectation === 'pass' ? scan.isValid : !scan.isValid;

    if (!passed) {
      result.status = 'failed';
    }

    result.details = {
      target: path.relative(this.repoRoot, targetPath),
      assessment: scan.assessment,
      score: scan.securityScore,
      findings: scan.findings,
      expectation
    };
  }

  async runCodeQualityAssessment(test, result) {
    const targetPath = this.resolvePath(test.target);
    const code = await fsp.readFile(targetPath, 'utf8');
    const expectation = test.expectation || 'pass';

    const assessment = await this.qualityAssurance.assessCodeQuality(code, test.context || {});
    const passed = expectation === 'pass' ? assessment.passed : !assessment.passed;

    if (!passed) {
      result.status = 'failed';
    }

    result.details = {
      target: path.relative(this.repoRoot, targetPath),
      grade: assessment.grade,
      overallScore: assessment.overallScore,
      issues: assessment.issues,
      expectation
    };
  }

  async runPerformanceSnapshot(test, result) {
    const targetPath = this.resolvePath(test.target);
    const raw = await fsp.readFile(targetPath, 'utf8');
    const metrics = JSON.parse(raw);
    const summaries = [];
    let passed = true;

    for (const metric of test.metrics || []) {
      const baseline = this.getValueByPath(metrics, metric.baselinePath);
      const enhanced = this.getValueByPath(metrics, metric.enhancedPath);
      const trend = metric.trend || 'increase';
      const minImprovement = metric.minImprovement ?? 0;

      if (baseline === undefined || enhanced === undefined) {
        summaries.push({
          name: metric.name,
          status: 'failed',
          message: 'Metric values missing'
        });
        passed = false;
        continue;
      }

      let improvement = 0;
      if (trend === 'decrease') {
        if (baseline === 0) {
          improvement = enhanced === 0 ? 0 : -Infinity;
        } else {
          improvement = (baseline - enhanced) / baseline;
        }
      } else { // increase
        if (baseline === 0) {
          improvement = enhanced > 0 ? Infinity : 0;
        } else {
          improvement = (enhanced - baseline) / baseline;
        }
      }

      const metThreshold = improvement >= minImprovement;
      summaries.push({
        name: metric.name,
        baseline,
        enhanced,
        trend,
        improvement,
        minImprovement,
        status: metThreshold ? 'passed' : 'failed'
      });

      if (!metThreshold) {
        passed = false;
      }
    }

    if (!passed) {
      result.status = 'failed';
    }

    result.details = {
      target: path.relative(this.repoRoot, targetPath),
      metrics: summaries
    };
  }

  getValueByPath(object, descriptor) {
    if (!descriptor) return undefined;
    return descriptor.split('.').reduce((value, key) => (value ? value[key] : undefined), object);
  }

  async writeReport(report) {
    await fsp.mkdir(path.dirname(this.outputPath), { recursive: true });
    const payload = JSON.stringify(report, null, 2);

    if (this.outputPath.endsWith('.jsonl')) {
      await fsp.appendFile(this.outputPath, `${payload}\n`);
    } else {
      await fsp.writeFile(this.outputPath, payload);
    }
  }
}

async function cli(argv) {
  const args = parseArgs(argv.slice(2));
  const runner = new IntegrationTestRunner({ manifest: args.manifest, output: args.output });
  const report = await runner.run();

  if (require.main === module) {
    const status = report.status === 'passed' ? 0 : 1;
    console.log(JSON.stringify(report.summary, null, 2));
    process.exit(status);
  }
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest' && argv[i + 1]) {
      args.manifest = argv[i + 1];
      i += 1;
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[i + 1];
      i += 1;
    } else if (arg === '--help') {
      args.help = true;
    }
  }

  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node context/integration_test_runner.js [--manifest <path>] [--output <path>]');
    process.exit(0);
  }

  cli(process.argv).catch(error => {
    console.error('Integration testing failed:', error.message);
    process.exit(1);
  });
}

module.exports = { IntegrationTestRunner };
