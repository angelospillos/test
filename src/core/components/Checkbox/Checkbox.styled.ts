import { prop } from 'ramda';
import styled, { css } from 'styled-components';

import type { CheckboxStyledProps, CheckmarkContainerStyledProps } from './Checkbox.types';

import { COLOR } from '../../theme';
import * as Icons from '../../theme/icons';
import { styleWhenTrue } from '../../utils/rendering';

export const Input = styled.input.attrs(() => ({ type: 'checkbox' }))`
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
`;

const iconStyles = css`
  && {
    display: none;
    width: 18px;
    height: 18px;
    color: ${COLOR.PRIMARY_LIGHT};
  }
`;

export const CheckIcon = styled(Icons.CheckIcon)`
  ${iconStyles}
`;

export const IndeterminateIcon = styled(Icons.RemoveIcon)`
  ${iconStyles}
`;

export const CheckmarkContainer = styled.div<CheckmarkContainerStyledProps>`
  width: 20px;
  height: 20px;
  border: 2px solid ${COLOR.GRAY_3};
  background-color: ${COLOR.WHITE};
  border-radius: 4px;
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 150ms ease-in-out;

  ${Input}:checked + & ${CheckIcon},
  ${Input}:indeterminate + & ${IndeterminateIcon} {
    display: block;
  }

  ${styleWhenTrue(
    prop('small'),
    css`
      width: 18px;
      height: 18px;
    `,
  )}
`;

export const Container = styled.div<CheckboxStyledProps>`
  position: relative;
  display: flex;
  margin: 2px 0;
  overflow: hidden;
  cursor: pointer;
  width: auto;
  background: ${COLOR.WHITE};

  ${styleWhenTrue(
    prop('disabled'),
    css`
      pointer-events: none;

      ${CheckmarkContainer} {
        border-color: ${COLOR.GRAY_9};
        background: ${COLOR.GRAY_28};
      }
    `,
  )}
  &:hover ${CheckmarkContainer} {
    border-color: ${COLOR.GRAY_11};
    cursor: pointer;
  }
`;

export const Label = styled.label`
  margin-left: 8px;
  margin-bottom: 0;
  cursor: pointer;
  line-height: 19px;
`;
