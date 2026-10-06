import type { ButtonHTMLAttributes, ReactElement, MouseEvent } from 'react';
export interface TeamButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  caption?: string;
  appearance?: string;
  onActivate?: (event: MouseEvent<HTMLButtonElement>) => void;
}
export declare function TeamButton(props: TeamButtonProps): ReactElement;
