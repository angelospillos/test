import { STATUS } from '@angelos/core/constants';

import i18n from '~/translations';

export const ASSERTION_PROPERTY = {
  VALUE: 'value',
  TEXT_CONTENT: 'textContent',
  COUNT: 'count',
  VISIBLE: 'visible',
  NOT_VISIBLE: 'notVisible',
  EXIST: 'exist',
  NOT_EXIST: 'notExist',
  CHECKED: 'checked',
  NOT_CHECKED: 'notChecked',
  CUSTOM_JAVASCRIPT: 'customJavaScript',
  PAGE_HAS_TITLE: 'pageTitle',
  PAGE_SHOWS_TEXT: 'pageShowsText',
  PAGE_DOES_NOT_SHOW_TEXT: 'pageDoesNotShowText',
  PAGE_URL_IS: 'pageUrlIs',
  DOWNLOAD_STARTED: 'downloadStarted',
};

export const ASSERTION_TYPE = {
  ANY: 'any',
  EQUAL: 'equal',
  NOT_EQUAL: 'notEqual',
  CONTAIN: 'contain',
  NOT_CONTAIN: 'notContain',
  GREATER_THAN: 'greaterThan',
  LESS_THAN: 'lessThan',
  MATCH: 'match',
  NOT_MATCH: 'notMatch',
};

export const RECORDING_MODE = {
  EVENT: 'modeEvent',
  ASSERT: 'modeAssert',
  HOVER: 'modeHover',
  SET_LOCAL_VARIABLE: 'modeSetLocalVariable',
  INSERT_LOCAL_VARIABLE: 'modeInsertLocalVariable',
};

export const STEP_TYPE = {
  GOTO: 'goto',
  TYPE: 'type',
  HOVER: 'hover',
  MOUSEDOWN: 'mouseDown',
  MOUSEUP: 'mouseUp',
  CLICK: 'click',
  DOUBLE_CLICK: 'dblClick',
  RIGHT_CLICK: 'rightClick',
  ASSERT: 'assert',
  CHANGE: 'change',
  CLEAR: 'clear',
  SCROLL: 'scroll',
  NEW_TAB: 'newTab',
  SWITCH_CONTEXT: 'switchContext',
  CLOSE_TAB: 'closeTab',
  PAGE_NAVIGATION: 'pageNavigation',
  EXECUTE: 'execute',
  UPLOAD_FILE: 'uploadFile',
  SELECT: 'select',
  DRAG_AND_DROP: 'dragAndDrop',
  ANSWER_PROMPT: 'answerPrompt',
  SET_LOCAL_VARIABLE: 'setLocalVariable',
};

export const STEP_SCROLL_TARGET_TYPE = {
  ELEMENT: 'element',
  WINDOW: 'window',
};

export const STEP_SCROLL_TO_TYPE = {
  COORDS: 'coords',
  EDGE: 'edge',
  UNTIL_NEXT_STEP_ELEMENT_IS_VISIBLE: 'untilNextStepElementIsVisible',
  INTO_VIEW: 'elementIntoView',
};

export const STEP_SCROLL_DIRECTION_TYPE = {
  DOWN: 'down',
  UP: 'up',
  RIGHT: 'right',
  LEFT: 'left',
};

export const INTERACTION_POSITION_TYPE = {
  SMART: 'smart',
  CUSTOM: 'custom',
  TOP_LEFT: 'topLeft',
  TOP_CENTER: 'topCenter',
  TOP_RIGHT: 'topRight',
  LEFT: 'middleLeft',
  CENTER: 'middleCenter',
  RIGHT: 'middleRight',
  BOTTOM_LEFT: 'bottomLeft',
  BOTTOM_CENTER: 'bottomCenter',
  BOTTOM_RIGHT: 'bottomRight',
};

export const STEP_SCROLL_EDGE_TYPE = INTERACTION_POSITION_TYPE;

export const EVENT_TYPE = {
  CHANGE: 'change',
  CLICK: 'click',
  DOUBLE_CLICK: 'dblclick',
  RIGHT_CLICK: 'contextmenu',
  KEYDOWN: 'keydown',
  KEYUP: 'keyup',
  MOUSEDOWN: 'mousedown',
  MOUSEOUT: 'mouseout',
  MOUSEOVER: 'mouseover',
  MOUSEMOVE: 'mousemove',
  MOUSEENTER: 'mouseenter',
  MOUSEUP: 'mouseup',
  SELECT: 'select',
  SCROLL: 'scroll',
  PASTE: 'paste',
  FOCUS: 'focus',
  INPUT: 'input',
  WHEEL: 'wheel',
  DRAG_START: 'dragstart',
  DRAG: 'drag',
  DRAG_END: 'dragend',
  DROP: 'drop',
  //
  GOTO: 'goto',
  PAGE_NAVIGATION: 'pageNavigation',
  NEW_TAB: 'newTab',
  CLOSE_TAB: 'closeTab',
  ASSERT: 'assert',
  HOVER: 'hover',
  SWITCH_CONTEXT: 'switchContext',
  ANSWER_PROMPT: 'answerPrompt',
  SET_LOCAL_VARIABLE: 'setLocalVariable',
  INSERT_LOCAL_VARIABLE: 'insertLocalVariable',
};

export const NAVIGATION_EVENTS = [
  EVENT_TYPE.GOTO,
  EVENT_TYPE.NEW_TAB,
  EVENT_TYPE.CLOSE_TAB,
  EVENT_TYPE.PAGE_NAVIGATION,
];

export const MOUSE_EVENT_TYPES = [
  EVENT_TYPE.MOUSEDOWN,
  EVENT_TYPE.MOUSEUP,
  EVENT_TYPE.CLICK,
  EVENT_TYPE.DOUBLE_CLICK,
  EVENT_TYPE.MOUSEMOVE,
  EVENT_TYPE.MOUSEOVER,
  EVENT_TYPE.MOUSEOUT,
  EVENT_TYPE.WHEEL,
];

export const ROOT_FRAME_ID = 0;

export const MAIN_FRAME_LOCATION = 'main';

export const MAIN_FRAME_DATA = {
  location: MAIN_FRAME_LOCATION,
  frameId: ROOT_FRAME_ID,
  isRoot: true,
  /* TODO src: window.location.href, not supported in SW */
  src: 'background',
};

export const DEFAULT_RUN_TIMEOUT_MILLISECONDS = 10000;

export const DELAY_AFTER_WINDOW_CLOSE_TO_PREVENT_COOKIES_PROBLEM = 1000;

export const WAITING_CONDITIONS_TIMEOUT_FACTOR_SMALL = 0.5;
export const WAITING_CONDITIONS_TIMEOUT_FACTOR_BIG = 0.7;

export const SCROLL_TIMEOUT_FACTOR_SMALL = 0.1;
export const SCROLL_TIMEOUT_FACTOR_BIG = 0.2;

export const PREDICTED_AVERAGE_STEP_EXECUTION_TIME = 4000;

export const TABS_API_RETRY_TIME = 200;

export const DND_TARGET_TYPE = {
  COORDS: 'coords',
  ELEMENT: 'element',
};

export const RUN_STATUS_LABEL = {
  [STATUS.RUNNING]: i18n.t('status.running', 'Running'),
  [STATUS.DEBUGGING]: i18n.t('status.debugging', 'Debugging'),
  [STATUS.PASSED]: i18n.t('status.passed', 'Passed'),
  [STATUS.FAILED]: i18n.t('status.failed', 'Failed'),
  [STATUS.ERROR]: i18n.t('status.error', 'Error'),
  [STATUS.STOPPED]: i18n.t('status.stopped', 'Stopped'),
};

export const LOGS_UPLOAD_TIMEOUT = 10 * 1000;
export const SCREENSHOT_UPLOAD_TIMEOUT = 10 * 1000;

export const MUTATION_SCREENSHOT_THROTTLE_TIME_MS = 1 * 1000;

export const STEP_TYPES_WITHOUT_CURSOR = [
  STEP_TYPE.CHANGE,
  STEP_TYPE.TYPE,
  STEP_TYPE.CLEAR,
  STEP_TYPE.SELECT,
];

export const SCREEN_RESOLUTION_TYPE = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
};

export const DEFAULT_MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/537.3';
