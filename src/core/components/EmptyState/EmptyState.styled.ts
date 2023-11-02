import * as R from 'ramda';
import styled, { css } from 'styled-components';

import { CoffeePixelIcon as CoffeePixelIconBase, COLOR, FONT_WEIGHT } from '../../theme';
import { styleWhenTrue } from '../../utils/rendering';

const isSmall = R.pathOr<boolean>(false, ['small']);
const getContainerInlineStyles = R.ifElse(
  R.pathOr<boolean>(false, ['inline']),
  () => css`
    padding: 30px 0;
    position: relative;
  `,
  R.always(''),
);

const getContainerSmallStyles = R.ifElse(
  isSmall,
  () => css`
    padding: 15px 0;
  `,
  R.always(''),
);

const getTextWrapperSmallStyles = styleWhenTrue(
  isSmall,
  css`
    margin-top: 5px;
    margin-bottom: 0;
  `,
);

export const Container = styled.div<{ inline: boolean; small: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2;
  ${getContainerInlineStyles};
  ${getContainerSmallStyles};
`;

const getCoffeePixelIconSmallStyles = styleWhenTrue(
  isSmall,
  css`
    width: 60px;
    height: 60px;
  `,
);

export const CoffeePixelIcon = styled(CoffeePixelIconBase)`
  width: 96px;
  height: 96px;
`;

export const IconWrapper = styled.div<{ small: boolean }>`
  ${CoffeePixelIcon} {
    ${getCoffeePixelIconSmallStyles}
  }
`;

const textStyle = css`
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  text-align: center;
`;

export const Text = styled.span`
  display: block;
  color: ${COLOR.GRAY_23};
  ${textStyle};
`;

export const ActionButton = styled.button`
  ${textStyle};
  border: none;
  box-shadow: none;
  color: ${COLOR.PRIMARY_LIGHT};
  padding: 0;
  margin: 0;
  background-color: transparent;
  font-weight: ${FONT_WEIGHT.SEMIBOLD};

  &:focus {
    outline: 0;
  }

  &:hover {
    text-decoration: underline;
  }
`;

export const TextWrapper = styled.div<{ small: boolean }>`
  margin-top: 16px;
  margin-bottom: 24px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 300px;
  ${getTextWrapperSmallStyles}
`;
