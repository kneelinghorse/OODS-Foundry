import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from '~/src/components/Tooltip';
import '~/src/styles/globals.css';

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Feedback/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

/**
 * Default tooltip appears on hover and focus.
 * Uses keyboard + pointer triggers with Escape to dismiss.
 */
export const Default: Story = {
  render: () => (
    <Tooltip content="Helpful information">
      <button type="button" style={{ padding: '0.5rem 1rem' }}>
        Hover or focus me
      </button>
    </Tooltip>
  ),
};

/**
 * Tooltips can be positioned on any side of the trigger element.
 */
export const Sides: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', padding: '4rem' }}>
      <Tooltip content="Top tooltip" side="top">
        <button type="button" style={{ padding: '0.5rem 1rem' }}>
          Top
        </button>
      </Tooltip>
      <Tooltip content="Bottom tooltip" side="bottom">
        <button type="button" style={{ padding: '0.5rem 1rem' }}>
          Bottom
        </button>
      </Tooltip>
      <Tooltip content="Left tooltip" side="left">
        <button type="button" style={{ padding: '0.5rem 1rem' }}>
          Left
        </button>
      </Tooltip>
      <Tooltip content="Right tooltip" side="right">
        <button type="button" style={{ padding: '0.5rem 1rem' }}>
          Right
        </button>
      </Tooltip>
    </div>
  ),
};

/**
 * Tooltips can contain rich content including formatted text.
 */
export const RichContent: Story = {
  render: () => (
    <Tooltip
      content={
        <span>
          <strong>Pro tip:</strong> Press <kbd>Esc</kbd> to dismiss
        </span>
      }
    >
      <button type="button" style={{ padding: '0.5rem 1rem' }}>
        Rich content tooltip
      </button>
    </Tooltip>
  ),
};

/**
 * Controlled tooltip state via `open` and `onOpenChange` props.
 */
export const Controlled: Story = {
  render: function ControlledTooltip() {
    const [open, setOpen] = React.useState(false);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <Tooltip content="Controlled tooltip" open={open} onOpenChange={setOpen}>
          <button type="button" style={{ padding: '0.5rem 1rem' }}>
            Hover me
          </button>
        </Tooltip>
        <label style={{ fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => setOpen(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          Tooltip open
        </label>
      </div>
    );
  },
};
