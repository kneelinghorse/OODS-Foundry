#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import type { JsonValue, MessageState } from '@/schemas/communication/common.js';
import type { Conversation } from '@/schemas/communication/conversation.js';
import type { Message } from '@/schemas/communication/message.js';
import {
  isWithinRange,
  loadCommunicationDataset,
  type CommunicationDataset,
  type DateRange,
  type MessageDirection,
} from './communication-shared.js';
import TimeService from '@/services/time/index.js';

export type ExportFormat = 'json' | 'csv' | 'html';

export interface TranscriptMessage {
  readonly messageId: string;
  readonly direction: MessageDirection;
  readonly channelType: string;
  readonly status: MessageState;
  readonly createdAt?: string;
  readonly deliveredAt?: string;
  readonly readAt?: string;
  readonly templateId: string;
  readonly conversationId?: string;
  readonly conversationSubject?: string;
  readonly variables: Record<string, JsonValue>;
  readonly metadata: Record<string, JsonValue>;
}

export interface UserTranscript {
  readonly userId: string;
  readonly totalMessages: number;
  readonly generatedAt: string;
  readonly range?: DateRange;
  readonly conversations: readonly { id: string; subject: string }[];
  readonly messages: readonly TranscriptMessage[];
}

interface ExportCliOptions {
  readonly userId?: string;
  readonly format: ExportFormat;
  readonly start?: string;
  readonly end?: string;
  readonly outputPath?: string;
  readonly datasetPath?: string;
}

export function buildUserTranscript(
  userId: string,
  dataset: CommunicationDataset,
  range?: DateRange
): UserTranscript {
  const conversationLookup = new Map(dataset.conversations.map((conversation) => [conversation.id, conversation]));
  const messages: TranscriptMessage[] = [];

  for (const message of dataset.messages) {
    const direction = resolveDirection(userId, message);
    if (!direction) continue;
    if (range && !isWithinRange(message.created_at, range)) {
      continue;
    }
    const conversation: Conversation | undefined = message.conversation_id
      ? conversationLookup.get(message.conversation_id)
      : undefined;
    messages.push({
      messageId: message.id,
      direction,
      channelType: message.channel_type,
      status: message.status,
      createdAt: message.created_at,
      deliveredAt: message.delivered_at,
      readAt: message.read_at,
      templateId: message.template_id,
      conversationId: message.conversation_id,
      conversationSubject: conversation?.subject,
      variables: normalizeRecord(message.variables),
      metadata: normalizeRecord(message.metadata),
    } satisfies TranscriptMessage);
  }

  const conversations = Array.from(
    new Map(
      messages
        .filter((entry) => entry.conversationId)
        .map((entry) => [entry.conversationId!, entry.conversationSubject ?? ''])
    ).entries()
  ).map(([id, subject]) => ({ id, subject }));

  return {
    userId,
    totalMessages: messages.length,
    generatedAt: TimeService.toIsoString(TimeService.nowSystem()),
    range,
    conversations,
    messages,
  } satisfies UserTranscript;
}

export function renderJsonTranscript(transcript: UserTranscript): string {
  return JSON.stringify(transcript, null, 2);
}

export function renderCsvTranscript(transcript: UserTranscript): string {
  const header = [
    'message_id',
    'direction',
    'channel_type',
    'status',
    'created_at',
    'delivered_at',
    'read_at',
    'conversation_id',
    'template_id',
  ].join(',');
  const rows = transcript.messages.map((entry) =>
    [
      entry.messageId,
      entry.direction,
      entry.channelType,
      entry.status,
      entry.createdAt ?? '',
      entry.deliveredAt ?? '',
      entry.readAt ?? '',
      entry.conversationId ?? '',
      entry.templateId,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}

export function renderHtmlTranscript(transcript: UserTranscript): string {
  const groups = new Map<string, TranscriptMessage[]>();
  for (const message of transcript.messages) {
    const key = message.conversationId ?? 'unthreaded';
    const list = groups.get(key) ?? [];
    list.push(message);
    groups.set(key, list);
  }

  const sections = Array.from(groups.entries()).map(([conversationId, entries]) => {
    const heading =
      conversationId === 'unthreaded'
        ? 'Unthreaded Messages'
        : `Conversation ${conversationId}${
            entries[0]?.conversationSubject ? ` — ${entries[0]?.conversationSubject}` : ''
          }`;
    const items = entries
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
      .map(
        (entry) =>
          `<li><strong>${entry.direction.toUpperCase()}</strong> · ${entry.channelType} · ${entry.status} · ${entry.createdAt ?? 'unknown'}<br/><em>Template:</em> ${entry.templateId}</li>`
      )
      .join('\n');
    return `<section><h2>${heading}</h2><ul>${items}</ul></section>`;
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Message transcript for ${transcript.userId}</title>
</head>
<body>
  <h1>Messages for ${transcript.userId}</h1>
  ${sections.join('\n')}
</body>
</html>`;
}

function resolveDirection(userId: string, message: Message): MessageDirection | null {
  if (message.sender_id === userId) {
    return 'sent';
  }
  if (message.recipient_ids?.includes(userId)) {
    return 'received';
  }
  return null;
}

function normalizeRecord(record: Record<string, JsonValue> | undefined): Record<string, JsonValue> {
  if (!record) {
    return {};
  }
  return { ...record };
}

function parseArgs(argv: string[]): ExportCliOptions {
  let userId: string | undefined;
  let format: ExportFormat = 'json';
  let start: string | undefined;
  let end: string | undefined;
  let outputPath: string | undefined;
  let datasetPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--user':
        userId = argv[++index];
        break;
      case '--format':
        format = (argv[++index] as ExportFormat) ?? 'json';
        break;
      case '--start':
        start = argv[++index];
        break;
      case '--end':
        end = argv[++index];
        break;
      case '--output':
        outputPath = argv[++index];
        break;
      case '--dataset':
        datasetPath = argv[++index];
        break;
      case '--help':
      case '-h':
        return printUsage();
      default:
        break;
    }
  }

  if (!userId) {
    return printUsage('Missing required --user identifier.');
  }

  if (!['json', 'csv', 'html'].includes(format)) {
    return printUsage(`Unsupported format: ${format}`);
  }

  return {
    userId,
    format,
    start,
    end,
    outputPath,
    datasetPath,
  } satisfies ExportCliOptions;
}

function printUsage(error?: string): never {
  if (error) {
    console.error(`Error: ${error}`);
  }
  console.log(`Usage: pnpm tsx src/cli/communication-export.ts --user <uuid> --format <json|csv|html> [options]

Options:
  --user <uuid>          User identifier (sender or recipient)
  --format <format>      Output format (json|csv|html)
  --start <ISO>          Optional range start (ISO timestamp)
  --end <ISO>            Optional range end (ISO timestamp)
  --output <file>        Write output to file instead of stdout
  --dataset <file>       Optional dataset JSON override
  -h, --help             Show help
`);
  process.exit(error ? 1 : 0);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const dataset = loadCommunicationDataset(options.datasetPath);
  const transcript = buildUserTranscript(options.userId!, dataset, {
    start: options.start,
    end: options.end,
  });

  let payload: string;
  switch (options.format) {
    case 'csv':
      payload = renderCsvTranscript(transcript);
      break;
    case 'html':
      payload = renderHtmlTranscript(transcript);
      break;
    case 'json':
    default:
      payload = renderJsonTranscript(transcript);
      break;
  }

  if (options.outputPath) {
    writeFileSync(options.outputPath, payload, 'utf8');
  } else {
    console.log(payload);
  }
}

function isCliEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isCliEntry()) {
  void run();
}
