import { all, call, retry, takeEvery, takeLatest } from 'redux-saga/effects';

import { EVENT_TYPE } from '~/constants/test';
import recorder from '~/content/recorder';
import runner from '~/content/runner/runner';
import { getWindow } from '~/content/runner/wait';
import { ContentActions, ContentTypes } from '~/modules/content/content.redux';
import { AssertFailedError, ElementDoesNotExist } from '~/modules/runner/runner.exceptions';
import { RunnerActions } from '~/modules/runner/runner.redux';
import domLayer from '~/services/domLayer';
import runtimeMessaging from '~/services/runtimeMessaging';
import { handleStepExecutorException } from '~/utils/errors';

export const RETRY_TIMES = 3;
export const RETRY_DELAY = 1.5 * 1000;

/*
 * IMPORTANT:
 * Those sagas are handled only on content.js side of the chrome extension
 */

export function* getElementRectRequested({ testRunId, tabId, step }) {
  try {
    yield call(runner.elementFinder.getElementRect, { testRunId, tabId, step });
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.getElementRectFailed);
  }
}

export function* getFrameIdRequested({ tabId, step, requiredFrameId }) {
  try {
    if (requiredFrameId === domLayer.frames.frameId) {
      /*
        Frame selectors, which are used to our inner communication between frames (postMessage), can be invalid
        because they are generated on frame mount and can be changed after that.

        E.g initial frame selector is '/HTML[@class=\"nprogress-busy\"]/BODY/IFRAME"'
            but when site is loaded the HTML element class is not defined.
            So our frame selector should change to '/HTML/BODY/IFRAME' as well.

        The issue was noticed by our client (webankieta.pl): DEV-2781
      */
      yield call(domLayer.frames.updateNestedFrameSelector, step.frameLocation);

      const frameId = yield call(domLayer.frames.getNestedFrameId, step.frameLocation);
      yield call(domLayer.elementsRegistry.reset);
      yield call(
        runtimeMessaging.dispatchActionInBackground,
        ContentActions.getFrameIdSucceeded(tabId, step.id, frameId),
      );
    }
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.getFrameIdFailed);
  }
}

export function* changeRequested({ testRunId, tabId, step }) {
  try {
    yield retry(RETRY_TIMES, RETRY_DELAY, runner.change, { testRunId, tabId, step });

    yield call(domLayer.elementsRegistry.reset);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.changeSucceeded(step.id),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.changeFailed);
  }
}

export function* selectOptionRequested({ testRunId, tabId, step }) {
  try {
    yield retry(RETRY_TIMES, RETRY_DELAY, runner.select, { testRunId, tabId, step });

    yield call(domLayer.elementsRegistry.reset);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.selectOptionSucceeded(step.id),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.selectOptionFailed);
  }
}

export function* focusRequested({ testRunId, tabId, step, shouldSelect }) {
  try {
    yield retry(RETRY_TIMES, RETRY_DELAY, runner.focus, { testRunId, step, tabId, shouldSelect });

    yield call(domLayer.elementsRegistry.reset);
    yield call(runtimeMessaging.dispatchActionInBackground, ContentActions.focusSucceeded(step.id));
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.focusFailed);
  }
}

export function* listenEventRequested({ testRunId, tabId, step, eventName, eventParams }) {
  const isMouseEvent = ![EVENT_TYPE.KEYDOWN, EVENT_TYPE.KEYUP].includes(eventName);
  const listenEvent = isMouseEvent ? runner.listenMouseEvent : runner.listenTypeEvent;

  try {
    yield call(listenEvent, {
      testRunId,
      step,
      tabId,
      eventName,
      eventParams,
    });

    yield call(domLayer.elementsRegistry.reset);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.listenEventSucceeded(step.id, step.type),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.listenEventFailed);
  }
}

export function* assertRequested({ testRunId, tabId, step, variables }) {
  try {
    const assertResult = yield retry(RETRY_TIMES, RETRY_DELAY, runner.assert, {
      testRunId,
      tabId,
      step,
      variables,
    });
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      RunnerActions.updateStepRunResultRequested(testRunId, step.id, assertResult),
    );

    if (!assertResult.success) {
      throw new AssertFailedError();
    }

    yield call(domLayer.elementsRegistry.reset);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.assertSucceeded(step.id),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.assertFailed);
  }
}

export function* getElementValueRequested({ testRunId, tabId, step }) {
  try {
    const value = yield retry(
      RETRY_TIMES,
      RETRY_DELAY,
      runner.getElementValue,
      testRunId,
      tabId,
      step,
    );
    yield call(domLayer.elementsRegistry.reset);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.getElementValueSucceeded(step.id, value),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.getElementValueFailed);
  }
}

export function* scrollRequested({ testRunId, step, tabId }) {
  try {
    yield retry(RETRY_TIMES, RETRY_DELAY, runner.scroll, { testRunId, step, tabId });

    yield call(domLayer.elementsRegistry.reset);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.scrollSucceeded(step.id),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.scrollFailed);
  }
}

export function* dragRequested({ testRunId, step, tabId, interactionCoords }) {
  try {
    yield retry(RETRY_TIMES, RETRY_DELAY, runner.drag, {
      testRunId,
      step,
      tabId,
      interactionCoords,
    });

    yield call(domLayer.elementsRegistry.reset);
    yield call(runtimeMessaging.dispatchActionInBackground, ContentActions.dragSucceeded(step.id));
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.dragFailed);
  }
}

export function* dropRequested({ testRunId, step, tabId, interactionCoords }) {
  try {
    yield retry(RETRY_TIMES, RETRY_DELAY, runner.drop, {
      testRunId,
      step,
      tabId,
      interactionCoords,
    });

    yield call(domLayer.elementsRegistry.reset);
    yield call(runtimeMessaging.dispatchActionInBackground, ContentActions.dropSucceeded(step.id));
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.dropFailed);
  }
}

export function* uploadFileRequested({ testRunId, tabId, step }) {
  try {
    yield retry(RETRY_TIMES, RETRY_DELAY, runner.uploadFile, { testRunId, tabId, step });

    yield call(domLayer.elementsRegistry.reset);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.uploadFileSucceeded(step.id),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id, ContentActions.uploadFileFailed);
  }
}

function* getWindowRequested({ testRunId, tabId, step }) {
  try {
    const result = yield call(getWindow, step);
    yield call(runner.updateStepRunResult, testRunId, tabId, step.id, result);
    yield call(
      runtimeMessaging.dispatchActionInBackground,
      ContentActions.getWindowSucceeded(step.id),
    );
  } catch (error) {
    yield call(handleStepExecutorException, error, step.id);
  }
}

function* sendWebsocketIdToWebapp({ websocketId }) {
  const message = {
    websocketId,
  };
  yield call(domLayer.postMessage, message, '*');
}

function* resetRequested() {
  yield call(domLayer.reset);
}

function* stopRunningRequested() {
  yield call(runner.stop);
  yield call(resetRequested);
}

export function* elementRemoved({ testRunId }) {
  yield call(runner.logPotentialTimeoutReason, testRunId, new ElementDoesNotExist());
  yield call(runtimeMessaging.dispatchActionInBackground, ContentActions.elementRemoved());
}

export function* lockNativeMouseInteractionsRequested() {
  yield call(recorder.eventsCatcherLayer.disableMouseEvents);
}

export function* unlockNativeMouseInteractionsRequested() {
  yield call(recorder.eventsCatcherLayer.enableMouseEvents);
}

export default function* contentSagas() {
  yield all([
    yield takeLatest(ContentTypes.GET_ELEMENT_RECT_REQUESTED, getElementRectRequested),
    yield takeLatest(ContentTypes.GET_WINDOW_REQUESTED, getWindowRequested),
    yield takeLatest(ContentTypes.CHANGE_REQUESTED, changeRequested),
    yield takeLatest(ContentTypes.SELECT_OPTION_REQUESTED, selectOptionRequested),
    yield takeLatest(ContentTypes.FOCUS_REQUESTED, focusRequested),
    yield takeLatest(ContentTypes.ASSERT_REQUESTED, assertRequested),
    yield takeLatest(ContentTypes.SCROLL_REQUESTED, scrollRequested),
    yield takeLatest(ContentTypes.DRAG_REQUESTED, dragRequested),
    yield takeLatest(ContentTypes.DROP_REQUESTED, dropRequested),
    yield takeLatest(ContentTypes.UPLOAD_FILE_REQUESTED, uploadFileRequested),
    yield takeLatest(ContentTypes.GET_ELEMENT_VALUE_REQUESTED, getElementValueRequested),
    yield takeEvery(ContentTypes.ELEMENT_REMOVED, elementRemoved),
    yield takeEvery(ContentTypes.LISTEN_EVENT_REQUESTED, listenEventRequested),
    yield takeEvery(ContentTypes.SEND_WEBSOCKET_ID_TO_WEBAPP, sendWebsocketIdToWebapp),
    yield takeEvery(ContentTypes.STOP_RUNNING_REQUESTED, stopRunningRequested),
    yield takeEvery(ContentTypes.RESET_REQUESTED, resetRequested),
    yield takeEvery(ContentTypes.GET_FRAME_ID_REQUESTED, getFrameIdRequested),
    yield takeEvery(
      ContentTypes.LOCK_NATIVE_MOUSE_INTERACTIONS_REQUESTED,
      lockNativeMouseInteractionsRequested,
    ),
    yield takeEvery(
      ContentTypes.UNLOCK_NATIVE_MOUSE_INTERACTIONS_REQUESTED,
      unlockNativeMouseInteractionsRequested,
    ),
  ]);
}
