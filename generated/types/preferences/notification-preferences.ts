// Auto-generated from preferences/notification-preferences.schema.json. Do not edit manually.

/**
 * Represents a preference matrix where users can enable or disable notification channels per event type.
 */
export interface NotificationChannelEventMatrix {
  /**
   * Channel preferences for the given event type.
   *
   * This interface was referenced by `NotificationChannelEventMatrix`'s JSON-Schema definition
   * via the `patternProperty` "^[a-z0-9._-]+$".
   */
  [k: string]: {
    /**
     * Send transactional email notifications.
     */
    email?: boolean;
    /**
     * Dispatch mobile push notifications.
     */
    push?: boolean;
    /**
     * Deliver SMS text messages via verified phone numbers.
     */
    sms?: boolean;
    /**
     * Render alerts within the notification center UI.
     */
    in_app?: boolean;
    /**
     * Custom channel toggle (extensible by application domains).
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z0-9_-]+$".
     */
    [k: string]: boolean;
  };
}
