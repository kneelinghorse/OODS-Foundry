---
title: Communicable Trait Integration
description: Compose Communicable into User and Organization objects, generate helper methods, and use the communication CLI toolkit.
---

## Overview
- Communicable is composed into `User` and `Organization` with messaging channels, templates, conversations, and delivery policies.
- Object generator emits helper methods for sending messages, broadcasts, querying transcripts, and retrieving SLA metrics.
- CLI suite:
  - `communication-export` → message transcript export (JSON/CSV/HTML)
  - `communication-audit` → delivery/audit metrics
  - `communication-admin` → channel/template/policy admin

## Composition
1. `objects/core/User.object.yaml`
   - Added `core/Communicable` with `{ channelTypes: [email, in_app], supportConversations: true }`
   - Description updated to document messaging capability

2. `objects/core/Organization.object.yaml`
   - Added `core/Communicable` with `{ channelTypes: [email, sms, push, in_app, webhook], supportConversations: true }`
   - Added `core/Preferenceable` to satisfy Communicable dependencies
   - Description updated for broadcast messaging

3. Regenerate interfaces
   ```bash
   pnpm tsx src/cli/generate-objects.ts
   ```
   Helpers now emitted:
   - User: `sendMessage`, `getMessages`, `getConversations`, `getUnreadCount`, `markAllAsRead`
   - Organization: `broadcastMessage`, `getChannels`, `getTemplates`, `getDeliveryPolicies`, `getSLAMetrics`

## CLI Usage
### Export transcripts
```bash
pnpm tsx src/cli/communication-export.ts --user <uuid> --format json --output messages.json
pnpm tsx src/cli/communication-export.ts --user <uuid> --format html --start 2025-11-18 --end 2025-11-20
```
- Formats: `json`, `csv`, `html`
- Includes message metadata, delivery status, and conversation subjects

### Audit deliveries
```bash
pnpm tsx src/cli/communication-audit.ts --organization <org-id> --start 2025-11-18 --end 2025-11-20 --format text
```
- Reports: total messages, success rate, failed deliveries, SLA (time-to-send p95) and retry exhaustion rate

### Admin channels/templates/policies
```bash
# Add channel
pnpm tsx src/cli/communication-admin.ts channel add --org <org-id> --type email --name "Transactional Email" --config '{"provider":"smtp","host":"smtp.example.com"}'

# List templates
pnpm tsx src/cli/communication-admin.ts template list

# Add policy
pnpm tsx src/cli/communication-admin.ts policy add --name "Escalation" --retry '{"max_attempts":5}' --throttling '{"max_per_minute":120}'
```

## Examples
- `examples/objects/user-with-communicable.ts` demonstrates sending a message, counting unread, and marking all as read.
- `examples/objects/organization-with-communicable.ts` demonstrates broadcast messaging, channel/template queries, delivery policies, and SLA metrics.

## Validation
- Composition: `pnpm tsx src/cli/generate-objects.ts` (User/Organization interfaces include Communicable helpers)
- Export CLI: `pnpm tsx src/cli/communication-export.ts --user <id> --format json`
- Audit CLI: `pnpm tsx src/cli/communication-audit.ts --organization <id>`
- Tests: `pnpm test --run tests/integration/communicable-*.test.ts` (composition + CLI coverage)
