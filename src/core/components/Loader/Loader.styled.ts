import { prop, complement } from 'ramda';
import styled, { css } from 'styled-components';
import theme from 'styled-theming';

import type { LoaderStyledProps } from './Loader.types';

import { spinAnimation } from '../../theme/animations';
import { COLOR, hexToRgba } from '../../theme/colors';
import { THEME_MODE } from '../../theme/modes';
import { styleWhenTrue } from '../../utils/rendering';

const borderColor = theme.variants('mode', 'variant', {
  dark: {
    [THEME_MODE.LIGHT]: 'rgba(90, 90, 90, 0.82) rgba(184, 184, 184, 0.6) rgba(184, 184, 184, 0.6)',
  },
  light: {
    [THEME_MODE.LIGHT]: `${hexToRgba(COLOR.WHITE, 0.27)} ${hexToRgba(COLOR.WHITE, 0.8)} ${hexToRgba(
      COLOR.WHITE,
      0.8,
    )}`,
  },
});

const loaderSize: Record<NonNullable<LoaderStyledProps['size']>, number> = {
  large: 32,
  regular: 24,
  small: 16,
};

const loaderSizeStyles = ({ size }: { size: NonNullable<LoaderStyledProps['size']> }) => css`
  width: ${loaderSize[size]}px;
  height: ${loaderSize[size]}px;
`;

export const LoaderBase = styled.div<Required<LoaderStyledProps>>`
  border-radius: 100%;
  border-style: solid;
  border-width: 3px;
  border-color: ${borderColor};
  flex: none;

  ${loaderSizeStyles}
  ${styleWhenTrue(
    complement(prop('stopped')),
    css`
      animation: linear 2s ${spinAnimation} infinite;
    `,
  )}
`;

export const LoaderFlexContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;
