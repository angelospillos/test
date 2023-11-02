import { all, call, put, race, select, take, takeLatest } from 'redux-saga/effects';

import { WINDOW_STATUS } from '~/constants/browser';
import {
  selectExtensionSettings,
  selectIsSelenium,
  selectIsWindowUnderControl,
  selectWindowsIdList,
  selectWindowsListForTestRunId,
  selectWindowTestId,
  selectWindowTestRunId,
} from '~/modules/extension/extension.selectors';
import { RecorderActions, RecorderTypes } from '~/modules/recorder/recorder.redux';
import {
  selectIsRecording,
  selectIsRecordingToClipboard,
} from '~/modules/recorder/recorder.selectors';
import { RunnerTypes } from '~/modules/runner/runner.redux';
import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import { selectWebsocketId } from '~/modules/websocket/websocket.selectors';
import browser from '~/services/browser';
import * as webapp from '~/utils/webapp';

import { ExtensionActions, ExtensionTypes } from './extension.redux';

export function* getExtensionSettings() {
  const currentBrowserSettings = yield call(browser.details.get);
  const storedSettings = yield select(selectExtensionSettings);
  const websocketId = yield select(selectWebsocketId);
  const updatedSettings = { ...storedSettings, ...currentBrowserSettings };
  return {
    ...updatedSettings,
    websocketId,
    isConnectedWithServer: !!websocketId,
    version: process.env.VERSION,
  };
}

export function* sendSettingsToWebappRequested() {
  const settings = yield call(getExtensionSettings);
  const isSelenium = yield select(selectIsSelenium);
  yield call(webapp.sendExtensionSettingsToWebapp, { ...settings, isSelenium });
  yield put(ExtensionActions.sendSettingsToWebappSucceeded());
}

export function* updateSettingsRequested() {
  const settings = yield call(getExtensionSettings);
  yield put(WebsocketActions.sendRequested(ExtensionTypes.UPDATE_SETTINGS_REQUESTED, settings));

  const { extensionSettingsId } = yield take([ExtensionTypes.SETTINGS_UPDATED]);
  yield put(ExtensionActions.updateSettingsSucceeded({ ...settings, id: extensionSettingsId }));
  yield put(ExtensionActions.sendSettingsToWebappRequested());
}

export function* addTabSucceeded() {
  yield put(ExtensionActions.updateSettingsRequested());
}

export function* removeWindowRequested({ windowId, closeWindow = true }) {
  const isUnderControl = yield select(selectIsWindowUnderControl(windowId));
  if (isUnderControl) {
    yield put(ExtensionActions.updateWindowStatusSucceeded(windowId, WINDOW_STATUS.CLOSING));
    const testRunId = yield select(selectWindowTestRunId(windowId));
    const testId = yield select(selectWindowTestId(windowId));
    const isRecording = yield select(selectIsRecording);

    if (closeWindow) {
      yield call(browser.windows.remove, parseInt(windowId, 10));
    }
    yield put(ExtensionActions.removeWindowSucceeded(windowId, testRunId));
    const windowsIds = yield select(selectWindowsListForTestRunId(testRunId));
    yield put(
      WebsocketActions.sendRequested(ExtensionTypes.REMOVE_WINDOW_REQUESTED, {
        windowsIds,
        testId,
      }),
    );

    if (isRecording && windowsIds.length === 0) {
      const isClipboard = yield select(selectIsRecordingToClipboard);
      if (isClipboard) {
        yield put(RecorderActions.stopToClipboardRequested(testId));
      } else {
        yield put(RecorderActions.stopRequested());
      }
    }
  }
}

export function* closeSelectedWindowsRequested({
  windowsIds = [],
  updateSettings = true,
  closeWindow = true,
  waitUntilTestStop = false,
}) {
  if (waitUntilTestStop) {
    yield race({
      running: take(RunnerTypes.STOP_REQUESTED),
      recording: take(RecorderTypes.STOP_REQUESTED),
    });
  }
  for (let i = 0; i < windowsIds.length; i += 1) {
    yield call(removeWindowRequested, { windowId: windowsIds[i], closeWindow });
  }
  if (updateSettings) {
    yield put(ExtensionActions.updateSettingsRequested());
  }
  yield put(ExtensionActions.closeSelectedWindowsSucceeded());
}

export function* closeWindowsRequested({
  updateSettings = true,
  waitUntilTestStop = false,
  closeWindow = true,
  windowsIds,
}) {
  const windows = windowsIds || (yield select(selectWindowsIdList));
  yield call(closeSelectedWindowsRequested, {
    windowsIds: windows,
    updateSettings,
    waitUntilTestStop,
    closeWindow,
  });
  yield put(ExtensionActions.closeWindowsSucceeded());
}

export function* openSettingsRequested() {
  const extensionSettingsUrl = 'chrome://extensions/';
  const tab = yield call(browser.tabs.focusTabWithUrl, {
    url: `${extensionSettingsUrl}*`,
    createIfNotExists: true,
    currentWindow: true,
  });
  yield call(browser.tabs.update, tab.id, {
    url: `${extensionSettingsUrl}?id=${chrome.runtime.id}`,
  });
}

export default function* extensionSagas() {
  yield all([
    yield takeLatest(ExtensionTypes.UPDATE_SETTINGS_REQUESTED, updateSettingsRequested),
    yield takeLatest(ExtensionTypes.REMOVE_WINDOW_REQUESTED, removeWindowRequested),
    yield takeLatest(ExtensionTypes.ADD_TAB_SUCCEEDED, addTabSucceeded),
    yield takeLatest(ExtensionTypes.CLOSE_WINDOWS_REQUESTED, closeWindowsRequested),
    yield takeLatest(
      ExtensionTypes.SEND_SETTINGS_TO_WEBAPP_REQUESTED,
      sendSettingsToWebappRequested,
    ),
    yield takeLatest(
      ExtensionTypes.CLOSE_SELECTED_WINDOWS_REQUESTED,
      closeSelectedWindowsRequested,
    ),
    yield takeLatest(ExtensionTypes.OPEN_SETTINGS_REQUESTED, openSettingsRequested),
  ]);
}
