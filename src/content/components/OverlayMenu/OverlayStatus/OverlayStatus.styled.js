import { COLOR } from '@angelos/core/theme/colors';
import { FONT_WEIGHT } from '@angelos/core/theme/fonts';
import styled from 'styled-components';

export const Container = styled.div`
  font-size: 12px;
  font-weight: 500;
`;

export const RecStatus = styled.div`
  color: ${COLOR.ERROR};
  display: flex;
  align-items: center;

  svg {
    margin-right: 7px;
    width: 9px;
  }
`;

export const LoadingStatus = styled.div`
  color: #666;
  display: flex;
  align-items: center;
  font-weight: ${FONT_WEIGHT.NORMAL};
  font-size: 12px;

  p {
    margin: 0;
    padding: 0;
    margin-left: 7px;
  }
`;

export const SavedStepStatus = styled.div`
  background-color: ${COLOR.SUCCESS};
  color: ${COLOR.WHITE};
  height: 21px;
  margin-right: -2px;

  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0px 9px 2px 5px;
  border-radius: 10px;
  box-sizing: border-box;

  svg {
    width: 15px;
    margin-top: 2px;
    margin-right: 3px;
  }
`;
