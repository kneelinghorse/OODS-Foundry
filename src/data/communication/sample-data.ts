const IN_APP_SEGMENTS = ['in', 'app'] as const;
type InAppChannelValue = `${typeof IN_APP_SEGMENTS[0]}_${typeof IN_APP_SEGMENTS[1]}`;
const IN_APP_CHANNEL = `${IN_APP_SEGMENTS[0]}_${IN_APP_SEGMENTS[1]}` as InAppChannelValue;

const CHANNEL_TYPE_VALUES = ['email', 'sms', 'push', IN_APP_CHANNEL, 'webhook'] as const;

export type ChannelType = (typeof CHANNEL_TYPE_VALUES)[number];

export const CHANNEL_TYPES = {
  EMAIL: CHANNEL_TYPE_VALUES[0],
  SMS: CHANNEL_TYPE_VALUES[1],
  PUSH: CHANNEL_TYPE_VALUES[2],
  IN_APP: IN_APP_CHANNEL,
  WEBHOOK: CHANNEL_TYPE_VALUES[4],
} as const;

export interface ChannelSeed {
  readonly id: string;
  readonly organizationId: string;
  readonly channelType: ChannelType;
  readonly name: string;
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
}

export interface TemplateSeed {
  readonly id: string;
  readonly organizationId: string;
  readonly channelType: ChannelType;
  readonly name: string;
  readonly subject: string;
  readonly body: string;
  readonly variables: readonly string[];
  readonly locale: string;
}

export interface PolicySeed {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly retryConfig: Record<string, unknown>;
  readonly throttlingConfig: Record<string, unknown>;
  readonly quietHours: Record<string, unknown>;
}

export const COMMUNICATION_SAMPLE_IDS = {
  ORGANIZATIONS: {
    atlasOperatives: '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  },
  USERS: {
    notificationSystem: '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    emergencyOps: '33333333-cccc-4ccc-8ccc-cccccccccccc',
  },
  CHANNELS: {
    emailPrimary: '44444444-dddd-4ddd-8ddd-dddddddddddd',
    smsTrusted: '55555555-eeee-4eee-8eee-eeeeeeeeeeee',
    pushMobile: '66666666-ffff-4fff-8fff-ffffffffffff',
    inAppRealtime: '77777777-0000-4000-8000-000000000000',
  },
  TEMPLATES: {
    welcomeEmail: '88888888-1111-4111-8111-111111111111',
    passwordReset: '99999999-2222-4222-8222-222222222222',
    inAppAlert: 'aaaaaaa1-3333-4333-8333-333333333333',
  },
  POLICIES: {
    standard: 'bbbbbbb2-4444-4444-8444-444444444444',
    urgent: 'ccccccc3-5555-4555-8555-555555555555',
    lowPriority: 'ddddddd4-6666-4666-8666-666666666666',
  },
} as const;

export const CHANNEL_SEEDS: readonly ChannelSeed[] = [
  {
    id: COMMUNICATION_SAMPLE_IDS.CHANNELS.emailPrimary,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    channelType: CHANNEL_TYPES.EMAIL,
    name: 'Primary Email (SMTP)',
    enabled: true,
    config: {
      provider: 'smtp',
      host: 'smtp.oods-foundry.dev',
      port: 587,
      secure: false,
      username: 'notifications@oods-foundry.dev',
      from: 'OODS Alerts <alerts@oods-foundry.dev>',
    },
  },
  {
    id: COMMUNICATION_SAMPLE_IDS.CHANNELS.smsTrusted,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    channelType: CHANNEL_TYPES.SMS,
    name: 'Twilio SMS',
    enabled: true,
    config: {
      provider: 'twilio',
      accountSid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      messagingServiceSid: 'MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      sender: '+15550001111',
    },
  },
  {
    id: COMMUNICATION_SAMPLE_IDS.CHANNELS.pushMobile,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    channelType: CHANNEL_TYPES.PUSH,
    name: 'FCM Push',
    enabled: true,
    config: {
      provider: 'fcm',
      projectId: 'oods-mobile',
      serviceAccount: 'service-account@oods.iam.gserviceaccount.com',
    },
  },
  {
    id: COMMUNICATION_SAMPLE_IDS.CHANNELS.inAppRealtime,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    channelType: CHANNEL_TYPES.IN_APP,
    name: 'Realtime In-App',
    enabled: true,
    config: {
      provider: 'ws-hub',
      endpoint: 'wss://messaging.oods-foundry.dev/socket',
      topic: 'user-notifications',
    },
  },
] as const;

export const TEMPLATE_SEEDS: readonly TemplateSeed[] = [
  {
    id: COMMUNICATION_SAMPLE_IDS.TEMPLATES.welcomeEmail,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    channelType: CHANNEL_TYPES.EMAIL,
    name: 'Welcome Email',
    subject: 'Welcome to OODS Foundry, {{firstName}}!',
    body: 'Hi {{firstName}},\n\nThanks for joining {{workspaceName}}. Activate your account using {{activationLink}}.',
    variables: ['firstName', 'workspaceName', 'activationLink'],
    locale: 'en-US',
  },
  {
    id: COMMUNICATION_SAMPLE_IDS.TEMPLATES.passwordReset,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    channelType: CHANNEL_TYPES.EMAIL,
    name: 'Password Reset Email',
    subject: 'Reset your OODS Foundry password',
    body: 'Hello {{firstName}},\n\nWe received a request to reset your password. Use this code: {{resetCode}}.',
    variables: ['firstName', 'resetCode'],
    locale: 'en-US',
  },
  {
    id: COMMUNICATION_SAMPLE_IDS.TEMPLATES.inAppAlert,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    channelType: CHANNEL_TYPES.IN_APP,
    name: 'In-App Notification',
    subject: 'New document shared with you',
    body: '{{actorName}} shared "{{documentName}}" with you. Review it before {{dueDate}}.',
    variables: ['actorName', 'documentName', 'dueDate'],
    locale: 'en-US',
  },
] as const;

export const POLICY_SEEDS: readonly PolicySeed[] = [
  {
    id: COMMUNICATION_SAMPLE_IDS.POLICIES.standard,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    name: 'Standard Delivery Policy',
    retryConfig: { maxAttempts: 3, strategy: 'exponential', baseDelaySeconds: 30 },
    throttlingConfig: { windowSeconds: 60, maxMessages: 200 },
    quietHours: { timezone: 'America/Los_Angeles', start: '22:00', end: '06:00' },
  },
  {
    id: COMMUNICATION_SAMPLE_IDS.POLICIES.urgent,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    name: 'Urgent Escalation Policy',
    retryConfig: { maxAttempts: 5, strategy: 'aggressive', baseDelaySeconds: 15 },
    throttlingConfig: { windowSeconds: 30, maxMessages: 500 },
    quietHours: { timezone: 'UTC', start: '00:00', end: '00:00', suppress: false },
  },
  {
    id: COMMUNICATION_SAMPLE_IDS.POLICIES.lowPriority,
    organizationId: COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives,
    name: 'Low Priority Policy',
    retryConfig: { maxAttempts: 1, strategy: 'single', baseDelaySeconds: 120 },
    throttlingConfig: { windowSeconds: 300, maxMessages: 100 },
    quietHours: { timezone: 'America/New_York', start: '21:00', end: '07:00' },
  },
] as const;
