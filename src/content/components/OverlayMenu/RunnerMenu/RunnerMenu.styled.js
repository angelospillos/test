import { COLOR } from '@angelos/core/theme/colors';
import { FONT_WEIGHT } from '@angelos/core/theme/fonts';
import styled from 'styled-components';

export const Results = styled.div`
  margin-bottom: 10px;
`;

export const ResultRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  margin-bottom: 2px;
  color: ${COLOR.GRAY_19};
`;

export const ResultLabel = styled.div`
  font-weight: ${FONT_WEIGHT.NORMAL};
  font-size: 13px;
  line-height: 18px;
  display: flex;
  align-items: center;
`;
