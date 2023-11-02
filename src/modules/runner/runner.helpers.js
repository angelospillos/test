import { either, equals, mergeDeepRight, omit, prop, values } from 'ramda';
import { call, delay, put, race, select, take } from 'redux-saga/effects';

import captureScreenshot from '~/background/utils/captureScreenshot';
import { WAITING_CONDITION_TYPE } from '~/constants/step';
import { STEP_TYPE, PREDICTED_AVERAGE_STEP_EXECUTION_TIME } from '~/constants/test';
import { BackgroundTypes } from '~/modules/background/background.redux';
import { ContentActions, ContentTypes } from '~/modules/content/content.redux';
import { ExtensionTypes } from '~/modules/extension/extension.redux';
import {
  selectFrameById,
  selectFrameByLocation,
  selectTab,
  selectTabPendingRequests,
  selectWindowViewport,
} from '~/modules/extension/extension.selectors';
import * as exceptions from '~/modules/runner/runner.exceptions';
import { RunnerActions, RunnerTypes } from '~/modules/runner/runner.redux';
import {
  selectHasStepFailedWaitingConditions,
  selectHasStepPageNavigationCommitted,
  selectLastRunningStepTimer,
  selectLastStepWaitingCondition,
  selectNetworkConditionExpectedValue,
  selectStepRunningResult,
  selectTestRun,
  selectHasStepConditionsResolvedSoftly,
  selectIsRunningTestRun,
  selectCurrentTabContext,
} from '~/modules/runner/runner.selectors';
import WebRequests from '~/services/browser/webRequests';
import { hasSamePosition } from '~/utils/browser';
import { serializeError } from '~/utils/errors';
import { convertBoolToString } from '~/utils/misc';

import { CoreActions } from '../core';

import { logger, takeScreenshots } from './runner.helpers.ts';

export const RETRY_EXECUTION_DELAY = 1.5 * 1000;

export {
  takeScreenshots,
  updateStepRunScreenshot,
  updateStepScreenshot,
  isElementRequired,
  isElementNotRequired,
} from './runner.helpers.ts';

export const takeFromFrame = (waitForTabId, waitForFrameId, expectedType, extraParams = {}) =>
  take(({ type, tabId, frameId, _sender, ...rest }) => {
    if (type !== expectedType) {
      return false;
    }

    let success;
    if (_sender) {
      success = waitForTabId === _sender.tab.id && waitForFrameId === _sender.frameId;
    } else {
      success = waitForTabId === tabId && waitForFrameId === frameId;
    }

    const extraParamsKeys = Object.keys(extraParams);
    for (let i = 0; i < extraParamsKeys.length; i += 1) {
      const key = extraParamsKeys[i];
      success = success && rest[key] === extraParams[key];
    }
    return success;
  });

const hasWaitingCondition = (step, type) =>
  step.type !== STEP_TYPE.GOTO &&
  step.waitingConditions.some((condition) => condition.isActive && condition.type === type);

export const hasPageNavigationWaitingCondition = (step) =>
  hasWaitingCondition(step, WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION);

export const hasNetworkIdleWaitingCondition = (step) =>
  hasWaitingCondition(step, WAITING_CONDITION_TYPE.NETWORK_IDLE);

export const mergeStepRunResult = (currentStepRunResult, changeInfo) => {
  const newResult = mergeDeepRight(currentStepRunResult, omit(['isSoftSuccess'], changeInfo));

  if (changeInfo.isSoftSuccess) {
    newResult.warning = true;
    newResult.isSuccess = true;

    if (!changeInfo.errorCode) {
      newResult.errorCode = exceptions.FAILED_WAITING_CONDITIONS;
    }
  }

  newResult.failed = [
    newResult.forceFailed,
    !newResult.finished,
    newResult.timeout,
    !values(newResult.conditionsState).every(
      either(prop('isSuccess'), prop('isSoftSuccess'), prop('isIgnored')),
    ),
  ].some(equals(true));

  return newResult;
};

export function* waitForTimeout(testRunId, stepId, timeout, sleep) {
  yield delay((timeout + sleep) * 1000);

  const hasConditionsResolvedSoftly = yield select(
    selectHasStepConditionsResolvedSoftly(testRunId, stepId),
  );

  if (hasConditionsResolvedSoftly) {
    yield delay(PREDICTED_AVERAGE_STEP_EXECUTION_TIME);
  }
  return true;
}

export function* waitForFrame({ testRunId, tabId }) {
  const tabContext = yield select(selectCurrentTabContext(testRunId));

  let frame = yield select(selectFrameById(tabId, tabContext.currentFrameId));
  while (!frame) {
    frame = yield take(
      // eslint-disable-next-line no-loop-func
      (action) =>
        action.type === ExtensionTypes.ADD_FRAME_SUCCEEDED &&
        action.tabId === tabId &&
        action.frameId === tabContext.currentFrameId,
    );
  }
  return frame;
}

export function* waitForPrompt(testRunId, tabId, stepId) {
  logger.debug('[waitForPromptIfNeeded] started', stepId);

  while (true) {
    const isRunning = yield select(selectIsRunningTestRun(testRunId));

    if (!isRunning) {
      break;
    }
    const result = yield take(RunnerTypes.OPEN_PROMPT_SUCCEEDED);

    if (result) {
      logger.debug('[waitForPromptIfNeeded] success', result);
      return true;
    }
  }
  return logger.debug('[waitForPromptIfNeeded] failed');
}

export function* waitForActiveRequestsIfNeeded({ step, tabId, testRunId }) {
  const networkWaitingCondition = yield select(
    selectLastStepWaitingCondition(WAITING_CONDITION_TYPE.NETWORK_IDLE),
  );

  if (networkWaitingCondition) {
    logger.debug('[waitForActiveRequestsIfNeeded]', step.id);
    const expectedValue = yield select(selectNetworkConditionExpectedValue);
    const timer = yield select(selectLastRunningStepTimer);
    const result = yield race({
      current: call(WebRequests.waitUntilPendingRequestsBelowLimit, tabId, expectedValue),
      conditionsTimeout: delay(Math.max(timer.conditionsEnd - Date.now(), 0)),
    });

    if (result.conditionsTimeout) {
      result.current = yield select(selectTabPendingRequests(tabId));
    }
    logger.debug('[waitForActiveRequestsIfNeeded] success', step.id);

    yield put(
      RunnerActions.updateStepRunResultRequested(testRunId, step.id, {
        conditionsState: {
          [WAITING_CONDITION_TYPE.NETWORK_IDLE]: {
            type: WAITING_CONDITION_TYPE.NETWORK_IDLE,
            isSuccess: !result.conditionsTimeout,
            isSoftSuccess: !!result.conditionsTimeout,
            expected: expectedValue,
            current: result.current,
          },
        },
        isSoftSuccess: !!result.conditionsTimeout,
      }),
    );
  }
}

// eslint-disable-next-line consistent-return
export function* retryExecution(
  testRunId,
  stepId,
  handleEvent,
  data,
  retryDelay = RETRY_EXECUTION_DELAY,
) {
  while (true) {
    try {
      const isRunning = yield select(selectIsRunningTestRun(testRunId));

      if (!isRunning) {
        break;
      }
      return yield call(handleEvent, data);
    } catch (error) {
      const isHandledError = error instanceof exceptions.RunnerError || !!exceptions[error.name];
      if (isHandledError) {
        yield put(RunnerActions.updateStepRunResultRequested(testRunId, stepId, error.params));
        yield put(RunnerActions.setPotentialTimeoutReasonRequested(testRunId, error));
        yield delay(retryDelay);
      } else {
        throw error;
      }
    }
  }
  return {};
}

export function* getElementRect({ testRunId, tabId, step }) {
  logger.debug('[getElementRect] started on background for step', step.type);
  let result = {};
  const hasNetworkRequestsCondition = yield call(hasNetworkIdleWaitingCondition, step);

  while (true) {
    if (hasNetworkRequestsCondition) {
      const expectedValue = yield select(selectNetworkConditionExpectedValue);
      yield call(WebRequests.setRequestsLimit, tabId, expectedValue);
    }
    const { frameId } = yield call(waitForFrame, { testRunId, tabId, stepId: step.id });
    result = { frameId };

    yield put(ContentActions.getElementRectRequested(testRunId, tabId, frameId, step));
    const { succeeded, removeFrameSucceeded, failed } = yield race({
      succeeded: takeFromFrame(tabId, frameId, ContentTypes.GET_ELEMENT_RECT_SUCCEEDED, {
        stepId: step.id,
      }),
      failed: takeFromFrame(tabId, frameId, ContentTypes.GET_ELEMENT_RECT_FAILED, {
        stepId: step.id,
      }),
      removeFrameSucceeded: takeFromFrame(tabId, frameId, ExtensionTypes.REMOVE_FRAME_SUCCEEDED),
    });

    if (failed) {
      throw failed.error;
    } else {
      yield put(RunnerActions.setPotentialTimeoutReasonRequested(testRunId, null));
      if (removeFrameSucceeded) {
        logger.debug('[getElementRect] Frame unloaded');
      }
    }

    if (succeeded || failed) {
      result = { ...succeeded, ...result };

      if (hasNetworkRequestsCondition) {
        yield call(WebRequests.resetRequestsLimit, tabId);
        logger.debug('[getElementRect] Network requests limit reset');
      }
      break;
    }
  }
  logger.debug('[getElementRect] finished on background for step', step.type);
  return result;
}

function* waitUntilNavigationCommited(testRunId, tabId, frameId, stepId) {
  let wasPageNavigationCommittedBefore = false;
  let committed = false;

  while (true) {
    wasPageNavigationCommittedBefore = yield select(
      selectHasStepPageNavigationCommitted(testRunId, stepId),
    );
    logger.debug(
      'waitForPageNavigationCommitted iter',
      stepId,
      wasPageNavigationCommittedBefore,
      committed,
    );
    if (wasPageNavigationCommittedBefore || committed) {
      break;
    }
    ({ committed } = yield race({
      committed: takeFromFrame(tabId, frameId, BackgroundTypes.PAGE_NAVIGATION_COMMITTED),
    }));
  }
  logger.debug('waitForPageNavigationCommitted result', stepId, {
    wasPageNavigationCommittedBefore,
    committed,
  });
}

export function* waitForPageNavigationIfNeeded({ testRunId, tabId, frameId = 0, step }) {
  /*
    Page navigation handling is splitted into two parts:
      - listening for navigation changes: helpers.waitForPageNavigationIfNeeded
      - updating run status on navigation changes: RunnerActions.pageNavigationCommitted

    A reason for this apporach is an issue when the page navigation is committed
    just after interaction (e.g "click") but before the listening process starts.
    It happens very often on SPA's.
  */
  const waitForPageNavigation = yield call(hasPageNavigationWaitingCondition, step);
  if (waitForPageNavigation) {
    logger.debug('executeStep: waitForPageNavigation', step.id);
    const timer = yield select(selectLastRunningStepTimer);

    const result = yield race({
      value: call(waitUntilNavigationCommited, testRunId, tabId, frameId, step.id),
      conditionsTimeout: delay(Math.max(timer.conditionsEnd - Date.now(), 0)),
    });

    if (result.conditionsTimeout) {
      const type = WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION;
      const trueString = convertBoolToString(true);
      yield put(
        RunnerActions.updateStepRunResultRequested(testRunId, step.id, {
          conditionsState: {
            [type]: {
              type,
              isSuccess: false,
              isSoftSuccess: true,
              expected: trueString,
              current: trueString,
            },
          },
          errorCode: exceptions.FAILED_WAITING_CONDITIONS,
          isSoftSuccess: true,
        }),
      );
    }
  }
}

export function* getRunnerErrorParams(testRunId, step) {
  let errorCode = exceptions.TIMEOUT;
  const testRun = yield select(selectTestRun(testRunId));
  const { currentTabId, frameLocation } = testRun.tabContext;
  const tabObj = yield select(selectTab(currentTabId));
  const frame = yield select(selectFrameByLocation(currentTabId, frameLocation));
  const stepResult = yield select(selectStepRunningResult(testRunId, step.id));
  const hasFailedWaitingConditions = yield select(
    selectHasStepFailedWaitingConditions(testRunId, step.id),
  );

  if (!tabObj) {
    errorCode = exceptions.WINDOW_OR_TAB_DOES_NOT_EXIST;
  } else if (testRun.potentialTimeoutReason) {
    return testRun.potentialTimeoutReason.params;
  } else if (frameLocation && !frame) {
    return {
      errorCode: exceptions.FRAME_DOES_NOT_EXIST,
      error: frameLocation,
    };
  } else if (step.selectors?.length && !stepResult.elementExists) {
    errorCode = exceptions.ELEMENT_DOES_NOT_EXIST;
  } else if (hasFailedWaitingConditions) {
    errorCode = exceptions.FAILED_WAITING_CONDITIONS;
  } else if (step.type === STEP_TYPE.SCROLL && !hasSamePosition(stepResult, step)) {
    errorCode = exceptions.SCROLL_FAILED;
  }

  return { errorCode };
}

export function* getElementWithScreenshots({ testRunId, step, tabId }) {
  const {
    rect,
    relatedRects = [],
    frameId,
    interactionPosition,
    selector,
  } = yield call(getElementRect, {
    testRunId,
    tabId,
    step,
  });

  const tabObj = yield select(selectTab(tabId));
  const currentViewport = yield select(selectWindowViewport(tabObj.windowId));

  if (interactionPosition && tabObj) {
    const outOfViewport =
      interactionPosition.x < 0 ||
      interactionPosition.y < 0 ||
      interactionPosition.x > currentViewport.innerWidth ||
      interactionPosition.y > currentViewport.innerHeight;
    if (outOfViewport) {
      throw new exceptions.InteractionPositionOutOfViewportError({
        interactionPositionX: interactionPosition.x,
        interactionPositionY: interactionPosition.y,
        windowInnerWidth: currentViewport.innerWidth,
        windowInnerHeight: currentViewport.innerHeight,
      });
    }
  }

  logger.debug('[getElementWithScreenshots] Taking screenshots started...');
  const { timeout } = yield race({
    finished: call(takeScreenshots, { testRunId, tabId, step, rect }),
    timeout: delay(captureScreenshot.timeoutMs * 2),
  });

  if (timeout) {
    logger.debug('[getElementWithScreenshots] Taking screenshots reached timeout.');
    yield put(
      CoreActions.captureExceptionAsWarning(
        serializeError(new exceptions.TakingScreenshotTimeout()),
      ),
    );
  }
  return { ...interactionPosition, rect, relatedRects, frameId, selector };
}
