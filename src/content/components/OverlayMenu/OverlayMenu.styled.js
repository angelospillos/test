import { COLOR } from '@angelos/core/theme/colors';
import { FONT_WEIGHT } from '@angelos/core/theme/fonts';
import { styleWhenTrue } from '@angelos/core/utils/rendering';
import { prop } from 'ramda';
import styled, { css } from 'styled-components';

import ButtonBase, { BUTTON_VARIANT } from '~/components/Button';
import FormFieldBase from '~/components/FormField';
import { ReactComponent as LogoBase } from '~/images/logo.svg';

import { LoadingStatus, RecStatus } from './OverlayStatus/OverlayStatus.styled';

export const Header = styled.header`
  border-bottom: 1px solid #ededed;
  margin-left: -15px;
  padding: 0 8px;
  width: calc(100% + 30px);
  margin-bottom: 15px;
  height: 45px;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const HeaderContent = styled.div`
  flex: 1;
  padding: 8px 10px;
  border-radius: 5px;
  transition: background-color 150ms ease-in-out;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;

  &:hover {
    background-color: #f8f7fb;
  }
`;

export const Logo = styled(LogoBase)`
  width: 55px;
`;

export const Button = styled(ButtonBase).attrs(() => ({
  bordered: true,
  variant: BUTTON_VARIANT.PRIMARY,
}))`
  display: flex;
  padding-bottom: 2px;
  align-items: center;
  font-size: 12px;
  letter-spacing: 0.13px;
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  && + && {
    margin-left: 0;
  }
`;

export const PrimaryButton = styled(Button).attrs(() => ({
  bordered: false,
}))`
  width: 100%;

  div {
    flex: none;
  }
`;

export const BackButton = styled(Button).attrs(() => ({
  bordered: false,
  variant: BUTTON_VARIANT.DEFAULT,
}))`
  && {
    margin-bottom: -15px;
    width: 100%;

    div {
      flex: none;
    }
  }
`;

export const Buttons = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  > ${PrimaryButton} {
    justify-content: flex-start;
  }
`;

export const Headline = styled.h1`
  font-size: 15px;
  font-weight: ${FONT_WEIGHT.MEDIUM};
  line-height: 18px;
  letter-spacing: 0em;
  text-align: left;
  margin: 0;
  margin-bottom: 15px;
  display: flex;
  align-items: center;

  button {
    margin-left: -4px;
    margin-right: 4px;
    margin-bottom: -2px;
  }

  > button svg {
    fill: none;
  }
`;

export const Timeout = styled.div`
  display: flex;

  div {
    margin: 0 4px;
    flex: none;
  }
`;

export const RuntimeMessage = styled.div`
  max-width: 190px;
  margin-bottom: -10px;

  p,
  ${Timeout} {
    color: #666666;
    font-weight: 400;
    font-size: 13px;
    word-break: keep-all;
    margin: 0;
    padding: 0;
    width: 100%;

    &:first-child {
      margin-top: -5px;
    }
  }
`;

export const ToggleButton = styled.button`
  flex: none;
  background: #fff;
  border: none;
  color: ${COLOR.PRIMARY_LIGHT};
  padding: 6px;
  width: 31px;
  height: 31px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 0px;
  gap: 8px;
  box-shadow: 17px 17px 86px rgb(9 3 22 / 35%), 5.13px 5.125px 25.9265px rgb(9 3 22 / 19%),
    2.13px 2.12866px 10.7685px rgb(9 3 22 / 10%), 0.77px 0.769896px 3.89477px rgb(9 3 22 / 3%);
  border-radius: 41px;
  position: absolute;
  right: -15px;
  top: -15px;
  z-index: 1;
  cursor: pointer;
  transition: background-color 150ms ease-in-out;

  &:hover {
    background-color: #f8f7fb;
  }
`;

export const Container = styled.section`
  position: fixed;
  top: 100px;
  right: 30px;
  min-width: 240px;
  background: ${COLOR.WHITE};
  color: ${COLOR.BLACK};
  padding: 0 15px 25px;
  box-shadow: 0 7px 50px -3px rgba(47, 46, 55, 0.18), 0 1px 2px 0 rgba(30, 32, 59, 0.21);
  z-index: 9;
  border-radius: 7px;
  pointer-events: all;
  margin: 15px 15px 0 0;

  &[disabled] {
    pointer-events: none;
  }

  ${styleWhenTrue(
    prop('collapsed'),
    css`
      width: 112px;
      height: 31px;
      padding: 0;
      margin: 0;
      min-width: auto;
      border-radius: 50px;
      overflow: hidden;

      ${Header} {
        margin: 0;
        padding: 0;
        border: none;
        height: 100%;
        width: 100%;
      }

      ${HeaderContent} {
        padding: 4px 2px;
        margin-left: 4px;
        margin-right: 0;
        border-radius: 50px;
      }

      ${Logo}, ${Buttons} {
        display: none;
      }

      ${ToggleButton} {
        position: relative;
        top: auto;
        right: auto;
        box-shadow: none;
        width: 35px;
      }

      ${RecStatus}, ${LoadingStatus} {
        margin-left: 6px;

        p {
          display: none;
        }
      }

      ${RecStatus} {
        padding-bottom: 2px;

        svg {
          margin-bottom: -2px;
        }
      }
    `,
  )}
`;

export const FormField = styled(FormFieldBase)`
  && {
    padding-bottom: 15px;
    display: flex;
    flex-direction: column;

    label {
      color: ${COLOR.GRAY_19};
    }
  }
`;
