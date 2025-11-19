import { PreferenceStore } from '@/traits/preferenceable/preference-store.js';
import {
  applyChannelPreference,
  createNotificationMatrix,
  getNotificationMatrixFromPreferences,
  setNotificationMatrixInPreferences,
} from '@/traits/preferenceable/notification/notification-matrix.js';
import {
  NotificationPreferenceFilter,
  type NotificationEventPayload,
} from '@/traits/preferenceable/notification/preference-filter.js';
import { NotificationChannelRouter } from '@/traits/preferenceable/notification/channel-router.js';

async function run(): Promise<void> {
  // 1. Bootstrap a matrix using defaults.
  const store = new PreferenceStore();
  const defaultMatrix = createNotificationMatrix();
  store.setPreference(['notifications', 'matrix'], defaultMatrix);

  // 2. Persist a user preference update (disable push for mention events).
  const disabledPushMatrix = applyChannelPreference(defaultMatrix, 'mention', 'push', false);
  const updatedPreferences = setNotificationMatrixInPreferences(store.getPreferences(), disabledPushMatrix);

  // 3. Load preferences back from the JSON document when routing notifications.
  const matrix = getNotificationMatrixFromPreferences(updatedPreferences);
  const filter = new NotificationPreferenceFilter(matrix, {
    fallbackChannels: ['email'],
  });

  const router = new NotificationChannelRouter({
    filter,
    handlers: {
      email: ({ event }) => {
        console.log('Dispatching transactional email', event);
      },
      in_app: ({ event }) => {
        console.log('Rendering notification center payload', event.payload);
      },
    },
  });

  const payload: NotificationEventPayload<{ actor: string; comment: string }> = {
    type: 'new_comment',
    recipientId: 'user-42',
    payload: {
      actor: 'Casey',
      comment: 'Left a note on your proposal',
    },
  };

  await router.route(payload);
}

run().catch((error) => {
  console.error('Failed to route notification matrix example', error);
});
