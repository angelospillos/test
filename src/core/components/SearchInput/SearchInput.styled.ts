import { prop } from 'ramda';
import styled, { css } from 'styled-components';

import type { SearchInputStyledProps } from './SearchInput.types';

import { SearchIcon as SearchSVG, COLOR, FONT_WEIGHT } from '../../theme';
import { styleWhenTrue } from '../../utils/rendering';
import Input from '../Input';

export const Container = styled.div<SearchInputStyledProps>`
  position: relative;
  width: 140px;

  ${styleWhenTrue(
    prop('fullWidth'),
    css`
      width: 100%;
    `,
  )}
`;

export const TextInput = styled(Input)<SearchInputStyledProps>`
  border: none;
  border-bottom: 2px solid ${COLOR.GRAY_9};
  padding: 6px 11px 4px 15px;
  min-height: 100%;
  font-size: 14px;
  outline: none;
  transition: border-color 200ms ease-in-out;
  border-radius: 0;

  ::placeholder {
    color: ${COLOR.BLACK};
    font-weight: ${FONT_WEIGHT.MEDIUM};
    opacity: 0.33;
  }
`;

export const SearchIcon = styled(SearchSVG)`
  left: -2px;
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.33;
  z-index: 0;
`;
