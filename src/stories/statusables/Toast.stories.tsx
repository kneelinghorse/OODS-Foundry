/* c8 ignore start */
import { useEffect, useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { withPage } from '~/.storybook/decorators/withPage';
import '../../styles/globals.css';
import { Toast } from '../../components/base/Toast';
import { listStatuses } from '../../components/statusables/statusRegistry.js';

type ToastStoryProps = ComponentProps<typeof Toast>;

const meta: Meta<typeof Toast> = {
  title: 'Components/Statusables/Toast',
  component: Toast,
  decorators: [withPage()],
  args: {
    status: 'active',
    domain: 'subscription',
    open: false,
    title: 'Saved',
    description: 'Changes have been stored successfully.',
    autoDismissAfter: 0,
  },
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
  argTypes: {
    open: { control: 'boolean' },
    autoDismissAfter: { control: 'number' },
  },
};

export default meta;

type Story = StoryObj<typeof Toast>;

export const Default: Story = {
  render: (args: ToastStoryProps) => <ToastPlayground {...args} />,
  parameters: {
    layout: 'centered',
  },
};

const ToastPlayground = ({
  open: openProp = false,
  onOpenChange,
  ...rest
}: ToastStoryProps) => {
  const [open, setOpen] = useState(openProp);

  useEffect(() => {
    setOpen(openProp);
  }, [openProp]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    setOpen(nextOpen);
  };

  const handleTriggerClick = () => {
    handleOpenChange(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        data-testid="toast-trigger"
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        onClick={handleTriggerClick}
      >
        Show toast
      </button>
      <Toast {...rest} open={open} onOpenChange={handleOpenChange} />
    </div>
  );
};

export const ToneGallery: Story = {
  render: () => {
    const statuses = listStatuses('subscription');

    return (
      <div className="flex flex-col gap-3">
        {statuses.map((entry) => (
          <Toast
            key={entry.status}
            open
            status={entry.status}
            domain={entry.domain}
            title={entry.label}
            description={entry.description}
            autoDismissAfter={0}
          />
        ))}
      </div>
    );
  },
  parameters: {
    chromatic: { disableSnapshot: false },
    layout: 'fullscreen',
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

/* c8 ignore end */
