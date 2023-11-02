import { CloseIcon as CloseSVG, FONT_WEIGHT, COLOR, hexToRgba } from '@angelos/core/theme';
import styled from 'styled-components';

import IconButton from '~/components/IconButton';

export const Backdrop = styled.div`
  background-color: ${hexToRgba(COLOR.BLACK, 0.2)};
  overflow: auto;
  padding: 18vh 8px 30px;
  background-color: ${COLOR.DARK_GRAY_4};
  position: absolute;
  left: 0px;
  top: 0px;
  right: 0px;
  bottom: 0px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  pointer-events: none;
`;

export const Container = styled.div`
  border-radius: 5px;
  background-color: ${COLOR.WHITE};
  box-shadow: 0 14px 40px -9px ${COLOR.DARK_GRAY_5};
  position: relative;
  max-width: 570px;
  padding: 25px;
  min-width: 400px;
  pointer-events: all;
`;

export const Header = styled.div`
  font-size: 18px;
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  color: ${COLOR.BLACK};
  line-height: 20px;
  margin-top: -3px;
  padding-right: 37px;
  padding-bottom: 13px;
`;

export const Content = styled.div`
  padding-top: 7px;
`;

export const Footer = styled.div`
  margin-top: 33px;
  display: flex;
  align-items: center;
  justify-content: flex-end;

  ${Content} + &, ${Content} & {
    border-top: 1px solid ${COLOR.GRAY_40};
    padding-top: 20px;
  }
`;

export const CloseIcon = styled(CloseSVG)`
  width: 11px;
  height: 11px;
`;

export const CloseButton = styled(IconButton)`
  && {
    width: 40px;
    height: 40px;
    position: absolute;
    right: 0;
    top: 0;
    border-radius: 0;

    ${CloseIcon} {
      min-width: auto;
    }
  }
`;
