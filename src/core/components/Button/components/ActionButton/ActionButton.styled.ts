import { animated } from '@react-spring/web';
import { either, pathOr, prop } from 'ramda';
import styled, { css } from 'styled-components';

import type { ActionButtonStyledProps } from './ActionButton.types';

import { CheckIcon, COLOR } from '../../../../theme';
import { styleWhenTrue } from '../../../../utils/rendering';
import LoaderBase from '../../../Loader';
import Button from '../../Button';
import { Content as ContentBase } from '../../Button.styled';

const isSuccess = pathOr<boolean>(false, ['success']);
const isPending = pathOr<boolean>(false, ['pending']);

export const Container = styled(Button)<ActionButtonStyledProps>`
  position: relative;
  padding: 0 20px;

  &:before {
    content: '';
    display: block;
    position: absolute;
    border-radius: 20px;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: ${COLOR.SUCCESS};
    z-index: 0;
    opacity: 0;
    transition: opacity 300ms ease;

    ${styleWhenTrue(
      prop('bordered'),
      css`
        top: -2px;
        left: -2px;
        width: calc(100% + 4px);
        height: calc(100% + 4px);
      `,
    )}

    ${styleWhenTrue(
      isSuccess,
      css`
        opacity: 1;
      `,
    )}
  }
`;

export const Loader = styled(LoaderBase).attrs(() => ({
  size: 'small',
}))``;

const animatedWrapperStyles = css`
  position: absolute;
  z-index: 1;
  top: 50%;
  transform: translateY(-50%);
  left: -14px;
`;

const animatedWrapperHiddenStyles = css`
  transition: opacity 400ms ease-in, transform 500ms ease-out;
  opacity: 0;
  transform: translateY(-50%) scale(0);
  transform-origin: center;
`;

const animatedWrapperVisibleStyles = css`
  opacity: 1;
  transform: translateY(-50%) scale(1);
`;

export const LoaderWrapper = styled.div`
  ${animatedWrapperStyles};
  ${animatedWrapperHiddenStyles};
  ${styleWhenTrue(isPending, animatedWrapperVisibleStyles)}
`;

export const IconWrapper = styled.div`
  ${animatedWrapperStyles};
  top: calc(50% - 1px);

  path {
    ${animatedWrapperHiddenStyles};
    transform: scale(0);
  }
  ${styleWhenTrue(
    isSuccess,
    css`
      path {
        ${animatedWrapperVisibleStyles}
        transform: scale(1);
      }
    `,
  )}
`;

export const SuccessIcon = styled(CheckIcon)`
  && {
    position: relative;
    width: 20px;
    height: 20px;
    color: ${COLOR.WHITE};
  }
`;

export const Content = styled(animated(ContentBase))<ActionButtonStyledProps>`
  z-index: 1;
  transition: transform 300ms ease;

  ${styleWhenTrue(
    either(isSuccess, isPending),
    css`
      transform: translateX(9px);
    `,
  )}

  ${styleWhenTrue(
    isSuccess,
    css`
      color: ${COLOR.WHITE};
    `,
  )};
`;

export const SuccessBackground = styled.i<ActionButtonStyledProps>``;

export const Wrapper = styled.div`
  position: relative;
`;
