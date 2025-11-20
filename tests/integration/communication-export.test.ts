import { describe, expect, it } from 'vitest';

import { cloneDataset, SAMPLE_COMMUNICATION_DATASET } from '../../src/cli/communication-shared';
import {
  buildUserTranscript,
  renderCsvTranscript,
  renderHtmlTranscript,
  renderJsonTranscript,
} from '../../src/cli/communication-export';

describe('communication-export CLI helpers', () => {
  it('exports sent and received messages with metadata', () => {
    const dataset = cloneDataset(SAMPLE_COMMUNICATION_DATASET);
    const transcript = buildUserTranscript('user-alpha', dataset);

    expect(transcript.totalMessages).toBeGreaterThan(0);
    expect(transcript.messages.some((entry) => entry.direction === 'sent')).toBe(true);
    expect(transcript.messages.some((entry) => entry.direction === 'received')).toBe(true);
    expect(renderJsonTranscript(transcript)).toContain('"messageId"');
  });

  it('filters by date range', () => {
    const dataset = cloneDataset(SAMPLE_COMMUNICATION_DATASET);
    const transcript = buildUserTranscript('user-alpha', dataset, {
      start: '2025-11-19T00:00:00Z',
      end: '2025-11-19T23:59:59Z',
    });
    expect(transcript.messages.every((entry) => entry.createdAt && entry.createdAt.startsWith('2025-11-19'))).toBe(
      true
    );
  });

  it('renders csv and html outputs', () => {
    const dataset = cloneDataset(SAMPLE_COMMUNICATION_DATASET);
    const transcript = buildUserTranscript('user-alpha', dataset);
    const csv = renderCsvTranscript(transcript);
    const html = renderHtmlTranscript(transcript);

    expect(csv.split('\n')[0]).toContain('message_id,direction,channel_type');
    expect(html).toContain('<html');
    expect(html).toContain('Messages for user-alpha');
  });
});
