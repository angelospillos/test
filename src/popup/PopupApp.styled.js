import { COLOR } from '@angelos/core/theme/colors';
import styled from 'styled-components';

import { ReactComponent as LogoSVG } from '~/images/logo.svg';

export const PopupWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 200px;
`;

export const Header = styled.header`
  padding: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const Logo = styled(LogoSVG)`
  width: 80px;
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
`;

export const Details = styled.div`
  opacity: 0.8;
  font-size: 11px;
  padding-left: 15px;
  margin-bottom: 16px;
`;

export const Text = styled.p`
  margin: 0;
  padding: 0;
`;

export const Footer = styled.footer``;

export const Button = styled.button`
  outline: none;
  border: none;
  white-space: nowrap;
  padding: 8px 0 10px 15px;
  font-size: 13px;
  display: flex;
  letter-spacing: 0.13px;
  min-width: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  text-align: left;
  text-overflow: ellipsis;
  overflow: hidden;
  cursor: pointer;
  color: ${COLOR.DARK_GRAY};

  &:hover {
    outline: none;
    background: ${COLOR.GRAY_14};
    text-transform: none !important;
  }

  svg {
    width: 18px;
    margin-right: 8px;
    margin-bottom: -2px;
  }
`;

export const GotoButton = styled(Button)`
  padding: 10px 21px 16px 15px;
  font-size: 13px;
  color: ${COLOR.PRIMARY_LIGHT};
  border-top: 1px solid ${COLOR.GRAY_9};
  background-color: ${COLOR.GRAY_21};

  svg {
    stroke: currentColor;
  }
`;
