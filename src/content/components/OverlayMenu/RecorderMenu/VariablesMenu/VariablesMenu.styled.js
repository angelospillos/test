import SelectBase from '@angelos/core/components/Select';
import VariableNameBase from '@angelos/core/components/VariableName';
import { FONT_WEIGHT, COLOR } from '@angelos/core/theme';
import styled from 'styled-components';

export const Content = styled.div`
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  max-width: 210px;

  > svg {
    color: ${COLOR.GRAY_8};
    opacity: 0.6;
    width: 45px;
    height: 45px;
    margin-bottom: 16px;
    flex: none;
    align-self: center;
  }

  button {
    margin-left: 0 !important;
  }
`;

export const Text = styled.div`
  margin-bottom: 8px;
  text-align: center;
  color: ${COLOR.GRAY_11};
`;

export const VariableItem = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  height: 100%;

  span {
    width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    line-height: 146%;
    font-weight: ${FONT_WEIGHT.NORMAL};
  }

  span:first-child {
    font-size: 13px;
    color: ${COLOR.DARK_GRAY};
  }

  span:last-child {
    font-size: 12px;
    line-height: 146%;
    color: #666666;
  }
`;

export const ActionSection = styled.section`
  margin-bottom: 8px;
  margin-top: 8px;
  padding: 0 5px;

  & + & {
    margin-top: 16px;
  }

  & + button {
    margin-top: 8px;
  }
`;

export const ActionHeadline = styled.div`
  display: flex;
  align-items: baseline;
  margin-bottom: 8px;
  line-height: 16px;
  font-weight: ${FONT_WEIGHT.MEDIUM};
  color: #666666;
  font-size: 12px;

  > span {
    width: 14px;
    height: 14px;
    padding-bottom: 1px;
    font-size: 11px;
    background: ${COLOR.GRAY_9};
    color: inherit;
    text-align: center;
    border-radius: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 5px;
    flex: none;
  }
`;

export const Select = styled(SelectBase)`
  && > button {
    height: 50px;
  }
`;

export const VariableName = styled(VariableNameBase)`
  margin-left: 4px;
  white-space: break-spaces;
  word-break: break-all;
`;

export const InsertDescription = styled.div`
  word-break: break-all;
  font-size: 12px;
  line-height: 133%;
  letter-spacing: -0.01em;
  color: ${COLOR.GRAY_12};
`;

export const LoaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 150px;
  align-items: center;
  justify-content: center;
`;
