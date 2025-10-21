import React, { cloneElement, forwardRef, isValidElement, useId, useRef, useState } from 'react';

export type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

/**
 * Tokenized Tooltip with keyboard + pointer triggers.
 * - Consumes only --cmp-* tokens via CSS classes
 * - Focusable trigger; Escape to dismiss
 * - Motion v1 tokens for show/hide; reduced-motion respected globally
 */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ content, children, side = 'top', open, defaultOpen, onOpenChange, className }, ref) => {
    const id = useId();
    const bubbleId = `cmp-tooltip-${id}`;
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(!!defaultOpen);
    const isControlled = typeof open === 'boolean';
    const isOpen = isControlled ? !!open : uncontrolledOpen;

    const setOpen = (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    };

    const composedClass = className ? `cmp-tooltip ${className}` : 'cmp-tooltip';

    const trigger = isValidElement(children)
      ? cloneElement(children as any, {
          'aria-describedby': isOpen ? bubbleId : undefined,
          'aria-haspopup': 'true',
          tabIndex: (children as any)?.props?.tabIndex ?? 0,
          onMouseEnter: (e: React.MouseEvent) => {
            (children as any)?.props?.onMouseEnter?.(e);
            setOpen(true);
          },
          onMouseLeave: (e: React.MouseEvent) => {
            (children as any)?.props?.onMouseLeave?.(e);
            setOpen(false);
          },
          onFocus: (e: React.FocusEvent) => {
            (children as any)?.props?.onFocus?.(e);
            setOpen(true);
          },
          onBlur: (e: React.FocusEvent) => {
            (children as any)?.props?.onBlur?.(e);
            setOpen(false);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            (children as any)?.props?.onKeyDown?.(e);
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
              (e.currentTarget as any)?.blur?.();
            }
          },
        } as any)
      : (children as React.ReactElement);

    return (
      <div
        ref={
          ref
            ? (node) => {
                wrapperRef.current = node;
                (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
              }
            : (wrapperRef as any)
        }
        className={composedClass}
        data-side={side}
      >
        {trigger}
        <div
          id={bubbleId}
          role="tooltip"
          className="cmp-tooltip__bubble"
          aria-hidden={isOpen ? undefined : true}
          data-open={isOpen ? 'true' : undefined}
        >
          <div className="cmp-tooltip__content">{content}</div>
        </div>
      </div>
    );
  }
);

Tooltip.displayName = 'Tooltip';
