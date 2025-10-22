import type { StateTransitionRecord, StatefulViewData } from '../../traits/Stateful/view.js';
import type { TimestampableViewData } from '../../traits/Timestampable/view.js';
import type { TaggableViewData } from '../../traits/Taggable/types.js';

export interface UserStateTransition extends StateTransitionRecord {}

export interface UserRecord
  extends StatefulViewData,
    TimestampableViewData,
    TaggableViewData {
  readonly user_id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly preferred_name?: string | null;
  readonly primary_email: string;
  readonly role: string;
  readonly timezone?: string | null;
  readonly state_history?: readonly UserStateTransition[] | null;
}
