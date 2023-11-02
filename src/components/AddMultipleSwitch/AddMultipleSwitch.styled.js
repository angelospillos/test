import TooltipBase from '@angelos/core/components/Tooltip';
import { COLOR } from '@angelos/core/theme/colors';
import styled from 'styled-components';

export const Container = styled.div`
  padding: 8px 14px 8px 14px;
  border-radius: 8px;
  background: ${COLOR.GRAY_14};
  border-radius: 8px;
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: center;
  color: ${COLOR.DARK_GRAY};
  margin-top: 30px;

  svg {
    margin-bottom: -2px;
    margin-left: 6px;
  }
`;

export const Tooltip = styled(TooltipBase)`
  && {
    width: 198px;
    transform: translate(-62px, -16px);
  }
`;
