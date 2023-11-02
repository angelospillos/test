import { COLOR } from '@angelos/core/theme/colors';
import { createGlobalStyle } from 'styled-components';

import { FONTS_STYLESHEET } from './fonts';

export const GlobalStyle = createGlobalStyle`
  ${FONTS_STYLESHEET}

  body {
    height: 100%;
    margin: 0;
    padding: 0;
    font-size: 13px;
    color: ${COLOR.DARK_GRAY};
    letter-spacing: -0.01em;

    &, * {
      font-family: 'NeueFrutiger', sans-serif;
    }
  }
`;
