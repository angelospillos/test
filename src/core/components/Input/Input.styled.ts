import { prop } from 'ramda';
import styled, { css } from 'styled-components';

import type { InputStyledProps } from './Input.types';

import { COLOR, FONT_WEIGHT } from '../../theme';
import { styleWhenTrue } from '../../utils/rendering';

export const Container = styled.div``;

const commonAdornmentStyles = css`
  justify-content: center;
  font-weight: ${FONT_WEIGHT.BOLD};
  display: flex;
  padding: 0 11px 3px;
  align-items: center;
  flex: none;
  height: 100%;
`;

export const StartAdornment = styled.span`
  ${commonAdornmentStyles}
  border-right: 1px solid ${COLOR.GRAY_9};
  border-radius: 5px 0 0 5px;
  background-color: ${COLOR.GRAY_21};
  color: ${COLOR.GRAY_13};
  pointer-events: none;
`;

export const EndAdornment = styled.span`
  ${commonAdornmentStyles}
  color: #c5c5c5;
  padding-left: 0;
`;

export const InputWrapper = styled.div<InputStyledProps>`
  border: 2px solid ${COLOR.GRAY_9};
  background-color: ${COLOR.WHITE};
  height: 38px;
  border-radius: 5px;
  transition: all 150ms ease-in-out;
  display: flex;
  position: relative;
  width: auto;

  &[disabled] {
    pointer-events: none;
  }

  &:hover {
    border-color: ${COLOR.GRAY_10};
  }

  &:active,
  &:focus-within {
    border-color: ${COLOR.PRIMARY_LIGHT};
  }

  &[readonly] {
    border-color: ${COLOR.GRAY_9};
    background-color: ${COLOR.GRAY_28};
    opacity: 0.8;
  }

  ${styleWhenTrue(
    prop('fullWidth'),
    css`
      width: 100%;
    `,
  )}

  ${styleWhenTrue(
    prop('invalid'),
    css`
      border-color: ${COLOR.ERROR} !important;
    `,
  )}
`;

export const InputBase = styled.input`
  height: 100%;
  outline: none;
  flex: 1;
  border: none;
  font-size: inherit;
  color: inherit;
  font-weight: inherit;
  background: transparent;
  padding: 0 10px 3px;
  min-width: 0;
  border-radius: 3px;

  ::placeholder {
    color: ${COLOR.DARK_GRAY};
    font-weight: ${FONT_WEIGHT.MEDIUM};
    opacity: 0.33;
  }
`;

export const ErrorMessage = styled.div`
  color: ${COLOR.ERROR};
  font-weight: ${FONT_WEIGHT.MEDIUM};
  font-size: 13px;
`;
