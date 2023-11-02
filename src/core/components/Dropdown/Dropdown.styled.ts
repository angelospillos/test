import { prop, propEq, complement } from 'ramda';
import styled, { css } from 'styled-components';

import type { DropdownItemProps, DropdownToggleButtonProps } from './Dropdown.types';

import { ArrowDownIcon, COLOR, hexToRgba, FONT_WEIGHT } from '../../theme';
import { styleWhenTrue } from '../../utils/rendering';
import Button from '../Button';
import Link from '../Link';

import { DROPDOWN_VARIANT } from './Dropdown.constants';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
`;

export const ItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  min-width: 120px;
  border-radius: 5px;
  background-color: ${COLOR.WHITE};
  position: fixed;
  top: 0;
  left: 0;
  z-index: 5;
  overflow: auto;
  pointer-events: all;
  box-shadow: 0 20px 70px 0 ${hexToRgba(COLOR.BLACK, 0.23)},
    0 4px 15px 0 ${hexToRgba(COLOR.BLACK, 0.28)};
`;

const itemStyles = css`
  white-space: nowrap;
  display: inline-block;
  padding: 8px 21px 10px 12px;
  border: none;
  background: ${COLOR.TRANSPARENT};
  min-width: 120px;
  width: 100%;
  color: ${COLOR.DARK_GRAY};
  outline: none !important;
  text-align: left;

  &:not(:disabled) {
    cursor: pointer;
  }

  &:not(:disabled):hover,
  &:not(:disabled):focus {
    background: ${COLOR.GRAY_14};
    text-transform: none !important;
  }

  &:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  svg {
    margin-right: 8px;
    margin-top: 0;
    width: 20px;
    max-height: 20px;
    top: -1px;
    position: relative;
    font-size: 20px;
  }

  ${styleWhenTrue(
    prop('small'),
    css`
      padding: 9px 21px 10px 10px;
    `,
  )}

  ${styleWhenTrue(
    prop('danger'),
    css`
      margin-top: -1px;
      color: ${COLOR.ERROR};
    `,
  )}

  ${styleWhenTrue(
    (props: { danger?: boolean; noDivider?: boolean }): boolean =>
      !!props?.danger && !props?.noDivider,
    css`
      border-top: 1px solid #eaeaea;
    `,
  )}
`;

export const Item = styled.button.attrs(() => ({
  role: 'menuitem',
}))<DropdownItemProps>`
  ${itemStyles}
`;

export const LinkItem = styled(Link)<DropdownItemProps>`
  ${itemStyles};
  font-weight: ${FONT_WEIGHT.NORMAL};
  color: ${COLOR.DARK_GRAY};

  &:hover {
    color: ${COLOR.DARK_GRAY};
    text-decoration: none;
  }
`;

export const ToggleButton = styled(Button)<DropdownToggleButtonProps>`
  margin: 0;
  height: 38px;

  ${styleWhenTrue(
    prop('error'),
    css`
      border-color: ${COLOR.ERROR};
    `,
  )}

  ${styleWhenTrue(
    prop('withExpander'),
    css`
      padding: 0 14px 0 12px;
    `,
  )}

  ${styleWhenTrue(
    complement(prop('rounded')),
    css`
      border-radius: 5px;
      padding: 0 10px 0 12px;
    `,
  )}

  ${styleWhenTrue(
    propEq('variant', DROPDOWN_VARIANT.DEFAULT),
    css`
      font-weight: ${FONT_WEIGHT.NORMAL};
    `,
  )}

  ${styleWhenTrue(
    propEq('variant', DROPDOWN_VARIANT.INLINE),
    css`
      font-weight: ${FONT_WEIGHT.NORMAL};
      font-size: 13px;
      line-height: 13px;
      border: 0;
      padding: 0;
      height: auto;
      color: ${COLOR.GRAY_13};
    `,
  )}


  ${styleWhenTrue(
    prop('condensed'),
    css`
      padding: 0;
      border: none;
    `,
  )}
`;

export const ToggleButtonLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  line-height: 17px;
`;

export const ExpandIcon = styled(ArrowDownIcon)`
  margin-left: 5px;
  margin-right: -5px;
  margin-top: 2px;
  color: inherit;

  ${styleWhenTrue(
    propEq('variant', DROPDOWN_VARIANT.DEFAULT),
    css`
      color: ${COLOR.GRAY_27};
    `,
  )}

  ${styleWhenTrue(
    propEq('variant', DROPDOWN_VARIANT.INLINE),
    css`
      margin-left: 0;
      color: ${COLOR.GRAY_13};
    `,
  )}

  flex: none;
  && {
    font-size: 19px;
  }
`;

export const Backdrop = styled.div`
  position: fixed;
  z-index: 10;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
`;
