#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import process from 'node:process';

import type { Channel } from '@/schemas/communication/channel.js';
import type { DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';
import type { Template } from '@/schemas/communication/template.js';
import { cloneDataset, loadCommunicationDataset } from './communication-shared.js';

type AdminCommand = 'channel' | 'template' | 'policy';

interface AdminCliOptions {
  readonly command?: AdminCommand;
  readonly action?: string;
  readonly organizationId?: string;
  readonly channelType?: string;
  readonly channelId?: string;
  readonly name?: string;
  readonly config?: string;
  readonly templateSubject?: string;
  readonly templateBody?: string;
  readonly templateVariables?: string;
  readonly policyRetry?: string;
  readonly policyThrottling?: string;
  readonly policyQuietHours?: string;
  readonly outputJson: boolean;
  readonly datasetPath?: string;
}

interface AdminStore {
  channels: Channel[];
  templates: Template[];
  policies: DeliveryPolicy[];
}

export function buildAdminStore(datasetPath?: string): AdminStore {
  const dataset = cloneDataset(loadCommunicationDataset(datasetPath));
  return {
    channels: dataset.channels,
    templates: dataset.templates,
    policies: dataset.deliveryPolicies,
  };
}

export function addChannel(store: AdminStore, organizationId: string, type: string, name: string, config: Record<string, unknown>): Channel {
  const channel: Channel = {
    id: randomUUID(),
    name,
    description: `${type} channel for ${organizationId}`,
    type,
    enabled: true,
    metadata: { organizationId },
    tags: [],
    config,
  };
  store.channels.push(channel);
  return channel;
}

export function disableChannel(store: AdminStore, channelId: string): Channel | null {
  const channel = store.channels.find((entry) => entry.id === channelId);
  if (!channel) {
    return null;
  }
  channel.enabled = false;
  return channel;
}

export function addTemplate(
  store: AdminStore,
  channelType: string,
  name: string,
  subject: string,
  body: string,
  variables: readonly string[]
): Template {
  const template: Template = {
    id: randomUUID(),
    name,
    channel_type: channelType,
    subject,
    body,
    variables: [...variables],
    locale: 'en-US',
    metadata: {},
  };
  store.templates.push(template);
  return template;
}

export function addPolicy(
  store: AdminStore,
  name: string,
  retry: DeliveryPolicy['retry'],
  throttling: DeliveryPolicy['throttling'],
  quietHours?: DeliveryPolicy['quiet_hours']
): DeliveryPolicy {
  const policy: DeliveryPolicy = {
    id: randomUUID(),
    name,
    retry,
    throttling,
    quiet_hours: quietHours,
    priority: 'normal',
    metadata: {},
  };
  store.policies.push(policy);
  return policy;
}

function parseOptions(argv: string[]): AdminCliOptions {
  if (argv.length === 0) {
    return printUsage();
  }
  const [commandRaw, actionRaw, ...rest] = argv;
  const command = ['channel', 'template', 'policy'].includes(commandRaw) ? (commandRaw as AdminCommand) : undefined;
  const action = actionRaw;
  let organizationId: string | undefined;
  let channelType: string | undefined;
  let channelId: string | undefined;
  let name: string | undefined;
  let config: string | undefined;
  let templateSubject: string | undefined;
  let templateBody: string | undefined;
  let templateVariables: string | undefined;
  let policyRetry: string | undefined;
  let policyThrottling: string | undefined;
  let policyQuietHours: string | undefined;
  let outputJson = false;
  let datasetPath: string | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case '--org':
      case '--organization':
        organizationId = rest[++index];
        break;
      case '--type':
        channelType = rest[++index];
        break;
      case '--name':
        name = rest[++index];
        break;
      case '--id':
        channelId = rest[++index];
        break;
      case '--config':
        config = rest[++index];
        break;
      case '--subject':
        templateSubject = rest[++index];
        break;
      case '--body':
        templateBody = rest[++index];
        break;
      case '--variables':
        templateVariables = rest[++index];
        break;
      case '--retry':
        policyRetry = rest[++index];
        break;
      case '--throttling':
        policyThrottling = rest[++index];
        break;
      case '--quiet-hours':
        policyQuietHours = rest[++index];
        break;
      case '--json':
        outputJson = true;
        break;
      case '--dataset':
        datasetPath = rest[++index];
        break;
      case '--help':
      case '-h':
        return printUsage();
      default:
        break;
    }
  }

  return {
    command,
    action,
    organizationId,
    channelType,
    channelId,
    name,
    config,
    templateSubject,
    templateBody,
    templateVariables,
    policyRetry,
    policyThrottling,
    policyQuietHours,
    outputJson,
    datasetPath,
  };
}

function printUsage(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.log(`Usage: pnpm tsx src/cli/communication-admin.ts <channel|template|policy> <action> [options]

Commands:
  channel add       Add a channel (--org, --type, --name, --config)
  channel list      List configured channels
  channel disable   Disable a channel by id (--id)
  template add      Add a template (--org optional, --type, --name, --subject, --body, --variables)
  template list     List templates
  policy add        Add a delivery policy (--name, --retry, --throttling [, --quiet-hours])
  policy list       List delivery policies

Options:
  --org <uuid>          Organization identifier
  --type <channel>      Channel type identifier (see configured channels)
  --name <name>         Resource name
  --config <json>       JSON payload for channel config
  --subject <text>      Template subject
  --body <text>         Template body
  --variables <csv>     Template variables (comma separated)
  --retry <json>        Policy retry configuration
  --throttling <json>   Policy throttling configuration
  --quiet-hours <json>  Policy quiet hours configuration
  --json                Output JSON instead of tables
  --dataset <file>      Optional dataset JSON override
  -h, --help            Show help
`);
  process.exit(message ? 1 : 0);
}

function ensure(action: AdminCliOptions['action'], command: AdminCommand | undefined, options: AdminCliOptions): void {
  if (!command || !action) {
    printUsage('Missing command or action.');
  }
  if (command === 'channel' && action === 'add' && !options.organizationId) {
    printUsage('Channel operations require --org.');
  }
}

function parseJson(value: string | undefined, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : fallback;
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function renderOutput(payload: unknown, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (Array.isArray(payload)) {
    console.table(payload);
    return;
  }
  console.log(payload);
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  ensure(options.action, options.command, options);

  const store = buildAdminStore(options.datasetPath);
  const command = options.command as AdminCommand;
  const action = options.action as string;

  switch (command) {
    case 'channel':
      if (action === 'list') {
        renderOutput(store.channels, options.outputJson);
        break;
      }
      if (action === 'add') {
        if (!options.channelType || !options.name) {
          printUsage('channel add requires --type and --name.');
        }
        const config = parseJson(options.config, {});
        const channel = addChannel(store, options.organizationId!, options.channelType!, options.name!, config);
        renderOutput(channel, options.outputJson);
        break;
      }
      if (action === 'disable') {
        const id = options.channelId ?? options.name;
        if (!id) {
          printUsage('channel disable requires --id.');
        }
        const updated = disableChannel(store, id!);
        renderOutput(updated ?? { error: `Channel ${id} not found` }, options.outputJson);
        break;
      }
      printUsage(`Unsupported channel action: ${action}`);
      break;

    case 'template':
      if (action === 'list') {
        renderOutput(store.templates, options.outputJson);
        break;
      }
      if (action === 'add') {
        if (!options.channelType || !options.name || !options.templateSubject || !options.templateBody) {
          printUsage('template add requires --type, --name, --subject, and --body.');
        }
        const variables = (options.templateVariables ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
        const template = addTemplate(
          store,
          options.channelType!,
          options.name!,
          options.templateSubject!,
          options.templateBody!,
          variables
        );
        renderOutput(template, options.outputJson);
        break;
      }
      printUsage(`Unsupported template action: ${action}`);
      break;

    case 'policy':
      if (action === 'list') {
        renderOutput(store.policies, options.outputJson);
        break;
      }
      if (action === 'add') {
        if (!options.name) {
          printUsage('policy add requires --name.');
        }
        const retry = parseJson(options.policyRetry, { max_attempts: 3, backoff_strategy: 'exponential', initial_delay_seconds: 0 }) as DeliveryPolicy['retry'];
        const throttling = parseJson(options.policyThrottling, { max_per_minute: 100, max_per_hour: 500, max_per_day: 2500 }) as DeliveryPolicy['throttling'];
        const quietHours = options.policyQuietHours
          ? (parseJson(options.policyQuietHours, {}) as DeliveryPolicy['quiet_hours'])
          : undefined;
        const policy = addPolicy(store, options.name!, retry, throttling, quietHours);
        renderOutput(policy, options.outputJson);
        break;
      }
      printUsage(`Unsupported policy action: ${action}`);
      break;

    default:
      printUsage('Unsupported command. Use channel|template|policy.');
  }
}

void run();
