import { all, call, delay, put, race, select, takeEvery, takeLatest } from 'redux-saga/effects';

import captureScreenshot from '~/background/utils/captureScreenshot';
import { takeFromFrame } from '~/modules//runner/runner.helpers';
import { BackgroundTypes } from '~/modules/background/background.redux';
import { ContentActions, ContentTypes } from '~/modules/content/content.redux';
import { ExtensionActions, ExtensionTypes } from '~/modules/extension/extension.redux';
import {
  selectIsSelenium,
  selectTab,
  selectTrackerFrameById,
  selectWindow,
} from '~/modules/extension/extension.selectors';
import { selectCurrentProjectSettings } from '~/modules/project/project.selectors';
import { RecorderActions } from '~/modules/recorder/recorder.redux';
import { selectIsRecording, selectStepScreenshot } from '~/modules/recorder/recorder.selectors';
import { selectIsRunningTestRun } from '~/modules/runner/runner.selectors';
import { selectUserId, selectUserSettings } from '~/modules/user/user.selectors';
import browser from '~/services/browser';
import { isExcludedUrl } from '~/services/browser/browser.helpers';
import Logger from '~/services/logger';

const logger = Logger.get('Background Sagas');

const DOM_CONTENT_LOADED_TIMEOUT = 1000;

export function* captureTabScreenshotRequested({ _sender }) {
  logger.debug('[captureTabScreenshotRequested]', 'Started');

  if (isExcludedUrl(_sender.url)) {
    logger.debug('[captureTabScreenshotRequested]', 'Stopped');
    return;
  }
  yield call(captureScreenshot.captureTab, _sender.tab.id);
  logger.debug('[captureTabScreenshotRequested]', 'Finished');
}

export function* captureElementScreenshotRequested({ tabId, event }) {
  logger.debug('[captureElementScreenshotRequested]', 'Started');

  const cachedImage = yield select(selectStepScreenshot(event.frontId));
  let image;

  if (!cachedImage) {
    image = yield call(captureScreenshot.captureElement, tabId, event);

    if (!image) {
      logger.debug('[captureElementScreenshotRequested]', 'Not captured');
    }
  }

  const tabObj = yield select(selectTab(tabId));
  yield put(
    RecorderActions.updateStepScreenshotRequested(
      tabObj.testId,
      event.frontId,
      cachedImage || image,
    ),
  );
  logger.debug('[captureElementScreenshotRequested]', 'Finished');
}

export function* clearScreenshotsHistoryRequested({ tabId }) {
  yield call(captureScreenshot.clearScreenshotsHistory, tabId);
}

export function* contentInitialized({ frameObj, _sender }) {
  const {
    frameId,
    tab: { id: tabId },
  } = _sender;
  const { location: frameLocation, src } = frameObj;
  yield put(ExtensionActions.addFrameSucceeded(tabId, frameId, frameLocation, src));
}

export function* domContentLoaded({ tabId, frameId }) {
  const isTrackerFrame = yield select(selectTrackerFrameById(tabId, frameId));
  if (!isTrackerFrame) {
    const { trackerInitialized, timeout } = yield race({
      frameInitialized: takeFromFrame(tabId, frameId, ExtensionTypes.ADD_FRAME_SUCCEEDED),
      trackerInitialized: takeFromFrame(tabId, frameId, ExtensionTypes.ADD_TRACKER_FRAME_SUCCEEDED),
      timeout: delay(DOM_CONTENT_LOADED_TIMEOUT),
    });

    if (trackerInitialized) {
      logger.debug('Event DOM_CONTENT_LOADED was ignored for tracker frame with id', frameId);
      return;
    }

    if (timeout) {
      return;
    }
    yield put(ContentActions.domContentLoaded(tabId, frameId));
  }
}

export function* contentGetSettingsRequested({ viewport, _sender }) {
  const {
    frameId,
    tab: { id: tabId, windowId },
  } = _sender;

  const windowObj = yield select(selectWindow(windowId));
  const { testRunId = null } = windowObj;
  const isRecording = yield select(selectIsRecording);
  const isRunning = yield select(selectIsRunningTestRun(testRunId));
  const isSelenium = yield select(selectIsSelenium);
  const projectSettings = yield select(selectCurrentProjectSettings);
  const userSettings = yield select(selectUserSettings);
  const userId = yield select(selectUserId);
  const settings = {
    testRunId,
    userId,
    windowId,
    tabId,
    projectSettings,
    isRecording,
    isRunning,
    isSelenium,
    userSettings,
  };
  if (isRunning && frameId === 0) {
    const { x, y } = browser.devTools.mouse.position;
    yield put(
      ExtensionActions.updateMousePositionSucceeded(
        tabId,
        x || viewport.innerWidth / 2,
        y || viewport.innerHeight / 2,
        true,
      ),
    );
  }
  yield put(ContentActions.getSettingsSucceeded(tabId, frameId, settings));
}

export function* contentResizeViewportRequested({ viewport, _sender }) {
  const {
    frameId,
    tab: { windowId },
  } = _sender;
  if (frameId !== 0) {
    return;
  }
  const windowObj = yield select(selectWindow(windowId));
  const { testRunId = null } = windowObj;
  const isRunning = yield select(selectIsRunningTestRun(testRunId));
  if (!isRunning) {
    return;
  }

  yield put(ExtensionActions.updateWindowViewportSucceeded(windowId, viewport));
  yield put(ContentActions.resizeViewportSucceeded(windowId));
}

export default function* backgroundSagas() {
  yield all([
    yield takeEvery(
      BackgroundTypes.CAPTURE_ELEMENT_SCREENSHOT_REQUESTED,
      captureElementScreenshotRequested,
    ),
    yield takeLatest(
      BackgroundTypes.CAPTURE_TAB_SCREENSHOT_REQUESTED,
      captureTabScreenshotRequested,
    ),
    yield takeLatest(
      BackgroundTypes.CLEAR_SCREENSHOTS_HISTORY_REQUESTED,
      clearScreenshotsHistoryRequested,
    ),
    yield takeLatest(BackgroundTypes.DOM_CONTENT_LOADED, domContentLoaded),
    yield takeEvery(ContentTypes.GET_SETTINGS_REQUESTED, contentGetSettingsRequested),
    yield takeEvery(ContentTypes.INITIALIZED, contentInitialized),
    yield takeLatest(ContentTypes.RESIZE_VIEWPORT_REQUESTED, contentResizeViewportRequested),
  ]);
}
