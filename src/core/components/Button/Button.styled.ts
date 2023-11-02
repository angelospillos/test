import { propEq } from 'ramda';
import styled, { css } from 'styled-components';
import theme from 'styled-theming';

import type { ButtonStyledProps, ButtonVariant } from './Button.types';

import { COLOR, hexToRgba, THEME_MODE, FONT_WEIGHT } from '../../theme';
import { styleWhenTrue } from '../../utils/rendering';

export const IconContainer = styled.span<Pick<ButtonStyledProps, 'iconPosition'>>`
  height: 20px;
  width: 20px;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;

  ${styleWhenTrue(
    propEq('iconPosition', 'right'),
    css`
      margin-left: 10px;
      margin-right: 0;
    `,
  )}
`;

export const Content = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  margin-bottom: 2px;

  &:empty {
    margin-left: -10px;
    padding: 0 !important;
  }
`;

const backgroundColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.ERRORBGCOLOR },
  default: { [THEME_MODE.LIGHT]: COLOR.TRANSPARENT },
  primary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_LIGHT },
  secondary: { [THEME_MODE.LIGHT]: COLOR.SECONDARY },
});

const backgroundHoverColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.ERROR },
  default: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_3 },
  primary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_LIGHT_ACTIVE },
  secondary: { [THEME_MODE.LIGHT]: COLOR.SECONDARY_LIGHT },
});

export const backgroundActiveColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.ERROR },
  default: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_3 },
  primary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_4 },
  secondary: { [THEME_MODE.LIGHT]: COLOR.SECONDARY_LIGHT },
});

const backgroundDisabledColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.SAMPLE_GRAY },
  default: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_3 },
  primary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_LIGHT_INACTIVE },
  secondary: { [THEME_MODE.LIGHT]: COLOR.SECONDARY_LIGHT },
});

const color = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.WHITE },
  default: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_LIGHT },
  primary: { [THEME_MODE.LIGHT]: COLOR.WHITE },
  secondary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY },
});

const colorDisabled = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.WHITE },
  default: { [THEME_MODE.LIGHT]: COLOR.SAMPLE_GRAY },
  primary: { [THEME_MODE.LIGHT]: COLOR.WHITE },
  secondary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY },
});

export const commonButtonStyles = css`
  outline: none !important;
  appearance: none;
  border: none;
  white-space: nowrap;
  border-radius: 20px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 150ms ease-in-out, border-color 150ms ease-in-out;
  cursor: pointer;
  height: 38px;
  letter-spacing: 0.13px;

  &:disabled {
    background-color: ${backgroundDisabledColor};
    color: ${colorDisabled};
    cursor: default;
  }

  & + button {
    margin-left: 9px;
  }

  ${IconContainer} + ${Content} {
    padding-right: 3px;
  }
`;

export const ButtonContainer = styled.button<Partial<ButtonStyledProps>>`
  ${commonButtonStyles};
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  background-color: ${backgroundColor};
  color: ${color};

  &:hover:not(:disabled) {
    background-color: ${backgroundHoverColor};
  }

  &:active:not(:disabled) {
    background-color: ${backgroundActiveColor};
  }
`;

export const borderColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.ERROR },
  default: { [THEME_MODE.LIGHT]: COLOR.GRAY_9 },
  primary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_LIGHT },
  secondary: { [THEME_MODE.LIGHT]: COLOR.SECONDARY },
});

export const borderHoverColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.ERROR },
  default: { [THEME_MODE.LIGHT]: COLOR.GRAY_10 },
  primary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_LIGHT_ACTIVE },
  secondary: { [THEME_MODE.LIGHT]: COLOR.SECONDARY },
});

export const borderedColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.ERROR },
  default: { [THEME_MODE.LIGHT]: COLOR.PRIMARY },
  primary: { [THEME_MODE.LIGHT]: COLOR.PRIMARY_LIGHT },
  secondary: { [THEME_MODE.LIGHT]: COLOR.BLACK },
});

export const borderedBgColor = theme.variants<'variant', ButtonVariant>('mode', 'variant', {
  danger: { [THEME_MODE.LIGHT]: COLOR.ERROR },
  default: { [THEME_MODE.LIGHT]: COLOR.WHITE },
  primary: { [THEME_MODE.LIGHT]: hexToRgba(COLOR.PRIMARY_LIGHT, 0.04) },
  secondary: { [THEME_MODE.LIGHT]: hexToRgba(COLOR.SECONDARY, 0.04) },
});

export const BorderedButtonContainer = styled.button<Partial<ButtonStyledProps>>`
  ${commonButtonStyles};
  background-color: ${COLOR.WHITE};
  border: 2px solid;
  border-color: ${borderColor};
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  color: ${borderedColor};
  &:hover:not(:disabled) {
    border-color: ${borderHoverColor};
    background-color: ${borderedBgColor};
  }

  &:disabled {
    border-color: ${COLOR.GRAY_7};
    background-color: ${COLOR.WHITE};
    color: ${COLOR.GRAY_8};
  }
`;
