import styled, { css } from 'styled-components';

import { COLOR, FONT_WEIGHT } from '../../theme';
import ButtonBase from '../Button';
import IconButtonBase from '../IconButton';

const buttonStyles = css`
  padding-left: 0;
  padding-right: 0;
  color: ${COLOR.GRAY_10};
  flex: none;

  &:hover {
    color: ${COLOR.DARK_GRAY};
  }

  &:disabled {
    color: ${COLOR.PRIMARY_LIGHT};
  }

  svg {
    height: 16px;
  }
`;

export const Button = styled(ButtonBase)`
  && {
    ${buttonStyles}
    background-color: ${COLOR.TRANSPARENT};
    font-weight: ${FONT_WEIGHT.NORMAL};
    width: 140px;

    &:hover {
      background-color: ${COLOR.TRANSPARENT};
    }

    &:disabled {
      color: ${COLOR.PRIMARY_LIGHT};
    }

    span {
      margin-right: 5px;
    }
  }
`;

export const IconButton = styled(IconButtonBase)`
  && {
    ${buttonStyles}
  }
`;
