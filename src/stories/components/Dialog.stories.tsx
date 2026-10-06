import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Dialog } from '../../components/Dialog/Dialog';

const meta: Meta = {
  title: 'Components/Overlays/Dialog',
};
export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <button onClick={() => setOpen(true)}>Open Dialog</button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Confirm Action"
          description="This action cannot be undone."
          closeOnEsc
          closeOnBackdrop={false}
        >
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="cmp-button" data-tone="accent" onClick={() => setOpen(false)}>Confirm</button>
            <button className="cmp-button" data-variant="outline" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Dialog>
      </div>
    );
  },
};
