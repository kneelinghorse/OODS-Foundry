import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import { UserProfileSettings } from '../../src/pages/UserProfileSettings.js';
import type { User } from '../../generated/objects/User';
import { UserWithPreferencesExample } from '../../examples/objects/user-with-preferences';

const meta: Meta<typeof UserProfileSettings> = {
  title: 'Objects/User/UserPreferences',
  component: UserProfileSettings,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Profile settings surface showcasing the Preferenceable trait (form + summary preview).',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof UserProfileSettings>;

function cloneUser(user: User): User {
  if (typeof structuredClone === 'function') {
    return structuredClone(user);
  }
  return JSON.parse(JSON.stringify(user)) as User;
}

export const ProfileSettingsView: Story = {
  name: 'Preferences editor + preview',
  render: () => (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <UserProfileSettings
        user={cloneUser(UserWithPreferencesExample)}
        onSave={async ({ userId }) => {
          // eslint-disable-next-line no-console
          console.log(`Synthetic save for ${userId}`);
          await new Promise((resolve) => setTimeout(resolve, 600));
        }}
      />
    </div>
  ),
};
