/**
 * @file Stepper - Multi-step workflow indicator
 * @module components/stepper/Stepper
 */

import * as React from 'react';
import type { StepperProps, StepDescriptor, StepStatus } from './types.js';
import { getToneTokenSet, type StatusTone } from '../statusables/statusRegistry.js';
import './stepper.css';

const STATUS_ICON_MAP: Record<StepStatus, string> = {
  completed: '✓',
  current: '',
  incomplete: '',
  error: '✕',
  disabled: '',
  optional: '',
};

const STEP_STATUS_TONE_MAP: Record<StepStatus, StatusTone> = {
  completed: 'success',
  current: 'info',
  incomplete: 'neutral',
  error: 'critical',
  disabled: 'neutral',
  optional: 'accent',
};

const NEUTRAL_TOKENS = getToneTokenSet('neutral');
const INFO_TOKENS = getToneTokenSet('info');
const ACCENT_TOKENS = getToneTokenSet('accent');

const DISABLED_TEXT_COLOR = 'var(--sys-text-disabled)';
const SECONDARY_TEXT_COLOR = 'var(--sys-text-secondary)';
const ICON_SURFACE_DEFAULT = 'var(--sys-surface-raised)';
const DISABLED_SURFACE = 'var(--sys-surface-disabled)';
const FILL_CONTRAST_COLOR = 'var(--sys-text-on_interactive)';
const FOCUS_OUTLINE_COLOR = 'var(--sys-focus-text)';
const FOCUS_OUTLINE_WIDTH = 'var(--sys-focus-width, 2px)';
const OPTIONAL_LABEL_COLOR = ACCENT_TOKENS.foreground;

function resolveStepCssVariables(step: StepDescriptor): React.CSSProperties {
  const tone = STEP_STATUS_TONE_MAP[step.status] ?? 'neutral';
  const palette = getToneTokenSet(tone);
  const isDisabled = step.isDisabled || step.status === 'disabled';

  const borderColor = isDisabled ? NEUTRAL_TOKENS.border : palette.border;
  const iconColor = isDisabled
    ? DISABLED_TEXT_COLOR
    : step.status === 'incomplete'
      ? NEUTRAL_TOKENS.border
      : palette.foreground;
  const textColor = isDisabled
    ? DISABLED_TEXT_COLOR
    : step.status === 'incomplete'
      ? SECONDARY_TEXT_COLOR
      : palette.foreground;

  const fillColor =
    step.status === 'current' ||
    step.status === 'completed' ||
    step.status === 'error'
      ? palette.border
      : undefined;
  const iconSurface = isDisabled ? DISABLED_SURFACE : undefined;

  const cssVariables: Record<string, string> = {
    '--stepper-step-icon-color': iconColor,
    '--stepper-step-text-color': textColor,
    '--stepper-step-border-color': borderColor,
  };

  if (fillColor) {
    cssVariables['--stepper-step-fill-color'] = fillColor;
  }

  if (iconSurface) {
    cssVariables['--stepper-step-icon-surface'] = iconSurface;
  }

  return cssVariables as React.CSSProperties;
}

type StepperElement = React.ElementRef<'div'>;

interface StepItemProps {
  readonly step: StepDescriptor;
  readonly index: number;
  readonly isLast: boolean;
  readonly isClickable: boolean;
  readonly orientation: 'horizontal' | 'vertical';
  readonly onStepClick?: (stepId: string) => void;
}

const StepItem = React.memo<StepItemProps>(
  ({ step, index, isLast, isClickable, orientation, onStepClick }) => {
    const cssVariables = resolveStepCssVariables(step);
    const icon = STATUS_ICON_MAP[step.status];
    const showNumber = !icon && step.status !== 'current';

    const handleClick = () => {
      if (isClickable && onStepClick) {
        onStepClick(step.id);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        if (onStepClick) {
          onStepClick(step.id);
        }
      }
    };

    const stepClassName = [
      'stepper__step',
      `stepper__step--${step.status}`,
      isClickable ? 'stepper__step--clickable' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        className={stepClassName}
        style={cssVariables}
        data-step-id={step.id}
        data-step-status={step.status}
        data-step-tone={STEP_STATUS_TONE_MAP[step.status] ?? 'neutral'}
      >
        <div
          className="stepper__step-header"
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable && !step.isDisabled ? 0 : undefined}
          onClick={isClickable ? handleClick : undefined}
          onKeyDown={isClickable ? handleKeyDown : undefined}
          aria-current={step.status === 'current' ? 'step' : undefined}
          aria-disabled={step.isDisabled}
        >
          <div className="stepper__step-indicator">
            <div className="stepper__step-icon">
              {icon || (showNumber ? index + 1 : '')}
            </div>
          </div>
          <div className="stepper__step-content">
            <div className="stepper__step-label">
              {step.label}
              {step.isOptional && (
                <span className="stepper__step-optional"> (Optional)</span>
              )}
            </div>
            {step.description && (
              <div className="stepper__step-description">{step.description}</div>
            )}
          </div>
        </div>
        {!isLast && (
          <div
            className={`stepper__connector stepper__connector--${orientation}`}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
);

StepItem.displayName = 'OODS.StepItem';

/**
 * Stepper component for multi-step workflows
 *
 * @example
 * ```tsx
 * const steps = [
 *   { id: '1', label: 'Account', status: 'completed' },
 *   { id: '2', label: 'Billing', status: 'current' },
 *   { id: '3', label: 'Confirm', status: 'incomplete' },
 * ];
 *
 * <Stepper
 *   steps={steps}
 *   activeStepId="2"
 *   isLinear={false}
 *   onStepClick={(id) => console.log('Navigate to', id)}
 * />
 * ```
 */
export const Stepper = React.forwardRef<StepperElement, StepperProps>(
  (
    {
      steps,
      activeStepId,
      orientation = 'horizontal',
      isLinear = true,
      onStepClick,
      className,
      style,
      ...rest
    },
    forwardedRef
  ) => {
    const mergedClassName = [
      'stepper',
      `stepper--${orientation}`,
      isLinear ? 'stepper--linear' : 'stepper--non-linear',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const rootCssVariables = {
      '--stepper-connector-color': NEUTRAL_TOKENS.border,
      '--stepper-connector-active-color': INFO_TOKENS.border,
      '--stepper-step-icon-surface': ICON_SURFACE_DEFAULT,
      '--stepper-step-fill-contrast': FILL_CONTRAST_COLOR,
      '--stepper-step-description-color': SECONDARY_TEXT_COLOR,
      '--stepper-step-optional-color': OPTIONAL_LABEL_COLOR,
      '--stepper-focus-outline-color': FOCUS_OUTLINE_COLOR,
      '--stepper-focus-outline-width': FOCUS_OUTLINE_WIDTH,
    } as React.CSSProperties;

    const mergedStyleObject = style
      ? ({ ...rootCssVariables, ...style } as React.CSSProperties)
      : rootCssVariables;

    // Determine which steps are clickable based on linear mode
    const activeIndex = steps.findIndex((s) => s.id === activeStepId);
    const canClickStep = React.useCallback(
      (step: StepDescriptor, index: number) => {
        if (step.isDisabled || !onStepClick) {
          return false;
        }
        // In non-linear mode, all non-disabled steps are clickable
        if (!isLinear) {
          return true;
        }
        // In linear mode, only completed and current steps are clickable
        return index <= activeIndex;
      },
      [isLinear, activeIndex, onStepClick]
    );

    return (
      <div
        ref={forwardedRef}
        className={mergedClassName}
        style={mergedStyleObject}
        data-orientation={orientation}
        data-linear={isLinear}
        role="list"
        aria-label="Progress steps"
        {...rest}
      >
        {steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
            isClickable={canClickStep(step, index)}
            orientation={orientation}
            onStepClick={onStepClick}
          />
        ))}
      </div>
    );
  }
);

Stepper.displayName = 'OODS.Stepper';
