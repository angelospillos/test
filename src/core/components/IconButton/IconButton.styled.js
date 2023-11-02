import styled from 'styled-components';

import { COLOR } from '../../theme/colors';

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
`;
