#!/usr/bin/env node
/**
 * notify-slack.mjs
 *
 * Sends performance regression alerts to Slack.
 *
 * Usage:
 *   SLACK_WEBHOOK_URL=https://... node scripts/perf/notify-slack.mjs --report diagnostics/perf-regressions.json
 *
 * Environment variables:
 *   SLACK_WEBHOOK_URL - Incoming webhook URL (required)
 *   GITHUB_SHA        - Commit SHA (optional, for linking)
 *   GITHUB_RUN_ID     - CI run ID (optional, for linking)
 *   GITHUB_REPOSITORY - Repo name (optional, for linking)
 *
 * Sprint 18 (B18.8): Performance CI integration
 */

import { readFileSync } from 'fs';
import https from 'https';
import { URL } from 'url';

const args = process.argv.slice(2);
const reportPath = args[args.indexOf('--report') + 1] || 'diagnostics/perf-regressions.json';
const webhookUrl = process.env.SLACK_WEBHOOK_URL;

/**
 * Load regression report
 */
function loadReport(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Could not load report from ${path}: ${error.message}`);
    process.exit(2);
  }
}

/**
 * Send message to Slack via webhook
 */
function sendSlackMessage(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const postData = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Slack API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Format regression message for Slack
 */
function formatMessage(report) {
  const { summary, regressions, improvements, commitSha } = report;

  const repoUrl = process.env.GITHUB_REPOSITORY
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}`
    : null;
  const commitUrl = repoUrl && commitSha
    ? `${repoUrl}/commit/${commitSha}`
    : null;
  const runUrl = process.env.GITHUB_RUN_ID && repoUrl
    ? `${repoUrl}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

  // Build blocks
  const blocks = [];

  // Header
  if (summary.regressions > 0) {
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `⚠️ Performance Regressions Detected`,
        emoji: true
      }
    });
  } else {
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `✅ Performance Check Passed`,
        emoji: true
      }
    });
  }

  // Summary
  const summaryText = [
    `*Total:* ${summary.total} metrics`,
    `*Stable:* ${summary.stable}`,
    `*Improvements:* ${summary.improvements}`,
    `*Regressions:* ${summary.regressions}`
  ].join('\n');

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: summaryText
    }
  });

  // Commit info
  if (commitUrl || runUrl) {
    const fields = [];
    if (commitUrl) {
      fields.push({
        type: 'mrkdwn',
        text: `*Commit:*\n<${commitUrl}|\`${commitSha.substring(0, 7)}\`>`
      });
    }
    if (runUrl) {
      fields.push({
        type: 'mrkdwn',
        text: `*CI Run:*\n<${runUrl}|View logs>`
      });
    }
    blocks.push({
      type: 'section',
      fields
    });
  }

  // Regressions
  if (regressions && regressions.length > 0) {
    blocks.push({
      type: 'divider'
    });

    const regressionsText = regressions.slice(0, 5).map(r => {
      const pctChange = r.relativeDiff > 0 ? `+${r.relativeDiff.toFixed(1)}%` : `${r.relativeDiff.toFixed(1)}%`;
      return `• *${r.scenarioId}* → ${r.metricName}\n  ${r.baselineMedian.toFixed(2)} → ${r.newValue.toFixed(2)} ${r.unit} (${pctChange})`;
    }).join('\n\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top Regressions:*\n${regressionsText}`
      }
    });

    if (regressions.length > 5) {
      blocks.push({
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `_...and ${regressions.length - 5} more. See full report in CI logs._`
        }]
      });
    }
  }

  // Improvements
  if (improvements && improvements.length > 0 && improvements.length <= 3) {
    blocks.push({
      type: 'divider'
    });

    const improvementsText = improvements.map(i => {
      const pctChange = i.relativeDiff < 0 ? `${i.relativeDiff.toFixed(1)}%` : `+${i.relativeDiff.toFixed(1)}%`;
      return `• *${i.scenarioId}* → ${i.metricName}\n  ${i.baselineMedian.toFixed(2)} → ${i.newValue.toFixed(2)} ${i.unit} (${pctChange})`;
    }).join('\n\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🚀 Notable Improvements:*\n${improvementsText}`
      }
    });
  }

  return { blocks };
}

/**
 * Main execution
 */
async function main() {
  if (!webhookUrl) {
    console.warn('⚠️  SLACK_WEBHOOK_URL not set. Skipping Slack notification.');
    process.exit(0);
  }

  console.log(`📬 Sending Slack notification...`);
  console.log(`   Report: ${reportPath}`);
  console.log('');

  const report = loadReport(reportPath);
  const message = formatMessage(report);

  try {
    await sendSlackMessage(message);
    console.log('✅ Slack notification sent successfully');
  } catch (error) {
    console.error(`❌ Failed to send Slack notification: ${error.message}`);
    process.exit(2);
  }
}

main();
