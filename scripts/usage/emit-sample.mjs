#!/usr/bin/env node
/**
 * Usage Event Emitter - Sample Data Generator
 * 
 * Generates sample usage events for testing and development.
 * 
 * Usage:
 *   pnpm usage:sample <subscription-id> [options]
 *   pnpm usage:sample sub_test_001 --count 100 --days 7
 */

import { randomUUID } from 'node:crypto';

/**
 * Meter configurations
 */
const METERS = [
  { name: 'api_calls', unit: 'api_calls', avgPerDay: 1000 },
  { name: 'compute_hours', unit: 'compute_hours', avgPerDay: 24 },
  { name: 'storage_gb', unit: 'storage_gb', avgPerDay: 500 },
  { name: 'bandwidth_gb', unit: 'bandwidth_gb', avgPerDay: 100 },
];

/**
 * Event sources
 */
const SOURCES = ['api_gateway', 'background_job', 'webhook'];

/**
 * Generate random usage event
 */
function generateEvent(subscriptionId, tenantId, meter, date) {
  const variance = 0.3; // ±30% variance
  const baseQuantity = meter.avgPerDay / 24; // Hourly average
  const quantity = Math.max(
    0,
    baseQuantity * (1 + (Math.random() - 0.5) * variance)
  );
  
  return {
    subscriptionId,
    tenantId,
    meterName: meter.name,
    unit: meter.unit,
    quantity: Math.round(quantity * 100) / 100,
    recordedAt: date.toISOString(),
    source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
    idempotencyKey: `${meter.name}_${date.getTime()}_${randomUUID().substring(0, 8)}`,
    metadata: {
      service: 'sample-generator',
      region: 'us-east-1',
      userId: `user_${Math.floor(Math.random() * 1000)}`,
    },
  };
}

/**
 * Generate events for a date range
 */
function generateEvents(subscriptionId, tenantId, options = {}) {
  const {
    count = 100,
    days = 7,
    meters = METERS,
  } = options;
  
  const events = [];
  const now = new Date();
  const eventsPerDay = Math.ceil(count / days);
  
  for (let day = 0; day < days; day++) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() - days + day);
    
    for (let i = 0; i < eventsPerDay; i++) {
      const meter = meters[Math.floor(Math.random() * meters.length)];
      const hour = Math.floor(Math.random() * 24);
      const minute = Math.floor(Math.random() * 60);
      
      const eventDate = new Date(dayDate);
      eventDate.setHours(hour, minute, 0, 0);
      
      events.push(generateEvent(subscriptionId, tenantId, meter, eventDate));
    }
  }
  
  return events;
}

/**
 * Print events as JSON
 */
function printEvents(events, format = 'json') {
  if (format === 'json') {
    console.log(JSON.stringify(events, null, 2));
  } else if (format === 'jsonl') {
    for (const event of events) {
      console.log(JSON.stringify(event));
    }
  } else if (format === 'summary') {
    const summary = {
      totalEvents: events.length,
      byMeter: {},
      bySource: {},
      dateRange: {
        start: events[0]?.recordedAt,
        end: events[events.length - 1]?.recordedAt,
      },
    };
    
    for (const event of events) {
      summary.byMeter[event.meterName] = (summary.byMeter[event.meterName] || 0) + 1;
      summary.bySource[event.source] = (summary.bySource[event.source] || 0) + 1;
    }
    
    console.log(JSON.stringify(summary, null, 2));
  }
}

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
  const options = {
    subscriptionId: args[0] || 'sub_test_001',
    tenantId: 'tenant_test',
    count: 100,
    days: 7,
    format: 'json',
  };
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      options.count = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      options.days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--tenant' && args[i + 1]) {
      options.tenantId = args[i + 1];
      i++;
    } else if (args[i] === '--format' && args[i + 1]) {
      options.format = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: pnpm usage:sample <subscription-id> [options]

Options:
  --count <n>       Number of events to generate (default: 100)
  --days <n>        Number of days to spread events across (default: 7)
  --tenant <id>     Tenant ID (default: tenant_test)
  --format <type>   Output format: json|jsonl|summary (default: json)
  --help, -h        Show this help message

Examples:
  pnpm usage:sample sub_test_001
  pnpm usage:sample sub_prod_123 --count 500 --days 30
  pnpm usage:sample sub_dev_001 --format summary
      `);
      process.exit(0);
    }
  }
  
  return options;
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Error: subscription ID required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }
  
  const options = parseArgs(args);
  const events = generateEvents(options.subscriptionId, options.tenantId, options);
  
  printEvents(events, options.format);
}

main();

