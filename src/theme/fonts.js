import NeueFrutigerBold from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-Bold/font.woff';
import NeueFrutigerBoldWoff2 from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-Bold/font.woff2';
import NeueFrutigerBoldItalic from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-BoldIt/font.woff';
import NeueFrutigerBoldItalicWoff2 from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-BoldIt/font.woff2';
import NeueFrutigerMedium from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-Medium/font.woff';
import NeueFrutigerMediumWoff2 from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-Medium/font.woff2';
import NeueFrutigerMediumItalic from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-MediumIt/font.woff';
import NeueFrutigerMediumItalicWoff2 from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-MediumIt/font.woff2';
import NeueFrutigerRegular from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-Regular/font.woff';
import NeueFrutigerRegularWoff2 from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-Regular/font.woff2';
import NeueFrutigerRegularItalic from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-RegularIt/font.woff';
import NeueFrutigerRegularItalicWoff2 from '@angelos/core/fonts/NeueFrutiger/FrutigerNeueLTPro-RegularIt/font.woff2';
import { FONT_WEIGHT } from '@angelos/core/theme';

export const FONTS_STYLESHEET = `
  @font-face {
    font-family: 'NeueFrutiger';
    src: url(${chrome.runtime.getURL(NeueFrutigerRegularWoff2)}) format('woff2'),
      url(${chrome.runtime.getURL(NeueFrutigerRegular)}) format('woff');
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'NeueFrutiger';
    src: url(${chrome.runtime.getURL(NeueFrutigerRegularItalicWoff2)}) format('woff2'),
      url(${chrome.runtime.getURL(NeueFrutigerRegularItalic)}) format('woff');
    font-style: italic;
    font-display: swap;
  }

  @font-face {
    font-family: 'NeueFrutiger';
    src: url(${chrome.runtime.getURL(NeueFrutigerMediumWoff2)}) format('woff2'),
      url(${chrome.runtime.getURL(NeueFrutigerMedium)}) format('woff');
    font-weight: ${FONT_WEIGHT.MEDIUM};
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'NeueFrutiger';
    src: url(${chrome.runtime.getURL(NeueFrutigerMediumItalicWoff2)}) format('woff2'),
      url(${chrome.runtime.getURL(NeueFrutigerMediumItalic)}) format('woff');
    font-weight: ${FONT_WEIGHT.MEDIUM};
    font-style: italic;
    font-display: swap;
  }

  @font-face {
    font-family: 'NeueFrutiger';
    src: url(${chrome.runtime.getURL(
      NeueFrutigerBoldWoff2,
    )}) format('woff2'), url(${chrome.runtime.getURL(NeueFrutigerBold)}) format('woff');
    font-weight: ${FONT_WEIGHT.BOLD};
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'NeueFrutiger';
    src: url(${chrome.runtime.getURL(NeueFrutigerBoldItalicWoff2)}) format('woff2'),
      url(${chrome.runtime.getURL(NeueFrutigerBoldItalic)}) format('woff');
    font-weight: ${FONT_WEIGHT.BOLD};
    font-style: italic;
    font-display: swap;
  }
`;
