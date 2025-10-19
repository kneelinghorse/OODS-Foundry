import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextField } from '../../src/components/base/TextField.js';

describe('OODS.TextField', () => {
  it('wires description and validation into aria-describedby', () => {
    const markup = renderToStaticMarkup(
      <TextField
        id="email"
        label="Email"
        description="Used for billing updates."
        validation={{ state: 'info', message: 'We only send essential alerts.' }}
      />
    );

    expect(markup).toContain('aria-describedby="email-description email-validation"');
    expect(markup).toContain('id="email-description"');
    expect(markup).toContain('id="email-validation"');
  });

  it('marks invalid state and surfaces validation tokens', () => {
    const markup = renderToStaticMarkup(
      <TextField
        id="workspace"
        label="Workspace name"
        validation={{ state: 'error', message: 'Provide a workspace name.' }}
        required
      />
    );

    expect(markup).toContain('data-validation-state="error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('--form-field-border');
  });
});
