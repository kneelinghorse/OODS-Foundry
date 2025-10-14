import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

export type Tab = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  panel: ReactNode;
};

export type TabsProps = {
  tabs: Tab[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  ariaLabel?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
};

/**
 * Tabs with roving tabindex.
 * Keyboard: Arrow keys (by orientation), Home/End. Selection moves with focus.
 * Panels labelled by active tab via aria-controls/aria-labelledby.
 */
export function Tabs({ tabs, value, defaultValue, onChange, ariaLabel, orientation = 'horizontal', className }: TabsProps) {
  const isControlled = typeof value !== 'undefined';
  const [internal, setInternal] = useState<string | undefined>(defaultValue ?? tabs.find((t) => !t.disabled)?.id);
  const selectedId = isControlled ? value : internal;

  const idBase = useId();
  const tabId = (id: string) => `cmp-tabs-tab-${idBase}-${id}`;
  const panelId = (id: string) => `cmp-tabs-panel-${idBase}-${id}`;

  const enabledIndexes = useMemo(() => tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0), [tabs]);
  const selectedIndex = useMemo(() => Math.max(0, tabs.findIndex((t) => t.id === selectedId)), [tabs, selectedId]);
  const focusIndexRef = useRef<number>(selectedIndex);
  useEffect(() => {
    focusIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const setSelected = (id: string) => {
    if (!isControlled) setInternal(id);
    onChange?.(id);
  };

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  tabRefs.current = [];

  const isHorizontal = orientation === 'horizontal';

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key;
    const horizontalKeys = ['ArrowLeft', 'ArrowRight'];
    const verticalKeys = ['ArrowUp', 'ArrowDown'];
    const navKeys = isHorizontal ? horizontalKeys : verticalKeys;
    const shouldHandle = [...navKeys, 'Home', 'End'].includes(key);
    if (!shouldHandle) return;
    e.preventDefault();

    const move = (dir: 1 | -1) => {
      let next = focusIndexRef.current;
      do {
        next = (next + dir + tabs.length) % tabs.length;
      } while (tabs[next]?.disabled);
      focusIndexRef.current = next;
      const id = tabs[next]?.id;
      if (id) setSelected(id);
      tabRefs.current[next]?.focus();
    };

    if ((isHorizontal && key === 'ArrowRight') || (!isHorizontal && key === 'ArrowDown')) move(1);
    else if ((isHorizontal && key === 'ArrowLeft') || (!isHorizontal && key === 'ArrowUp')) move(-1);
    else if (key === 'Home') {
      const first = enabledIndexes[0] ?? 0;
      focusIndexRef.current = first;
      const id = tabs[first]?.id;
      if (id) setSelected(id);
      tabRefs.current[first]?.focus();
    } else if (key === 'End') {
      const last = enabledIndexes[enabledIndexes.length - 1] ?? tabs.length - 1;
      focusIndexRef.current = last;
      const id = tabs[last]?.id;
      if (id) setSelected(id);
      tabRefs.current[last]?.focus();
    }
  };

  const composedClassName = className ? `cmp-tabs ${className}` : 'cmp-tabs';

  return (
    <div className={composedClassName}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        className="cmp-tabs__list"
        onKeyDown={onKeyDown}
      >
        {tabs.map((t, idx) => {
          const selected = t.id === selectedId;
          const disabled = !!t.disabled;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={tabId(t.id)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              className="cmp-tabs__tab"
              data-selected={selected ? 'true' : undefined}
              disabled={disabled}
              onClick={() => {
                if (!disabled) setSelected(t.id);
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => {
        const selected = t.id === selectedId;
        return (
          <div
            key={t.id}
            id={panelId(t.id)}
            role="tabpanel"
            aria-labelledby={tabId(t.id)}
            hidden={!selected}
            className="cmp-tabs__panel"
          >
            {selected ? t.panel : null}
          </div>
        );
      })}
    </div>
  );
}

