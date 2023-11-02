import { COLOR } from '@angelos/core/theme/colors';
import styled from 'styled-components';

export const Content = styled.div`
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  justify-content: center;
  max-width: 190px;
  color: ${COLOR.GRAY_11};

  > svg {
    color: ${COLOR.GRAY_8};
    opacity: 0.6;
    width: 45px;
    height: 45px;
    margin-bottom: 16px;
  }
`;
