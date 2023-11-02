import styled from 'styled-components';

import { COLOR } from '../../../../theme/colors';
import { FONT_WEIGHT } from '../../../../theme/fonts';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding-bottom: 7px;

  * + & {
    border-top: 1px solid ${COLOR.BORDER_GRAY};
  }
`;

export const Label = styled.label`
  color: ${COLOR.GRAY_13};
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  text-transform: uppercase;
  padding: 11px 15px 2px;
  margin: 0;
`;
