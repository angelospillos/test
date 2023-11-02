import TooltipBase, { TOOLTIP_ANCHOR } from '@angelos/core/components/Tooltip';
import { STATUS } from '@angelos/core/constants';
import { COLOR } from '@angelos/core/theme/colors';
import { styleWhenTrue } from '@angelos/core/utils/rendering';
import styled, { css } from 'styled-components';

import { STATUS_COLOR } from './StatusBadge.constants';

const getStatusColor = ({ status }) => STATUS_COLOR[status];

export const IconContainer = styled.div`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  float: left;
`;

export const Container = styled.div`
  display: inline-block;
  align-items: center;
  color: ${COLOR.GRAY_12};

  ${styleWhenTrue(
    ({ status }) => [STATUS.FAILED, STATUS.ERROR].includes(status),
    css`
      color: ${getStatusColor};
    `,
  )}

  ${IconContainer} {
    color: ${getStatusColor};

    ${styleWhenTrue(
      ({ status }) => [STATUS.FAILED].includes(status),
      css`
        width: 14px;
        margin-bottom: -2px;
      `,
    )}
  }
`;

export const Label = styled.label`
  float: left;
  line-height: 14px;
  margin-left: 10px;
  color: inherit;
`;

export const Tooltip = styled(TooltipBase).attrs(() => ({
  anchor: TOOLTIP_ANCHOR.BOTTOM_CENTER,
  offset: 5,
}))``;
