import { flatten } from 'ramda';

export const WINDOW_MOVE_INTERVAL_TIME = 250;

export const TAB_STATUS = {
  LOADING: 'loading',
  COMPLETED: 'completed',
};

export const WINDOW_STATUS = {
  CLOSING: 'closing',
};

export const TRANSITION_QUALIFIER = {
  FROM_ADDRESS_BAR: 'from_address_bar',
};

export const TRANSITION_TYPE = {
  TYPED: 'typed',
  RELOAD: 'reload',
};

export const SUPPORTED_BROWSERS = ['chrome', 'brave', 'edge'];

export const NEW_TAB_URLS = SUPPORTED_BROWSERS.map((browser) => `${browser}://newtab/`);

export const ABOUT_PAGE_URL = 'about:';

export const EXCLUDED_NEW_TAB_URLS = flatten(
  SUPPORTED_BROWSERS.map((browser) => [
    browser,
    `${browser}://newtab`,
    `${browser}://new-tab-page`,
  ]),
);

export const EXCLUDED_BROWSER_URLS = flatten([
  ABOUT_PAGE_URL,
  `${process.env.BLANK_PAGE_URL}`,
  // https://developer.chrome.com/docs/extensions/mv3/match_patterns/
  'data:',
  'chrome-untrusted:',
  'chrome-extension:',
  'chrome-error:',
  'view-source:',
  'file:',
  'blob:',
  ...EXCLUDED_NEW_TAB_URLS,
]);

export const EXCLUDED_FRAME_FILE_EXTENSIONS = ['svg'];

export const EXCLUDED_EXTERNAL_URLS = [
  'addservice.google',
  'fls.doubleclick.net',
  '.doubleclick.net',
];

export const HTMLTags = {
  HTML: 'HTML',
  INPUT: 'INPUT',
  TEXTAREA: 'TEXTAREA',
  SELECT: 'SELECT',
  SVG: 'SVG',
  STYLE: 'STYLE',
  IFRAME: 'IFRAME',
  FRAME: 'FRAME',
  SCRIPT: 'SCRIPT',
  LABEL: 'LABEL',
  IMAGE: 'IMG',
  OPTION: 'OPTION',
};

export const HTMLInputTypes = {
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  TEXT: 'text',
  FILE: 'file',
  RANGE: 'range',
  PASSWORD: 'password',
  NUMBER: 'number',
  DATE: 'date',
  TIME: 'time',
  DATETIME_LOCAL: 'datetime-local',
  WEEK: 'week',
  MONTH: 'month',
  COLOR: 'color',
  EMAIL: 'email',
  SEARCH: 'search',
};
