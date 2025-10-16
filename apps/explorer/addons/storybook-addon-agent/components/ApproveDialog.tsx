import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { styled } from 'storybook/theming';

type ApproveDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
};

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const Dialog = styled.div`
  width: min(90%, 380px);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111;
`;

const Body = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: #333;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const SecondaryButton = styled.button`
  min-width: 96px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  background: #fff;
  color: #111;
  font-weight: 500;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid #1663ff;
    outline-offset: 2px;
  }
`;

const PrimaryButton = styled.button<{ $loading: boolean }>`
  min-width: 128px;
  padding: 6px 18px;
  border-radius: 6px;
  border: none;
  background: ${({ $loading }) => ($loading ? 'rgba(22, 99, 255, 0.6)' : '#1663ff')};
  color: #fff;
  font-weight: 600;
  cursor: ${({ $loading }) => ($loading ? 'wait' : 'pointer')};

  &:disabled {
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid #0f4cd2;
    outline-offset: 2px;
  }
`;

export function ApproveDialog({ open, onConfirm, onCancel, confirming = false }: ApproveDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const { current } = dialogRef;
    if (!current) return;

    const handleFocus = (event: FocusEvent) => {
      if (!current.contains(event.target as Node)) {
        event.stopPropagation();
        cancelRef.current?.focus();
      }
    };
    document.addEventListener('focus', handleFocus, true);
    return () => {
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = [cancelRef.current, confirmRef.current].filter(
      (el): el is HTMLButtonElement => Boolean(el)
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  };

  if (!open) return null;

  return (
    <Backdrop role="presentation">
      <Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-dialog-title"
        aria-describedby="approve-dialog-body"
        onKeyDown={handleKeyDown}
      >
        <Title id="approve-dialog-title">Approve &amp; Apply changes?</Title>
        <Body id="approve-dialog-body">
          You are about to write new artifacts to <code>/artifacts/current-state/YYYY-MM-DD</code>. This action
          requires approval.
        </Body>
        <ButtonRow>
          <SecondaryButton type="button" onClick={onCancel} ref={cancelRef}>
            Cancel
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={onConfirm}
            ref={confirmRef}
            disabled={confirming}
            $loading={confirming}
          >
            {confirming ? 'Applying…' : 'Approve & Apply'}
          </PrimaryButton>
        </ButtonRow>
      </Dialog>
    </Backdrop>
  );
}
