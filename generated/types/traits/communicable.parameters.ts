// Auto-generated from traits/communicable.parameters.schema.json. Do not edit manually.

/**
 * Configures messaging channels and conversation support for the Communicable trait (R20.1/R20.6).
 */
export interface CommunicableTraitParameters {
  /**
   * Channel types enabled for deliveries (email, sms, push, in_app, webhook, or custom).
   *
   * @minItems 1
   */
  channelTypes?: [string, ...string[]];
  /**
   * Whether threaded conversations are enabled alongside atomic messages.
   */
  supportConversations?: boolean;
}
