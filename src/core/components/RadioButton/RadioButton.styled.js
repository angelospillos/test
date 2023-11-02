import styled from 'styled-components';

import { COLOR } from '../../theme/colors';
import { ErrorMessage } from '../../theme/typography';

export const Input = styled.input.attrs(() => ({ type: 'radio' }))`
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
`;

export const Checkmark = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid #9fa0af;
  border-radius: 100%;
  position: relative;
  flex: none;
  cursor: pointer;

  &:before {
    content: '';
    width: 10px;
    height: 10px;
    background: ${COLOR.PRIMARY_LIGHT};
    border-radius: 100%;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) scale(0);
    transition: all 200ms ease-in-out;
  }

  ${Input}:checked + &:before {
    transform: translate(-50%, -50%) scale(1);
  }

  ${Input}:disabled + &:before {
    background: #9fa0af;
  }
`;

export const Container = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  margin: 2px 0;
`;

export const Label = styled.label`
  margin-left: 8px;
  margin-bottom: 2px;
  cursor: pointer;

  ${Input}:disabled ~ & {
    color: #9fa0af;
  }
`;

export const HorizontalRadioGroup = styled.div`
  display: flex;
  align-items: center;
  height: 38px;

  > div + div {
    margin-left: 22px;
  }

  + ${ErrorMessage} {
    margin-top: 0;
  }
`;
