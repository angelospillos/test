import { omit } from 'ramda';
import { call, cancel, fork, put, race, select, take } from 'redux-saga/effects';

import { TAB_STATUS } from '~/constants/browser';
import { WAITING_CONDITION_TYPE } from '~/constants/step';
import { EVENT_TYPE, MAIN_FRAME_DATA } from '~/constants/test';
import { VARIABLE_TYPE } from '~/constants/variables';
import { ContentActions, ContentTypes } from '~/modules/content/content.redux';
import { ExtensionActions, ExtensionTypes } from '~/modules/extension/extension.redux';
import { selectTab, selectTabByIndex } from '~/modules/extension/extension.selectors';
import * as exceptions from '~/modules/runner/runner.exceptions';
import {
  getElementRect,
  isElementNotRequired,
  isElementRequired,
  takeFromFrame,
  updateStepRunScreenshot,
  updateStepScreenshot,
  waitForFrame,
  getElementWithScreenshots,
  retryExecution,
} from '~/modules/runner/runner.helpers';
import { RunnerActions, RunnerTypes } from '~/modules/runner/runner.redux';
import { selectCurrentTabIdForTestRunId, selectTestRun } from '~/modules/runner/runner.selectors';
import browser from '~/services/browser';
import { isExcludedUrl, isDownloadedFileUrl } from '~/services/browser/browser.helpers';
import { MOUSE_BUTTON_TYPE } from '~/services/browser/devTools/mouseInput';
import webRequests from '~/services/browser/webRequests';
import Logger from '~/services/logger';
import variablesService from '~/services/variables';
import {
  CHROME_ERROR,
  hasExpectedChromeErrorOccurred,
  PAGE_LOADING_ERROR_CODE,
} from '~/utils/errors';
import { KEYS, KEY_TO_SEQUENCE_MAP } from '~/utils/keyboardLayout';
import { isValidUrl } from '~/utils/misc';

import { BackgroundTypes } from '../background/background.redux';

// eslint-disable-next-line no-unused-vars
const logger = Logger.get('Runner Executors');

export function* goto({ step, testRunId, tabId }) {
  const url = step.computedUrl || step.url;
  if (!isValidUrl(url)) {
    throw new exceptions.InvalidUrl({ message: url });
  }

  yield put(
    RunnerActions.setPotentialTimeoutReasonRequested(
      testRunId,
      new exceptions.PageLoadingError(PAGE_LOADING_ERROR_CODE.ERR_CONNECTION_TIMED_OUT),
    ),
  );
  let tabObj = yield select(selectTab(tabId));
  if (tabObj.status === TAB_STATUS.LOADING && !isExcludedUrl(tabObj.url)) {
    /*
      onBeforeNavigate treats file requests (e.g invoked by "download" button click) as regular navigation request.
      https://bugs.chromium.org/p/chromium/issues/detail?id=465710
    */
    if (!(yield call(isDownloadedFileUrl, tabObj.url))) {
      logger.debug('[goto] Waiting for PAGE_NAVIGATION_COMPLETED');
      yield takeFromFrame(tabId, 0, BackgroundTypes.PAGE_NAVIGATION_COMPLETED);
      tabObj = yield select(selectTab(tabId));
      logger.debug('[goto] PAGE_NAVIGATION_COMPLETED received');
    }
  }

  if (tabObj.status === TAB_STATUS.COMPLETED && !isExcludedUrl(tabObj.url)) {
    logger.debug('[goto] Tab loading completed. Taking a screenshot.');
    yield call(updateStepRunScreenshot, { testRunId, tabId, step });
    logger.debug('[goto] Screenshot is ready');
  }

  logger.debug('[goto] Calling chrome api');
  yield call(browser.tabs.goto, { testRunId, tabId, step, windowId: tabObj.windowId });
  logger.debug('[goto] Url opened');

  const failedRequest = yield call(
    webRequests.getFailedRequest,
    tabId,
    step.url,
    `chrome-extension://${chrome.runtime.id}`,
  );
  if (failedRequest) {
    logger.debug('[goto] Request failed', failedRequest);
    throw new exceptions.PageLoadingError(failedRequest.error, { forceFailed: true });
  }
  logger.debug('[goto] finished');
  yield put(RunnerActions.setPotentialTimeoutReasonRequested(testRunId, null));
}

export function* startListeningEventExecuted(tabId, frameId, requiredParams) {
  const { failure } = yield race({
    success: takeFromFrame(tabId, frameId, ContentTypes.LISTEN_EVENT_SUCCEEDED, requiredParams),
    failure: takeFromFrame(
      tabId,
      frameId,
      ContentTypes.LISTEN_EVENT_FAILED,
      omit(['eventName'], requiredParams),
    ),
  });
  yield put(ContentActions.listenEventExecuted(failure || {}));
}

export function* waitForEvent({
  eventRunner,
  eventName,
  eventRunnerParams,
  testRunId,
  step,
  tabId,
  frameId,
}) {
  const requiredParams = { stepId: step.id, eventName: step.type };
  yield put(
    ContentActions.listenEventRequested(
      testRunId,
      tabId,
      frameId,
      step,
      eventName,
      eventRunnerParams,
    ),
  );

  yield takeFromFrame(tabId, frameId, ContentTypes.LISTEN_EVENT_INITIALIZED, requiredParams);
  const eventResultTask = yield fork(startListeningEventExecuted, tabId, frameId, requiredParams);
  const eventRunnerTask = yield fork(eventRunner, tabId, ...eventRunnerParams);
  const { result } = yield take(ContentTypes.LISTEN_EVENT_EXECUTED);

  yield cancel(eventResultTask);
  yield cancel(eventRunnerTask);

  if (result.error) {
    throw result.error;
  }
}

export function* scroll({ testRunId, step, tabId }) {
  let frameId;
  if (isElementNotRequired(step)) {
    ({ frameId } = yield call(waitForFrame, { testRunId, tabId, stepId: step.id }));
  } else {
    ({ frameId } = yield call(getElementRect, { testRunId, tabId, step }));
  }

  yield call(updateStepRunScreenshot, { testRunId, tabId, step });
  yield put(ContentActions.scrollRequested(testRunId, tabId, frameId, step));
  const { failure } = yield race({
    success: takeFromFrame(tabId, frameId, ContentTypes.SCROLL_SUCCEEDED, { stepId: step.id }),
    failure: takeFromFrame(tabId, frameId, ContentTypes.SCROLL_FAILED, { stepId: step.id }),
  });

  if (failure) {
    throw failure.error;
  }
}

export function* hover({ testRunId, step, tabId }) {
  return yield call(retryExecution, testRunId, step.id, function* retryHover() {
    const { x, y, frameId } = yield call(getElementWithScreenshots, {
      testRunId,
      step,
      tabId,
    });

    yield call(waitForEvent, {
      eventRunner: browser.devTools.mouse.move,
      eventName: EVENT_TYPE.MOUSEMOVE,
      eventRunnerParams: [x, y],
      testRunId,
      step,
      tabId,
      frameId,
    });
    yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));
  });
}

function withRetry(runner) {
  return function* runnerWithRetry(data) {
    return yield call(retryExecution, data.testRunId, data.step.id, runner, data);
  };
}

export function* handleMouseMove({ testRunId, step, tabId }) {
  const { x, y, rect, relatedRects, frameId } = yield call(getElementWithScreenshots, {
    testRunId,
    tabId,
    step,
  });

  yield call(waitForEvent, {
    eventRunner: browser.devTools.mouse.move,
    eventName: EVENT_TYPE.MOUSEMOVE,
    eventRunnerParams: [x, y],
    testRunId,
    step,
    tabId,
    frameId,
  });
  yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));

  return { x, y, rect, relatedRects, frameId };
}

export const mousemove = withRetry(handleMouseMove);

export function* handleClick({ testRunId, step, tabId }) {
  const { x, y, frameId, rect } = yield call(mousemove, {
    testRunId,
    step,
    tabId,
  });

  yield call(waitForEvent, {
    eventRunner: browser.devTools.mouse.click,
    eventName: EVENT_TYPE.CLICK,
    eventRunnerParams: [x, y],
    testRunId,
    step,
    tabId,
    frameId,
  });
  yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));
  return { rect, x, y, frameId };
}

export const click = withRetry(handleClick);

export function* handleDblClick({ testRunId, step, tabId }) {
  const { x, y, frameId, rect } = yield call(mousemove, {
    testRunId,
    step,
    tabId,
  });
  yield call(waitForEvent, {
    eventRunner: browser.devTools.mouse.dblClick,
    eventName: EVENT_TYPE.DOUBLE_CLICK,
    eventRunnerParams: [x, y],
    testRunId,
    step,
    tabId,
    frameId,
  });
  yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));
  return { rect, x, y, frameId };
}

export const dblClick = withRetry(handleDblClick);

export function* handleRightClick({ testRunId, step, tabId }) {
  const { x, y, frameId, rect } = yield call(mousemove, {
    testRunId,
    step,
    tabId,
  });
  yield call(waitForEvent, {
    eventRunner: browser.devTools.mouse.click,
    eventName: EVENT_TYPE.RIGHT_CLICK,
    eventRunnerParams: [x, y, MOUSE_BUTTON_TYPE.RIGHT],
    testRunId,
    step,
    tabId,
    frameId,
  });
  yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));
  return { rect, x, y, frameId };
}

export const rightClick = withRetry(handleRightClick);

export function* handleMouseDown({ testRunId, step, tabId }) {
  const { x, y, frameId } = yield call(handleMouseMove, {
    testRunId,
    step,
    tabId,
  });

  yield call(waitForEvent, {
    eventRunner: browser.devTools.mouse.press,
    eventName: EVENT_TYPE.MOUSEDOWN,
    eventRunnerParams: [x, y],
    testRunId,
    step,
    tabId,
    frameId,
  });

  yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));
  return { x, y, frameId };
}

export const mousedown = withRetry(handleMouseDown);

export function* handleMouseUp({ testRunId, step, tabId }) {
  const { x, y, frameId } = yield call(handleMouseMove, {
    testRunId,
    step,
    tabId,
  });

  yield call(waitForEvent, {
    eventRunner: browser.devTools.mouse.release,
    eventName: EVENT_TYPE.MOUSEUP,
    eventRunnerParams: [x, y],
    testRunId,
    step,
    tabId,
    frameId,
  });

  yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));
  return { x, y, frameId };
}

export const mouseup = withRetry(handleMouseUp);

export function* change({ testRunId, step, tabId }) {
  const { frameId, rect, isFocused } = yield call(getElementRect, {
    testRunId,
    tabId,
    step,
  });

  yield call(updateStepRunScreenshot, { testRunId, tabId, step });
  yield call(updateStepScreenshot, { testRunId, tabId, step, rect });

  yield put(ContentActions.changeRequested(testRunId, tabId, frameId, step));
  const { failure } = yield race({
    success: takeFromFrame(tabId, frameId, ContentTypes.CHANGE_SUCCEEDED, { stepId: step.id }),
    failure: takeFromFrame(tabId, frameId, ContentTypes.CHANGE_FAILED, { stepId: step.id }),
  });
  // To close extra native component with auto suggestions opened while interaction
  yield call(browser.devTools.mouse.click, tabId, 0, 0);

  if (failure) {
    throw failure.error;
  }

  return { rect, isFocused, frameId };
}

export function* selectOption({ testRunId, step, tabId }) {
  const { frameId, rect, isFocused } = yield call(getElementRect, {
    testRunId,
    tabId,
    step,
  });
  yield call(updateStepRunScreenshot, { testRunId, tabId, step });
  yield call(updateStepScreenshot, { testRunId, tabId, step, rect });

  yield put(ContentActions.selectOptionRequested(testRunId, tabId, frameId, step));

  const { failure } = yield race({
    success: takeFromFrame(tabId, frameId, ContentTypes.SELECT_OPTION_SUCCEEDED, {
      stepId: step.id,
    }),
    failure: takeFromFrame(tabId, frameId, ContentTypes.SELECT_OPTION_FAILED, { stepId: step.id }),
  });

  if (failure) {
    throw failure.error;
  }

  return { rect, isFocused, frameId };
}

export function* uploadFile({ testRunId, step, tabId }) {
  const { frameId, rect } = yield call(getElementRect, { testRunId, tabId, step });
  yield call(updateStepRunScreenshot, { testRunId, tabId, step });
  yield call(updateStepScreenshot, { testRunId, tabId, step, rect });
  yield put(ContentActions.uploadFileRequested(testRunId, tabId, frameId, step));
  const { failure } = yield race({
    success: takeFromFrame(tabId, frameId, ContentTypes.UPLOAD_FILE_SUCCEEDED, { stepId: step.id }),
    failure: takeFromFrame(tabId, frameId, ContentTypes.UPLOAD_FILE_FAILED, { stepId: step.id }),
  });

  if (failure) {
    throw failure.error;
  }
}

export function* handleDragAndDrop(data) {
  const { testRunId, tabId } = data;

  // move to initial point and get initial absolute coords
  const dragStep = {
    ...data.step,
    clientX: data.step.dndDragX,
    clientY: data.step.dndDragY,
  };
  const dragPosition = yield call(handleMouseMove, { testRunId, tabId, step: dragStep });

  // get more details about drop
  const dropStep = {
    ...data.step,
    selectors: data.step.dndDropSelectors,
    interactionPosition: data.step.dndDropInteractionPosition,
    clientX: data.step.dndDropX,
    clientY: data.step.dndDropY,
  };
  const { frameId, interactionPosition: dropPosition } = yield call(getElementRect, {
    testRunId,
    tabId,
    step: dropStep,
  });

  yield call(waitForEvent, {
    eventRunner: browser.devTools.mouse.dragAndDrop,
    eventName: EVENT_TYPE.MOUSEUP,
    eventRunnerParams: [dragPosition.x, dragPosition.y, dropPosition.x, dropPosition.y],
    testRunId,
    step: dropStep,
    tabId,
    frameId,
  });

  yield put(ExtensionActions.updateMousePositionSucceeded(tabId, dropPosition.x, dropPosition.y));
}

export const dragAndDrop = withRetry(handleDragAndDrop);

export function* handleType({ testRunId, step, tabId }) {
  const { frameId, rect } = yield call(getElementRect, {
    testRunId,
    tabId,
    step,
  });

  yield call(updateStepRunScreenshot, { testRunId, tabId, step });
  yield call(updateStepScreenshot, { testRunId, tabId, step, rect });

  yield call(waitForEvent, {
    eventRunner: browser.devTools.keyboard.type,
    eventRunnerParams: [step.computedValue ?? step.value],
    eventName: EVENT_TYPE.KEYDOWN,
    testRunId,
    step,
    tabId,
    frameId,
  });
}

export const type = withRetry(handleType);

export function* clear({ testRunId, step, tabId }) {
  const stepWithExtraConditions = {
    ...step,
    waitingConditions: step.waitingConditions.filter((condition) =>
      [WAITING_CONDITION_TYPE.DOCUMENT_COMPLETE, WAITING_CONDITION_TYPE.NETWORK_IDLE].includes(
        condition.type,
      ),
    ),
  };

  const { frameId, rect } = yield call(click, {
    testRunId,
    step: stepWithExtraConditions,
    tabId,
  });

  yield call(updateStepRunScreenshot, { testRunId, tabId, step });
  yield call(updateStepScreenshot, { testRunId, tabId, step, rect });
  yield put(ContentActions.focusRequested(testRunId, tabId, frameId, step, true));
  const { failure } = yield race({
    success: takeFromFrame(tabId, frameId, ContentTypes.FOCUS_SUCCEEDED, { stepId: step.id }),
    failure: takeFromFrame(tabId, frameId, ContentTypes.FOCUS_FAILED, { stepId: step.id }),
  });

  if (failure) {
    throw failure.error;
  }

  const stepWithProperValue = { ...step, value: KEY_TO_SEQUENCE_MAP[KEYS.Backspace.key] };
  yield call(type, {
    testRunId,
    step: stepWithProperValue,
    tabId,
    ignoreInitialClick: true,
  });
}

export function* assert({ testRunId, step, tabId, variables }) {
  let frameId;
  let rect;

  const requiresElement = isElementRequired(step);
  if (requiresElement) {
    ({ frameId, rect } = yield call(getElementRect, {
      testRunId,
      tabId,
      step,
    }));
    yield call(updateStepRunScreenshot, { testRunId, tabId, step });
    yield call(updateStepScreenshot, { testRunId, tabId, step, rect });
  } else {
    ({ frameId } = yield call(waitForFrame, { testRunId, tabId, stepId: step.id }));
    yield call(updateStepRunScreenshot, { testRunId, tabId, step });
  }

  yield put(ContentActions.assertRequested(testRunId, tabId, frameId, step, variables));
  const { failure, removeFrameSucceeded, success } = yield race({
    success: takeFromFrame(tabId, frameId, ContentTypes.ASSERT_SUCCEEDED, { stepId: step.id }),
    failure: takeFromFrame(tabId, frameId, ContentTypes.ASSERT_FAILED, { stepId: step.id }),
    removeFrameSucceeded: takeFromFrame(tabId, frameId, ExtensionTypes.REMOVE_FRAME_SUCCEEDED),
  });

  if (removeFrameSucceeded) {
    yield call(assert, { testRunId, step, tabId, variables });
  }

  if (failure) {
    throw failure.error;
  }

  if (success) {
    yield put(RunnerActions.setPotentialTimeoutReasonRequested(testRunId, null));
  }
}

export function* execute({ testRunId, step, tabId, variables }) {
  const { frameId } = yield call(waitForFrame, {
    testRunId,
    tabId,
    stepId: step.id,
  });
  yield put(ContentActions.getWindowRequested(testRunId, tabId, frameId, step));
  yield call(takeFromFrame, tabId, frameId, ContentTypes.GET_WINDOW_SUCCEEDED, { stepId: step.id });
  yield call(updateStepRunScreenshot, { testRunId, tabId, step });

  try {
    return yield call(browser.devTools.runtime.executeFunction, tabId, step.code, variables);
  } catch (error) {
    throw new exceptions.CodeExecutionError({
      error: error.message,
      forceFailed: true,
    });
  }
}

export function* newTab({ testRunId, step }) {
  const testRun = yield select(selectTestRun(testRunId));
  const currentTab = yield select(selectTab(testRun.tabContext.currentTabId));
  const newTabObj = yield call(browser.tabs.create, currentTab.windowId, step);
  const viewport = {
    innerWidth: newTabObj.width,
    innerHeight: newTabObj.height,
  };

  yield put(
    ExtensionActions.addTabSucceeded(
      newTabObj.id,
      newTabObj.windowId,
      testRun.projectId,
      testRun.testId,
      viewport,
      testRunId,
    ),
  );

  yield put(
    RunnerActions.updateCurrentTabContextSucceeded(
      testRunId,
      newTabObj.id,
      MAIN_FRAME_DATA.frameId,
    ),
  );

  logger.debug('[newTab] Waiting until website loading completed');
  yield takeFromFrame(
    newTabObj.id,
    MAIN_FRAME_DATA.frameId,
    BackgroundTypes.PAGE_NAVIGATION_COMPLETED,
  );
  logger.debug('[newTab] Website loaded.');
}

export function* startListeningPromptResolverExecuted(tabId, stepId) {
  logger.debug('[answerPrompt] listening for closed prompt...');

  yield race({
    success: takeFromFrame(tabId, MAIN_FRAME_DATA.frameId, RunnerTypes.CLOSE_PROMPT_SUCCEEDED, {
      stepId,
    }),
  });
  yield put(ContentActions.closePromptExecuted());

  logger.debug('[answerPrompt] prompt closed');
}

export function* resolvePrompt(tabId, step) {
  logger.debug('[answerPrompt] closing prompt...');
  const runner =
    !step.value || step.value === 'false'
      ? browser.devTools.page.cancelDialog
      : browser.devTools.page.confirmDialog;

  yield call(runner, tabId, step.value);

  if (hasExpectedChromeErrorOccurred([CHROME_ERROR.NO_DIALOG_IS_SHOWING])) {
    logger.debug('[answerPrompt] no dialog is showing in tab', tabId);
    throw new exceptions.PromptDoesNotExist({ forceFailed: true });
  }
}

export function* handleAnswerPrompt({ step, tabId }) {
  logger.debug('[answerPrompt] started in tab:', tabId);

  const resultTask = yield fork(startListeningPromptResolverExecuted, tabId, step.id);
  const runnerTask = yield fork(resolvePrompt, tabId, step);
  yield take(ContentTypes.CLOSE_PROMPT_EXECUTED);

  yield cancel(resultTask);
  yield cancel(runnerTask);

  logger.debug('[answerPrompt] finished');
}

export function* answerPrompt(data) {
  yield call(updateStepRunScreenshot, data);
  return yield call(retryExecution, data.testRunId, data.step.id, handleAnswerPrompt, data);
}

export function* handleSwitchContext({ testRunId, step }) {
  const tab = yield select(selectTabByIndex(testRunId, step.tabNo));

  if (!tab) {
    throw new exceptions.WindowOrTabDoesNotExist();
  }

  yield call(browser.tabs.update, tab.id, { active: true });
  yield put(
    RunnerActions.updateCurrentTabContextSucceeded(testRunId, tab.id, MAIN_FRAME_DATA.frameId),
  );

  const stepLocation = step.computedFrameLocation || step.frameLocation;

  if (stepLocation !== MAIN_FRAME_DATA.location) {
    if (!stepLocation || stepLocation.match(/^\d+:/)) {
      throw new exceptions.InvalidDataFormat('frame path');
    }

    const pattern = /(?=.*):(?=\/)/;
    // We can't use split(':') because of the following case:
    // frameLocation = '//iframe[@title="test: 123"]/test:/div/div'

    const framePath = stepLocation.split(pattern);
    for (let index = 0; index < framePath.length; index += 1) {
      const frameSelector = framePath[index];
      const overridenStep = {
        ...step,
        frameLocation: frameSelector,
        selectors: [
          {
            isActive: true,
            isCustom: true,
            selector: frameSelector,
            computedSelector: frameSelector,
          },
        ],
      };
      const { frameId: currentFrameId } = yield call(getElementRect, {
        testRunId,
        tabId: tab.id,
        step: overridenStep,
      });

      logger.debug(`Frame "${frameSelector}" exists. Waiting for required frame id...`);
      yield put(
        RunnerActions.setPotentialTimeoutReasonRequested(
          testRunId,
          new exceptions.FrameLoadsTooLong(),
        ),
      );
      while (true) {
        yield put(
          ContentActions.getFrameIdRequested(testRunId, tab.id, overridenStep, currentFrameId),
        );
        const result = yield race({
          succeeded: takeFromFrame(tab.id, currentFrameId, ContentTypes.GET_FRAME_ID_SUCCEEDED, {
            stepId: overridenStep.id,
          }),
          failed: takeFromFrame(tab.id, currentFrameId, ContentTypes.GET_FRAME_ID_FAILED, {
            stepId: overridenStep.id,
          }),
          interrupted: take(ExtensionTypes.ADD_FRAME_SUCCEEDED),
          stopped: take(RunnerTypes.STOP_REQUESTED),
        });

        if (result.succeeded) {
          logger.debug('New frame id is: ', result.succeeded.frame);
          yield put(RunnerActions.setPotentialTimeoutReasonRequested(testRunId, null));
          yield put(
            RunnerActions.updateCurrentTabContextSucceeded(
              testRunId,
              tab.id,
              result.succeeded.frame,
            ),
          );
          break;
        }

        if (result.failed) {
          yield put(
            RunnerActions.setPotentialTimeoutReasonRequested(testRunId, result.failed.error),
          );
        }

        if (result.stopped) {
          break;
        }
      }
    }
  }
}

export const switchContext = withRetry(handleSwitchContext);

export function* closeTab({ testRunId }) {
  const currentTabId = yield select(selectCurrentTabIdForTestRunId(testRunId));
  const currentTab = yield select(selectTab(currentTabId));
  const switchToTab = yield select(selectTabByIndex(testRunId, currentTab.no - 1));
  yield call(browser.tabs.remove, currentTabId);
  yield put(
    RunnerActions.updateCurrentTabContextSucceeded(
      testRunId,
      switchToTab.id,
      MAIN_FRAME_DATA.frameId,
    ),
  );
}

export function* handleSetLocalVariable({ testRunId, step, tabId, variables }) {
  const variable = {
    type: VARIABLE_TYPE.VALUE,
    value: step.computedValue || step.value,
  };

  switch (step.localVariableSource) {
    case VARIABLE_TYPE.EVALUATE: {
      const codeResult = yield call(execute, { testRunId, step, tabId, variables });
      variable.value = `${codeResult}`;
      break;
    }
    case VARIABLE_TYPE.ELEMENT: {
      const { frameId } = yield call(getElementWithScreenshots, {
        testRunId,
        tabId,
        step,
      });

      yield put(
        ContentActions.getElementValueRequested(testRunId, tabId, frameId, step, variables),
      );

      const { failure, removeFrameSucceeded, success } = yield race({
        success: takeFromFrame(tabId, frameId, ContentTypes.GET_ELEMENT_VALUE_SUCCEEDED, {
          stepId: step.id,
        }),
        failure: takeFromFrame(tabId, frameId, ContentTypes.GET_ELEMENT_VALUE_FAILED, {
          stepId: step.id,
        }),
        removeFrameSucceeded: takeFromFrame(tabId, frameId, ExtensionTypes.REMOVE_FRAME_SUCCEEDED),
      });

      if (removeFrameSucceeded) {
        yield call(handleSetLocalVariable, { testRunId, step, tabId, variables });
        return;
      }

      if (failure) {
        throw failure.error;
      }

      if (success) {
        variable.value = success.value;
        yield put(RunnerActions.setPotentialTimeoutReasonRequested(testRunId, null));
      }
      break;
    }
    default: {
      yield call(waitForFrame, { testRunId, tabId, stepId: step.id });
      break;
    }
  }

  yield call(variablesService.setLocalVariable, step.localVariableName, variable, {
    currentTabId: tabId,
  });
  yield put(
    RunnerActions.updateStepRunResultRequested(testRunId, step.id, {
      computedValue: variable.value,
    }),
  );
  yield call(updateStepRunScreenshot, { testRunId, tabId, step });
}

export const setLocalVariable = withRetry(handleSetLocalVariable);
