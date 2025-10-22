// React import not required with react-jsx runtime
import type { Meta, StoryObj } from '@storybook/react';
import { Button as DSButton } from '../../components/base/Button';

const meta: Meta = {
  title: 'Foundations/Elements Smoke Test',
  parameters: {
    controls: { disable: true },
    options: { showPanel: false },
  },
};
export default meta;
type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <div className="list-board" style={{ maxWidth: 760 }}>
      <div className="list-card">
        <h4 className="list-card__name">Native button (unstyled)</h4>
        <p className="view-caption">Rendered with default browser styles.</p>
        <div>
          <button aria-label="Native button">Native button</button>
        </div>
      </div>

      <div className="list-card">
        <h4 className="list-card__name">Token-styled class (.cmp-button)</h4>
        <p className="view-caption">Applies component layer styles via CSS variables.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="cmp-button" data-variant="outline" aria-label="cmp-button outline">
            cmp-button (outline)
          </button>
          <button className="cmp-button" data-tone="accent" aria-label="cmp-button accent">
            cmp-button (accent)
          </button>
        </div>
      </div>

      <div className="list-card">
        <h4 className="list-card__name">Component (DS Button)</h4>
        <p className="view-caption">Uses the Button component’s utility classes.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <DSButton intent="neutral" size="md">DS Button (neutral)</DSButton>
          <DSButton intent="success" size="md">DS Button (success)</DSButton>
        </div>
      </div>
    </div>
  ),
};

export const Inputs: Story = {
  render: () => (
    <div className="list-board" style={{ maxWidth: 760 }}>
      <div className="list-card">
        <h4 className="list-card__name">Native input (unstyled)</h4>
        <p className="view-caption">Rendered with default browser styles.</p>
        <div>
          <input placeholder="Native input" aria-label="Native input" />
        </div>
      </div>

      <div className="list-card">
        <h4 className="list-card__name">Styled input (.form-field)</h4>
        <p className="view-caption">Token-styled input using existing form-field classes.</p>
        <div className="form-field" style={{ maxWidth: 360 }}>
          <label className="form-field__label" htmlFor="smoke-input">Label</label>
          <div className="form-field__control">
            <input id="smoke-input" className="form-field__input" placeholder="Styled input via .form-field" />
          </div>
        </div>
      </div>
    </div>
  ),
};
