import { cond, equals, always, T } from 'ramda';

import { WAITING_CONDITION_TYPE } from '~/constants/step';
import { STEP_TYPE } from '~/constants/test';
import {
  selectTabIsNetworkIdle,
  selectTabPendingRequests,
} from '~/modules/extension/extension.selectors';
import { selectProjectWaitingCondition } from '~/modules/project';
import {
  selectCurrentTabIdForTestRunId,
  selectLastRunningStepTimer,
  selectRunningTestRun,
} from '~/modules/runner/runner.selectors';
import StoreRegistry from '~/modules/storeRegistry';
import domLayer from '~/services/domLayer';
import Logger from '~/services/logger';
import { isElementMoving, getElementVisibleXY } from '~/utils/browser';
import { convertBoolToString } from '~/utils/misc';

import animationsControl from '../animationsControl';

import { ALWAYS_HARD_WAITING_CONDITIONS, STEP_HARD_WAITING_CONDITIONS } from './wait.constants';

const logger = Logger.get('Wait Helpers');

export const isHardCondition = (step, conditionType) => {
  if (ALWAYS_HARD_WAITING_CONDITIONS.includes(conditionType)) {
    return true;
  }

  let hardConditions = STEP_HARD_WAITING_CONDITIONS[step.type] || [];
  if (step.type === STEP_TYPE.ASSERT) {
    hardConditions = hardConditions[step.assertionProperty] || hardConditions.COMMON;
  }
  return hardConditions.includes(conditionType);
};

export const isSoftConditionLimitExceeded = (currentTime) => {
  const state = StoreRegistry.getContentState();
  const timer = selectLastRunningStepTimer(state);
  if (!timer?.conditionsEnd) {
    return true;
  }
  return currentTime > timer.conditionsEnd;
};

export const isDocumentComplete = () =>
  new Promise((resolve, reject) => {
    const state = StoreRegistry.getContentState();
    const timer = selectLastRunningStepTimer(state);

    const successResult = {
      type: WAITING_CONDITION_TYPE.DOCUMENT_COMPLETE,
      isSuccess: true,
      expected: convertBoolToString(true),
      current: convertBoolToString(true),
    };

    const timeMs = timer?.conditionsEnd ? Math.max(timer.conditionsEnd - Date.now(), 0) : 0;
    domLayer
      .isDocumentReady('isDocumentComplete', timeMs)
      .then((isTimeouted) => {
        if (isTimeouted) {
          resolve({ ...successResult, isSuccess: false, isSoftSuccess: true });
        } else {
          resolve(successResult);
        }
      })
      .catch(reject);
  });

export const areRequestsComplete = (condition) => {
  const state = StoreRegistry.getContentState();
  const testRun = selectRunningTestRun(state);
  if (!testRun) {
    return {
      type: WAITING_CONDITION_TYPE.NETWORK_IDLE,
      isSuccess: true,
    };
  }
  const tabId = selectCurrentTabIdForTestRunId(testRun.testRunId)(state);
  const isNetworkIdle = selectTabIsNetworkIdle(tabId)(state);
  const pendingRequests = selectTabPendingRequests(tabId)(state);
  const isNetworkIdleProjectDefaults = selectProjectWaitingCondition(
    WAITING_CONDITION_TYPE.NETWORK_IDLE,
  );

  const result = {
    type: WAITING_CONDITION_TYPE.NETWORK_IDLE,
    isSuccess: isNetworkIdle,
    expected: condition.expected || isNetworkIdleProjectDefaults.expected,
    current: pendingRequests,
  };

  if (!result.isSuccess) {
    logger.verbose(
      `checkCondition: ${result.current} pending requests but expected at most ${result.expected}`,
    );
  }
  return result;
};

export const hasElementAttribute = (condition, element, isWindow) => {
  let current = null;
  const result = {
    type: WAITING_CONDITION_TYPE.ELEMENT_HAS_ATTRIBUTE,
    isSuccess: false,
    expected: condition.expected,
    current: null,
  };

  if (isWindow) {
    result.isSuccess = true;
  } else {
    const [attributeName, attributeValue] = condition.expected.split('=');
    const tmp = attributeValue.split('"');
    const expectedAttributeValue = tmp[1];
    const hasAttribute = !!element && element.hasAttribute(attributeName);
    if (hasAttribute) {
      current = element.getAttribute(attributeName);
      result.isSuccess = expectedAttributeValue === current;
      result.current = `${attributeName}="${current}"`;
    }
    if (!result.isSuccess) {
      logger.verbose('Element does not have expected attribute', element, condition.expected);
    }
  }

  return result;
};

export const isElementVisible = (condition, element, isWindow) => {
  const isVisible = isWindow || domLayer.isVisible(element);

  const result = {
    type: condition.type,
    isSuccess: isVisible,
    expected: convertBoolToString(true),
    current: convertBoolToString(isVisible),
  };

  if (!isVisible) {
    logger.verbose('Element is invisible', element);
  }
  return result;
};

export const isElementNotCovered = async (
  condition,
  element,
  isWindow,
  interactionPosition,
  customInteractionCoords,
) => {
  let position;
  const type = WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED;
  const result = {
    type,
    isSuccess: false,
    expected: convertBoolToString(true),
    current: convertBoolToString(false),
  };

  try {
    position = await getElementVisibleXY(element, interactionPosition, customInteractionCoords);
  } catch (error) {
    logger.verbose(`Cant get element from x,y () position.\n`, error);
    return result;
  }

  if (isWindow) {
    result.isSuccess = true;
  } else {
    result.isSuccess = !(await domLayer.isCovered(
      element,
      interactionPosition,
      customInteractionCoords,
    ));
    if (!result.isSuccess) {
      result.coveringElement = domLayer.getElementOnPosition(position);
      logger.verbose(
        `Element from (${position.x},${position.y}) is different than from xpath (ELEMENT_IS_NOT_COVERED): covering`,
        result.coveringElement,
        'required',
        element,
      );
    }
  }

  result.current = convertBoolToString(result.isSuccess);
  return result;
};

export const hasElementFocus = (condition, element, isWindow) => {
  const isFocused = document.activeElement === element;
  const result = {
    type: WAITING_CONDITION_TYPE.ELEMENT_HAS_FOCUS,
    isSuccess: isWindow ? true : isFocused,
    expected: convertBoolToString(true),
    current: convertBoolToString(isFocused),
  };

  if (!result.isSuccess) {
    logger.verbose(
      'Element is not focused',
      'element',
      element,
      'active element',
      document.activeElement,
    );
  }

  return result;
};

export const isElementNotDisabled = (condition, element, isWindow) => {
  const isDisabled = !!element && domLayer.isDisabled(element);

  const isSuccess = isWindow || isDisabled === false;
  const result = {
    type: condition.type,
    expected: convertBoolToString(true),
    current: convertBoolToString(!isDisabled),
    isSuccess,
  };
  if (isDisabled) {
    logger.verbose(`Element is disabled (${element.disabled})`, element);
  }
  return result;
};

export const isElementNotAnimating = async (condition, element, isWindow) => {
  let isMoving = false;
  let isTransitioning = false;
  let isAnimating = false;

  if (element) {
    isMoving = await isElementMoving(element);
    isTransitioning = Array.from(animationsControl.transitioning.keys()).some(
      (transitioningElement) => transitioningElement.contains(element),
    );
    isAnimating = animationsControl.isElementPartOfAnimatingTree(element);
  }

  const isSuccess = isWindow || (!!element && isMoving === false && isAnimating === false);
  const result = {
    type: condition.type,
    isSuccess,
    expected: convertBoolToString(true),
    current: convertBoolToString(isSuccess),
  };

  if (isMoving || isAnimating || isTransitioning) {
    if (
      !isMoving &&
      !isTransitioning &&
      isAnimating &&
      animationsControl.hasOnlyActiveInfiniteAnimations(element)
    ) {
      result.isSoftSuccess = true;
    }
    logger.verbose(
      'Element is: moving, animating, transitioning',
      isMoving,
      isAnimating,
      isTransitioning,
      'animating',
      animationsControl.animating,
      'transitioning',
      animationsControl.transitioning,
    );
  }
  return result;
};

export const checkCondition = async (step, condition, element, isWindow = false) => {
  if (!condition.type) {
    throw new Error(`Missing condition.type! ${condition.type}`);
  }

  const handleUnexpectedCondition = () => {
    throw new Error(`Unsupported condition type: ${condition.type}`);
  };

  const resolveCondition = cond([
    [equals(WAITING_CONDITION_TYPE.DOCUMENT_COMPLETE), always(isDocumentComplete)],
    [equals(WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_ANIMATING), always(isElementNotAnimating)],
    [equals(WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_DISABLED), always(isElementNotDisabled)],
    [equals(WAITING_CONDITION_TYPE.ELEMENT_IS_VISIBLE), always(isElementVisible)],
    [equals(WAITING_CONDITION_TYPE.ELEMENT_HAS_ATTRIBUTE), always(hasElementAttribute)],
    [equals(WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED), always(isElementNotCovered)],
    [equals(WAITING_CONDITION_TYPE.ELEMENT_HAS_FOCUS), always(hasElementFocus)],
    [equals(WAITING_CONDITION_TYPE.NETWORK_IDLE), always(areRequestsComplete)],
    [T, always(handleUnexpectedCondition)],
  ])(condition.type);

  const customInteractionCoords = { x: step.clientX, y: step.clientY };
  const result = await resolveCondition(
    condition,
    element,
    isWindow,
    step.interactionPosition,
    customInteractionCoords,
  );
  return { isIgnored: false, isSoftSuccess: false, ...result };
};
