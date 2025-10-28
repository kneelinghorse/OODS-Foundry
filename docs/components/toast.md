# Toast Notification System

The Toast notification system provides transient, non-modal feedback to users through an imperative API with automatic queueing, stacking, and timeout management.

## Overview

Toasts are designed for brief, contextual feedback that doesn't interrupt the user's workflow. They appear in a consistent location (default: top-right), stack when multiple are shown, and auto-dismiss after a configured duration.

## Key Features

- **Imperative API**: Trigger toasts from anywhere in your application using `toast.show()`
- **Intent-Based Styling**: Automatically maps intents (info, success, warning, error) to Statusables design tokens
- **Queue Management**: Multiple toasts stack gracefully without overlap
- **Auto-Dismiss**: Configurable timeouts with longer durations for actionable toasts
- **Accessibility**: ARIA live regions with proper roles and keyboard support
- **Status Integration**: Can derive visual styling from domain-specific status values

## Installation & Setup

### 1. Add ToastProvider and ToastPortal at the app root

```tsx
import { ToastPortal } from '@oods/components/toast/ToastPortal';
import { ToastProvider } from '@oods/components/toast/toastService';

function App() {
  return (
    <ToastProvider>
      <YourAppContent />
      <ToastPortal />
    </ToastProvider>
  );
}
```

### 2. Import the toast service or hook

```tsx
import { toast } from '@oods/components/toast/toastService';
```

### Accessing the toast API from React components

```tsx
import { useToast } from '@oods/components/toast/toastService';

function SaveButton() {
  const toast = useToast();

  const handleSave = async () => {
    await saveChanges();
    toast.success('Saved successfully!');
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### Subscribe to queue updates (advanced)

```tsx
import { useToastQueue } from '@oods/components/toast/toastService';

function ToastDebugger() {
  const queue = useToastQueue();

  return <pre>{JSON.stringify(queue, null, 2)}</pre>;
}
```

## Basic Usage

### Show a Toast

```tsx
// Using intent-based styling
toast.show({
  intent: 'success',
  title: 'Changes saved!',
  description: 'Your profile has been updated successfully.',
});

// Convenience methods
toast.success('Operation successful!');
toast.error('Something went wrong!');
toast.warning('Please review your changes');
toast.info('New notification available');
```

### With Custom Duration

```tsx
// Quick 2-second message
toast.show({
  intent: 'info',
  title: 'Quick update',
  duration: 2000,
});

// Sticky toast (no auto-dismiss)
toast.show({
  intent: 'error',
  title: 'Critical error',
  description: 'Manual dismissal required.',
  duration: 0,
});
```

### With Action Button

```tsx
toast.show({
  intent: 'info',
  title: 'Update available',
  description: 'A new version is ready to install.',
  action: {
    label: 'Update now',
    onClick: () => {
      // Handle update
    },
  },
});
```

### Status-Based Toasts

```tsx
// Derive visual styling from domain-specific status
toast.show({
  status: 'active',
  domain: 'subscription',
  title: 'Subscription Updated',
  description: 'Your subscription is now active.',
});
```

## API Reference

### `toast.show(options)`

Creates and displays a new toast notification.

**Parameters:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `intent` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Visual intent mapping to Statusables tokens |
| `title` | `string` | *required* | Main message |
| `description` | `string` | `undefined` | Additional detail text |
| `duration` | `number` | `5000` (or `9600` with action) | Auto-dismiss timeout in ms (0 = sticky) |
| `status` | `string` | `undefined` | Domain-specific status for token resolution |
| `domain` | `StatusDomain` | `'subscription'` | Domain for status resolution |
| `tone` | `StatusTone` | *auto* | Direct tone override |
| `icon` | `ReactNode` | *auto* | Custom icon element |
| `action` | `{label, onClick}` | `undefined` | Action button configuration |
| `isDismissible` | `boolean` | `true` | Whether to show dismiss button |
| `dismissLabel` | `string` | `'Dismiss notification'` | A11y label for dismiss button |
| `showIcon` | `boolean` | *auto* | Override icon visibility |

**Returns:** `string` - Toast ID for manual dismissal

### Convenience Methods

```tsx
toast.success(title: string, description?: string): string
toast.error(title: string, description?: string): string
toast.warning(title: string, description?: string): string
toast.info(title: string, description?: string): string
```

### `toast.dismiss(id)`

Dismisses a specific toast by ID.

```tsx
const toastId = toast.show({ intent: 'info', title: 'Loading...' });

// Later...
toast.dismiss(toastId);
```

### `toast.dismissAll()`

Dismisses all active toasts.

```tsx
toast.dismissAll();
```

### `<ToastProvider />`

Wraps your application and exposes the toast API through React context.

```tsx
import { ToastProvider } from '@oods/components/toast/toastService';

<ToastProvider>
  <App />
  <ToastPortal />
</ToastProvider>;
```

### `useToast()`

Returns the toast API instance provided by context.

```tsx
const toast = useToast();
toast.success('Saved successfully!');
```

### `useToastQueue()`

Returns a live, immutable snapshot of the toast queue for debugging or custom UIs.

```tsx
const queue = useToastQueue();
console.log(queue.length);
```

### `toast.subscribe(callback)`

Subscribe to queue changes for reactive UI updates.

```tsx
const unsubscribe = toast.subscribe((queue) => {
  console.log('Active toasts:', queue.length);
});

// Cleanup
unsubscribe();
```

## ToastPortal Props

### `<ToastPortal />`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `container` | `HTMLElement` | *auto-created* | Custom portal mount point |
| `position` | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'top-right'` | Screen position |
| `maxVisible` | `number` | `5` | Maximum visible toasts (excess queued) |
| `className` | `string` | `undefined` | Additional CSS classes |

## Messaging Guidelines

### Voice & Tone

**Success Toasts**
- Confirm completed actions
- Use affirmative, concise language
- Examples: "Saved successfully", "Profile updated", "Email sent"

**Info Toasts**
- Provide neutral information or progress updates
- Keep brief and scannable
- Examples: "Processing your request", "New messages available"

**Warning Toasts**
- Alert users to non-critical issues
- Include actionable guidance when possible
- Examples: "Connection slow—retrying", "Form has unsaved changes"

**Error Toasts**
- Communicate failures clearly without blame
- Provide next steps or recovery actions
- Examples: "Unable to save changes. Try again.", "Connection lost—reconnecting"

### Writing Best Practices

1. **Lead with the outcome**: Put the key message in the title
2. **Be specific**: "Payment failed" > "Error occurred"
3. **Use active voice**: "We saved your draft" > "Draft was saved"
4. **Keep it brief**: Toasts are glanceable—aim for 5-10 words
5. **Avoid jargon**: Use plain language users understand

### Content Length

- **Title**: 5-10 words maximum
- **Description**: 1-2 short sentences
- **Action label**: 1-2 words (e.g., "Undo", "View", "Retry")

### When NOT to Use Toasts

- **Critical errors**: Use modal dialogs for issues requiring immediate attention
- **Complex actions**: Use dedicated UI for multi-step workflows
- **Persistent information**: Use banners or inline messages for content that should remain visible
- **Form validation**: Use inline field-level feedback

## Accessibility

### ARIA Roles & Live Regions

- All toasts use `role="status"` with `aria-live="polite"` by default
- Screen readers announce toast content without interrupting current focus
- For critical errors, consider using `role="alert"` (future enhancement)

### Keyboard Navigation

- **Escape**: Dismisses the focused toast
- **Tab**: Moves focus between toast actions and dismiss button
- Focus returns to previous element when toast is dismissed
- **Ctrl/⌘ + M**: Moves focus to the most recent toast in the queue

### Focus Management

- Toasts are programmatically focusable for keyboard-only users
- Global focus shortcut surfaces toast content without interrupting the user flow

### High-Contrast Mode

- Toast borders and text remain visible in forced-colors mode
- Intent icons provide semantic redundancy beyond color alone
- Dismiss button maintains clear visual affordances

## Design Tokens

Toasts derive their visual styling from the Statusables token system:

```css
/* Component tokens */
--cmp-status-{tone}-surface
--cmp-status-{tone}-border
--cmp-status-{tone}-text

/* Available tones */
neutral | info | accent | success | warning | critical
```

### Elevation & Shadows

```css
--shadow-overlay: var(--elevation-overlay);
```

### Motion

```css
--motion-duration-moderate: 300ms
--motion-easing-productive: cubic-bezier(0.2, 0, 0.38, 0.9)
```

Respects `prefers-reduced-motion` automatically.

## Testing

### Unit Testing

```tsx
import { toast } from '@oods/components/toast/toastService';

test('displays success toast', () => {
  const id = toast.success('Operation complete!');

  const queue = toast.getQueue();
  expect(queue[0].title).toBe('Operation complete!');
  expect(queue[0].intent).toBe('success');
});
```

### Integration Testing

```tsx
import { render } from '@testing-library/react';
import { ToastPortal } from '@oods/components/toast/ToastPortal';

test('renders toast in portal', async () => {
  const { container } = render(<ToastPortal />);

  toast.show({ intent: 'info', title: 'Test' });

  await waitFor(() => {
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });
});
```

## Examples

### Undo Action

```tsx
const handleDelete = (itemId: string) => {
  deleteItem(itemId);

  toast.show({
    intent: 'info',
    title: 'Item deleted',
    action: {
      label: 'Undo',
      onClick: () => restoreItem(itemId),
    },
  });
};
```

### Progress with Manual Dismiss

```tsx
const toastId = toast.show({
  intent: 'info',
  title: 'Processing file...',
  duration: 0, // Sticky
});

// Later, when complete
toast.dismiss(toastId);
toast.success('File processed successfully!');
```

### Multiple Positions

```tsx
// Top-right (default)
<ToastPortal position="top-right" />

// Bottom-left for secondary context
<ToastPortal position="bottom-left" maxVisible={3} />
```

## Migration Guide

### From Previous Toast Component

**Before:**
```tsx
<Toast
  open={open}
  onOpenChange={setOpen}
  tone="success"
  title="Saved"
/>
```

**After:**
```tsx
// In app root
<ToastPortal />

// Anywhere in your code
toast.success('Saved');
```

## Troubleshooting

### Toasts not appearing

1. Ensure `<ToastPortal />` is rendered in your app root
2. Check browser console for React errors
3. Verify toast service import path

### Stacking issues

- Adjust `maxVisible` prop on `<ToastPortal />`
- Check for CSS `z-index` conflicts

### Auto-dismiss not working

- Verify timers aren't being cleared elsewhere
- Check if `duration: 0` was set (sticky)
- Ensure component isn't unmounting prematurely

## Related Documentation

- [Statusables System](./statusables.md)
- [Banner Component](./banner.md)
- [Accessibility Guidelines](../a11y/guidelines.md)

## Changelog

### v1.0.0 (Sprint 18)
- Initial release with queue infrastructure
- Imperative API with automatic stacking
- Intent-based and status-based styling
- Comprehensive test coverage
