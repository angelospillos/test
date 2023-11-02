import { FONT_WEIGHT, COLOR } from '@angelos/core/theme';
import { HelpIcon as HelpIconBase } from '@angelos/core/theme/icons';
import styled from 'styled-components';

export const Container = styled.div`
  padding-bottom: 20px;

  &[data-disabled='true'] {
    opacity: 0.5;
  }
`;

export const Label = styled.label`
  line-height: 16px;
  font-weight: ${FONT_WEIGHT.MEDIUM};
  color: ${COLOR.DARK_GRAY};
  width: 100%;
  margin: 0;
  padding-bottom: 5px;
`;

export const Description = styled.p`
  padding-top: 1px;
  color: ${COLOR.GRAY_19};
  line-height: 16px;
  margin: 0;
  padding-bottom: 8px;
`;

export const HelperIcon = styled(HelpIconBase)`
  margin-left: 6px;
  color: #858585;
  width: 14px;
  top: -2px;
  position: relative;
`;

export const LabelWithHelper = styled.div`
  display: flex;
  align-items: center;

  ${Label} {
    width: auto;
  }
`;
