import { AddonPanel } from 'storybook/internal/components';
import { addons, types } from 'storybook/manager-api';
import { AgentPanel } from './panel.js';

const ADDON_ID = 'oods/agent-panel';
const PANEL_ID = `${ADDON_ID}/panel`;

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Agent Tools',
    match: ({ viewMode }) => viewMode === 'story',
    render: (renderProps) => (
      <AddonPanel active={Boolean(renderProps?.active)} key={PANEL_ID}>
        <AgentPanel />
      </AddonPanel>
    ),
  });
});
