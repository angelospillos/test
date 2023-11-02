import { COLOR } from '@angelos/core/theme/colors';
import { styleWhenTrue } from '@angelos/core/utils/rendering';
import { prop } from 'ramda';
import styled, { css } from 'styled-components';

const pendingStyles = css`
  border-radius: 0;
  padding: 3px;

  &:hover,
  &:active {
    background-color: ${COLOR.TRANSPARENT};
  }

  svg {
    position: absolute;
    min-height: 0;
    min-width: 0;
    height: 8px;
    left: 50%;
    transform: translateX(-50%);
  }
`;

export const Container = styled.button`
  outline: none !important;
  appearance: none;
  border-radius: 5px;
  height: 30px;
  width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  border: 0;
  margin: 0;
  background-color: ${COLOR.TRANSPARENT};
  color: ${COLOR.BLACK};
  transition: all 150ms ease-in-out;
  cursor: pointer;
  position: relative;
  font-size: 19px;

  &:hover {
    background-color: ${COLOR.DARK_GRAY_3};
  }

  &:active {
    background-color: ${COLOR.GRAY_1};
  }

  & + & {
    margin-left: 14px;
  }

  &:disabled {
    pointer-events: none;
    color: ${COLOR.BORDER_GRAY};
  }

  svg {
    min-width: 15px;
    min-height: 15px;
    font-size: inherit;
    fill: currentColor;
  }

  ${styleWhenTrue(prop('pending'), pendingStyles)}
`;
