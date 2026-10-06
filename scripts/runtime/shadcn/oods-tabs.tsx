import * as React from 'react';
import type { TabsProps } from '@oods/components-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/registry/new-york-v4/ui/tabs';

export const OodsTabs = React.forwardRef<HTMLDivElement, TabsProps>(function OodsTabs(
  { items, selectedId, defaultSelectedId, size = 'md', overflowLabel, ariaLabel, onChange, onUpdate, dir, 'aria-label': nativeLabel, ...props }, ref,
) {
  void overflowLabel; // This adapter scrolls the tab list; it has no overflow menu.
  const [local, setLocal] = React.useState(defaultSelectedId ?? items.find(item => !item.disabled && !item.isDisabled)?.id);
  const selected = selectedId ?? local;
  const notified = React.useRef(selected); notified.current = selected;
  const select = (id: string) => {
    if (id === notified.current) return;
    notified.current = id;
    if (selectedId === undefined) setLocal(id);
    onChange?.(id); onUpdate?.(id);
  };
  return <Tabs {...props} ref={ref} value={selected} defaultValue={defaultSelectedId} dir={dir === 'ltr' || dir === 'rtl' ? dir : undefined}
    data-oods-component={undefined} data-oods-adapter="Tabs" data-size={size} onValueChange={select}>
    <div className="max-w-full overflow-x-auto"><TabsList aria-label={ariaLabel ?? nativeLabel}>
      {items.map(item => <TabsTrigger key={item.id} data-tab-id={item.id} value={item.id} disabled={item.disabled || item.isDisabled} onFocus={item.disabled || item.isDisabled ? undefined : () => select(item.id)}
        className={size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : undefined}>{item.label}</TabsTrigger>)}
    </TabsList></div>
    {items.map(item => <TabsContent key={item.id} value={item.id}>{item.panel}</TabsContent>)}
  </Tabs>;
});
