import type { ButtonIconPosition, ButtonVariant } from './Button.types';

export const BUTTON_VARIANT: Record<string, ButtonVariant> = {
  DEFAULT: 'default',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
};

export const ICON_POSITION: Record<string, ButtonIconPosition> = {
  RIGHT: 'right',
  LEFT: 'left',
};
