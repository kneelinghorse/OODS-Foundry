import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Sheet } from '../../components/Sheet/Sheet';

const meta: Meta = {
  title: 'Components/Overlays/Sheet',
};
export default meta;
type Story = StoryObj;

export const RightBasic: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <button onClick={() => setOpen(true)}>Open Sheet</button>
        <Sheet open={open} onOpenChange={setOpen} anchor="right" size="md">
          <h3 id="sheet-title" style={{ marginTop: 0 }}>Details</h3>
          <p>Content in a right-anchored sheet.</p>
          <button className="cmp-button" onClick={() => setOpen(false)}>Close</button>
        </Sheet>
      </div>
    );
  },
};

export const BottomLarge: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <button onClick={() => setOpen(true)}>Open Sheet</button>
        <Sheet open={open} onOpenChange={setOpen} anchor="bottom" size="lg">
          <h3 id="sheet-title" style={{ marginTop: 0 }}>Filters</h3>
          <p>Content in a bottom-anchored sheet.</p>
          <button className="cmp-button" onClick={() => setOpen(false)}>Close</button>
        </Sheet>
      </div>
    );
  },
};
