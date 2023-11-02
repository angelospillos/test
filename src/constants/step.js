import i18n from '~/translations';

export const WAITING_CONDITION_TYPE = {
  DOCUMENT_COMPLETE: 'documentComplete',
  ELEMENT_IS_NOT_ANIMATING: 'elementIsNotAnimating',
  ELEMENT_IS_VISIBLE: 'elementIsVisible',
  ELEMENT_IS_NOT_DISABLED: 'elementIsNotDisabled',
  ELEMENT_HAS_ATTRIBUTE: 'elementHasAttribute',
  ELEMENT_HAS_FOCUS: 'elementHasFocus',
  ELEMENT_IS_NOT_COVERED: 'elementIsNotCovered',
  NETWORK_IDLE: 'networkIdle',
  PAGE_NAVIGATION_AFTER_EXECUTION: 'pageNavigationAfterExecution',
};

export const CUSTOM_WAITING_CONDITION = {
  ELEMENT_EXISTS: {
    label: i18n.t('waitingConditions.elementExists.label', 'Element is presented in document'),
    type: 'elementExists',
  },
};

export const INITIAL_CONDITIONS_LIST = [
  WAITING_CONDITION_TYPE.NETWORK_IDLE,
  WAITING_CONDITION_TYPE.DOCUMENT_COMPLETE,
];

export const END_CONDITIONS_LIST = [WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION];

export const CONDITION_PARAMS = {
  [WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED]: {
    label: i18n.t(
      'waitingConditions.elementIsNotCovered.label',
      'Element is not covered by the other one',
    ),
  },
  [WAITING_CONDITION_TYPE.DOCUMENT_COMPLETE]: {
    label: i18n.t('waitingConditions.documentComplete.label', 'Document readyState is complete'),
  },
  [WAITING_CONDITION_TYPE.ELEMENT_IS_VISIBLE]: {
    label: i18n.t('waitingConditions.elementIsVisible.label', 'Element is visible'),
  },
  [WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION]: {
    label: i18n.t(
      'waitingConditions.pageNavigationAfterExecution.label',
      'Page will navigate after step execution',
    ),
  },
  [WAITING_CONDITION_TYPE.ELEMENT_HAS_ATTRIBUTE]: {
    label: i18n.t(
      'waitingConditions.elementHasAttribute.label',
      'Element must have expected attribute',
    ),
  },
  [WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_DISABLED]: {
    label: i18n.t(
      'waitingConditions.elementIsNotDisabled.label',
      'Element must be active (without disabled attribute)',
    ),
  },
  [WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_ANIMATING]: {
    label: i18n.t('waitingConditions.elementIsNotAnimating.label', 'Element is not animating'),
  },
  [WAITING_CONDITION_TYPE.ELEMENT_HAS_FOCUS]: {
    label: i18n.t('waitingConditions.elementHasFocus.label', 'Element has focus'),
  },
  [WAITING_CONDITION_TYPE.NETWORK_IDLE]: {
    label: i18n.t('waitingConditions.networkIdle.label', 'Page network requests are finished'),
  },
};

export const NETWORK_IDLE_VERIFICATION_TIME_SECONDS = 1;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const SELECT_TYPE = {
  TEXT: 'text',
  VALUE: 'value',
  INDEX: 'index',
};
