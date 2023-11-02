import styled from 'styled-components';

import { CURSOR_ANIMATION_TIME_MS } from '~/constants/animations';

export const CursorContainer = styled.span`
  pointer-events: none;
  position: fixed;
  z-index: 10;
  transition: ${CURSOR_ANIMATION_TIME_MS}ms all ease-in-out;
  display: none;
`;
