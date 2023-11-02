import { Input as InputBase, Tooltip as TooltipBase } from '@angelos/core/components';
import { COLOR } from '@angelos/core/theme/colors';
import styled from 'styled-components';

import { Headline as HeadlineBase } from '../../OverlayMenu.styled';

export const Headline = styled(HeadlineBase)`
  max-width: 210px;
  line-height: 140%;

  button {
    margin-top: -4px;
  }
`;

export const Content = styled.div`
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  max-width: 200px;
  color: ${COLOR.GRAY_11};

  button {
    margin-left: 0 !important;

    > span {
      margin-right: 6px;
    }

    > div {
      flex: none;
      justify-content: center;
    }
  }
`;

export const RadioButtons = styled.div`
  display: flex;
  flex-direction: column;
  row-gap: 9px;
`;

export const Input = styled(InputBase)`
  margin-bottom: 8px;
`;

export const GeneratedEmail = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 24px;
  margin-bottom: 12px;

  > div:last-child {
    display: flex;
    align-items: center;
    column-gap: 5px;
  }

  > div:last-child > span {
    word-break: break-all;
    flex: 1;
  }
`;

export const Tooltip = styled(TooltipBase)``;
