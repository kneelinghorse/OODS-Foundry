import type { Meta, StoryObj } from '@storybook/react';
import tokensJson from '../../../../packages/tokens/dist/tailwind/tokens.json';
import { TokenBrowser } from '../routes/tokens/TokenBrowser';
import { resolveTokenValue } from '../utils/tokenResolver';

type FlatTokenRecord = {
  name: string;
  value: string;
  path: string[];
  cssVariable?: string;
  originalValue?: string;
  description?: string;
};

const flatRecord = tokensJson.flat as Record<string, FlatTokenRecord>;

const tokenEntries = Object.entries(flatRecord).map(([id, token]) => ({
  id,
  name: token.path.join('.'),
  value: token.value,
  path: token.path,
  description: token.description?.trim() ? token.description : undefined,
}));

const meta: Meta<typeof TokenBrowser> = {
  title: 'Tokens/Token Browser',
  component: TokenBrowser,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof TokenBrowser>;

export const Default: Story = {
  args: {
    tokens: tokenEntries,
    resolveToken: resolveTokenValue,
  },
};
