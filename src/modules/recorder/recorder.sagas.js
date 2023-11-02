import { omit, pick } from 'ramda';
import {
  all,
  call,
  put,
  select,
  take,
  takeEvery,
  takeLeading,
  actionChannel,
  takeLatest,
} from 'redux-saga/effects';

import { STEP_TYPE } from '~/constants/test';
import { BackgroundActions } from '~/modules/background/background.redux';
import { ContentActions } from '~/modules/content/content.redux';
import {
  selectTabAndWindowNo,
  selectTabIdListForTestId,
  selectTabIdListForTestRunId,
  selectWindowTestRunId,
} from '~/modules/extension/extension.selectors';
import { selectCurrentProject } from '~/modules/project';
import changesBatcher from '~/modules/recorder/recorder.batch';
import { processRecordedEvent, transformChangesList } from '~/modules/recorder/recorder.helpers';
import { RecorderActions, RecorderTypes } from '~/modules/recorder/recorder.redux';
import {
  selectIsRecording,
  selectIsRecordingToClipboard,
  selectProcessingData,
  selectRecordingGroupSequence,
  selectRecordingProfileId,
  selectRecordingProjectId,
  selectRecordingTestId,
  selectRecordingTestIdAndDraftGroupId,
  selectRecordingTestRunId,
} from '~/modules/recorder/recorder.selectors';
import { RunnerTypes } from '~/modules/runner/runner.redux';
import { selectIsRunningTestRun, selectTestRunByTestId } from '~/modules/runner/runner.selectors';
import { UIStateActions } from '~/modules/uistate/uistate.redux';
import { selectWebsocketId } from '~/modules/websocket/websocket.selectors';
import api from '~/services/api';
import browser from '~/services/browser';
import Logger from '~/services/logger';
import variables from '~/services/variables';
import { genFrontId, genRandomId } from '~/utils/misc';

import { CoreActions, CoreTypes } from '../core';

// eslint-disable-next-line no-unused-vars
const logger = Logger.get('Recorder Sagas');

export function* startRequested({
  test,
  project,
  windowId = null,
  testRunId: _testRunId = null,
  userId,
  userSettings,
  url,
  uploadContext,
  variables: initialVariables = {},
}) {
  let testRunIdForExistingWindow;
  if (windowId) {
    testRunIdForExistingWindow = yield select(selectWindowTestRunId(windowId));
  }
  const testRunId = _testRunId || testRunIdForExistingWindow;
  const isCleanRecording = !windowId && !testRunId;
  const cachedLocalVariables = yield call(variables.getLocalVariables);

  yield put(
    CoreActions.setupSessionRequested(
      testRunId,
      userId,
      project,
      test.screenSizeType,
      !isCleanRecording,
    ),
  );
  yield take([CoreTypes.SETUP_SESSION_SUCCEEDED, CoreTypes.SETUP_SESSION_FAILURE]);

  // setting variables
  yield call(variables.setVariables, test.id, initialVariables, true);
  yield call(variables.setLocalVariables, cachedLocalVariables);
  const variablesMap = yield call(variables.getVariables, test.id);
  yield put(RecorderActions.getVariablesListSucceeded(variablesMap));

  // don't open new window when test is in run&record mode (_testRunId !== null)
  // or we want to record to clipboard (windowId !== null)
  if (isCleanRecording) {
    const { tabId } = yield call(browser.windows.open, {
      projectSettings: project.settings,
      userSettings,
      testId: test.id,
      screenSizeType: test.screenSizeType,
      url: url || `${process.env.BLANK_PAGE_URL}`,
    });

    if (url) {
      yield put(
        RecorderActions.addEventRequested({
          timestamp: new Date().getTime(),
          type: STEP_TYPE.GOTO,
          tabId,
          url,
          isTrusted: true,
          frontId: genFrontId(),
        }),
      );
    }
  } else {
    const tabIdList = yield select(selectTabIdListForTestRunId(testRunId));
    const isRunning = yield select(selectIsRunningTestRun(testRunId));
    if (isRunning) {
      yield take(RunnerTypes.STOP_SUCCEEDED);
    }
    for (let n = 0; n < tabIdList.length; n += 1) {
      yield put(ContentActions.startRecordingRequested(tabIdList[n]));
    }
  }
  yield put(
    RecorderActions.startSucceeded(
      project,
      test,
      userId,
      testRunId,
      isCleanRecording && !url,
      userSettings,
      uploadContext,
    ),
  );
}

export function* stopRequested({ viaContentMenu = false }) {
  const isRecording = yield select(selectIsRecording);
  if (!isRecording) {
    return;
  }

  yield call(browser.devTools.disableCommandsErrors);
  yield put(RecorderActions.setIsSavingSucceeded(true));
  yield call(changesBatcher.waitUntilRequestResolve);
  yield call(changesBatcher.reset);
  const websocketId = yield select(selectWebsocketId);
  const testId = yield select(selectRecordingTestId);
  try {
    if (viaContentMenu) {
      const params = { websocketId, testId };
      yield call(api.recorder.stop, params);
    }
    yield put(RecorderActions.stopSucceeded());
  } catch (error) {
    yield put(RecorderActions.stopFailure(error));
  }
  yield put(RecorderActions.setIsSavingSucceeded(false));

  logger.debug('[stopRequested] init disconnecting debugger from all tabs');
  yield call(browser.devTools.disconnectAll);
  logger.debug('[stopRequested] disconnecting debugger from all tabs finished');
}

export function* changeStepsRequested({ result, sync = false }) {
  const { diff = {}, stepsAdded = {}, stepsModified = {}, tabContext, artifacts } = result;
  const deltaId = yield call(genRandomId);
  yield put(RecorderActions.changeStepsStarted(deltaId));

  const testAndGroupIds = yield select(selectRecordingTestIdAndDraftGroupId);
  const projectId = yield select(selectRecordingProjectId);

  const changeData = {
    deltaId,
    ...testAndGroupIds,
    modified: transformChangesList(diff.modified, stepsModified, testAndGroupIds.testId),
    added: transformChangesList(diff.added, stepsAdded, testAndGroupIds.testId),
    removed: diff.removed,
  };

  const finishTask = RecorderActions.changeStepsSucceeded(
    deltaId,
    diff,
    stepsAdded,
    stepsModified,
    tabContext,
  );

  if (sync) {
    yield call(changesBatcher.addSyncChangeRequest, changeData, artifacts, projectId);
    yield put(finishTask);
  } else {
    yield all([
      put(finishTask),
      call(changesBatcher.addChangeRequest, changeData, artifacts, projectId),
    ]);
  }
}

export function* getExtendedEventData({ eventData: baseEventData, _sender }) {
  const isClipboard = yield select(selectIsRecordingToClipboard);
  const testAndGroupIds = yield select(selectRecordingTestIdAndDraftGroupId);
  const groupSequence = yield select(selectRecordingGroupSequence);
  let { tabId } = baseEventData;
  if (!tabId && _sender) {
    tabId = _sender.tab.id;
  }

  const tabAndWindowNo = yield select(selectTabAndWindowNo(tabId));
  const groupId = testAndGroupIds.groupId || groupSequence;
  const frontId = yield call(genFrontId);

  return {
    isActive: true,
    frontId,
    ...baseEventData,
    ...tabAndWindowNo,
    ...testAndGroupIds,
    groupId,
    isNewGroup: groupId !== testAndGroupIds.groupId,
    isClipboard,
  };
}

export function* addEventRequested({ eventData, _sender, sync = false, meta = {} }) {
  const extendedEventData = yield call(getExtendedEventData, { eventData, _sender });
  const processingData = yield select(selectProcessingData);
  const result = yield call(processRecordedEvent, extendedEventData, processingData);

  if (!sync) {
    yield put(RecorderActions.addEventSucceeded(extendedEventData));
  }

  try {
    if (result.hasChanged) {
      yield call(changeStepsRequested, { result, sync });
    }
    if (sync) {
      yield put(RecorderActions.addEventSucceeded(extendedEventData, sync, meta));
    }
  } catch (error) {
    yield put(RecorderActions.addEventFailure(error, meta));
  }
}

export function* updateStepScreenshotRequested({ testId, stepId, screenshot }) {
  const isClipboard = yield select(selectIsRecordingToClipboard);
  const data = {
    stepId,
    screenshotData: screenshot,
    testId,
    isClipboard,
  };

  try {
    yield call(api.extension.updateStepScreenshot, data);
    yield put(RecorderActions.updateStepScreenshotSucceeded(stepId, screenshot));
  } catch (error) {
    yield put(RecorderActions.updateStepScreenshotFailed());
  }
}

export function* startToClipboardRequested({ testId, windowId }) {
  const project = yield select(selectCurrentProject);
  const websocketId = yield select(selectWebsocketId);
  const testRun = yield select(selectTestRunByTestId(testId));

  const data = {
    websocketId,
    testId,
  };
  if (testRun) {
    data.testRunId = testRun.testRunId;
  }

  // eslint-disable-next-line no-console
  logger.debug(
    'Start to clipboard call params: ',
    JSON.stringify(omit(['settings'], project)),
    project.id,
  );
  try {
    const { data: responseData } = yield call(api.recorder.startToClipboard, data);
    yield put(
      RecorderActions.startRequested(
        project,
        {
          id: testId,
          lastGroupId: responseData.groupId,
          runProfileId: responseData.runProfileId,
        },
        windowId,
        null,
        null,
        null,
        responseData.variables,
      ),
    );

    yield take(RecorderTypes.START_SUCCEEDED);
    yield put(RecorderActions.startToClipboardSucceeded(responseData));
    yield put(UIStateActions.setState('Clipboard', { isRecording: true }));
  } catch (error) {
    yield put(RecorderActions.startToClipboardFailure());
  }
}

export function* stopToClipboardRequested({ testId }) {
  try {
    yield put(RecorderActions.stopRequested());
    yield put(RecorderActions.setIsSavingSucceeded(true));
    const websocketId = yield select(selectWebsocketId);
    const params = {
      websocketId,
      testId,
    };
    const { data: responseData } = yield call(api.recorder.stopToClipboard, params);
    yield put(RecorderActions.stopToClipboardSucceeded(responseData));
    yield put(UIStateActions.setState('Clipboard', { isRecording: false }));
    yield put(RecorderActions.setIsSavingSucceeded(false));
  } catch (error) {
    yield put(RecorderActions.setIsSavingSucceeded(false));
    yield put(RecorderActions.stopToClipboardFailure(error));
  }
}

export function* watchAddEventRequested() {
  const eventsChannels = yield actionChannel(RecorderTypes.ADD_EVENT_REQUESTED);
  while (true) {
    const payload = yield take(eventsChannels);
    yield call(addEventRequested, payload);
  }
}

export function* watchCaptureEventScreenshotRequested() {
  const eventsChannels = yield actionChannel(RecorderTypes.ADD_EVENT_REQUESTED);
  while (true) {
    const { eventData, _sender } = yield take(eventsChannels);

    if (_sender && eventData.withScreenshot) {
      yield put(BackgroundActions.captureElementScreenshotRequested(_sender.tab.id, eventData));
    }
  }
}

export function* copyContextFromRunnerRequested({ testRun }) {
  const { lastRunningStep, prevRunningStep } = testRun;
  const tabContext = pick(['tabNo', 'frameLocation'], lastRunningStep);
  const stepsOrder = [prevRunningStep.id, lastRunningStep.id];
  const steps = {
    [prevRunningStep.id]: prevRunningStep,
    [lastRunningStep.id]: lastRunningStep,
  };
  yield put(RecorderActions.copyContextFromRunnerSucceeded(tabContext, steps, stepsOrder));
}

export function* lockNativeMouseInteractionsRequested() {
  const testId = yield select(selectRecordingTestId);
  const tabIdList = yield select(selectTabIdListForTestId(testId));

  for (let n = 0; n < tabIdList.length; n += 1) {
    yield put(ContentActions.lockNativeMouseInteractionsRequested(tabIdList[n]));
  }
}

export function* unlockNativeMouseInteractionsRequested() {
  const testId = yield select(selectRecordingTestId);
  const tabIdList = yield select(selectTabIdListForTestId(testId));

  for (let n = 0; n < tabIdList.length; n += 1) {
    yield put(ContentActions.unlockNativeMouseInteractionsRequested(tabIdList[n]));
  }
}

export function* openNewTabWithUrlRequested({ windowId, url }) {
  try {
    const newTab = yield call(browser.tabs.create, windowId, { url }, true);
    yield put(
      RecorderActions.addEventRequested({
        timestamp: new Date().getTime(),
        type: STEP_TYPE.NEW_TAB,
        tabId: newTab.id,
        isTrusted: true,
        url,
      }),
    );
    yield put(RecorderActions.openNewTabWithUrlSucceeded());
  } catch (error) {
    yield put(RecorderActions.openNewTabWithUrlFailure(error));
  }
}

export function* getVariablesListRequested() {
  try {
    const testId = yield select(selectRecordingTestId);
    const testRunId = yield select(selectRecordingTestRunId);
    const profileId = yield select(selectRecordingProfileId);

    const { data } = yield call(api.recorder.getVariables, testId, testRunId, profileId);
    yield call(variables.setVariables, testId, data, true);
    const variablesMap = yield call(variables.getVariables, testId);
    yield put(RecorderActions.getVariablesListSucceeded(variablesMap));
  } catch (error) {
    yield put(RecorderActions.getVariablesListFailure(error));
  }
}

export function* addVariableToListRequested({ variable }) {
  try {
    yield call(variables.setLocalVariable, variable.name, variable);
    yield put(RecorderActions.addVariableToListSucceeded(variable));
  } catch (error) {
    yield put(RecorderActions.addVariableToListFailure(error));
  }
}

export default function* recorderSaga() {
  yield all([
    watchAddEventRequested(),
    watchCaptureEventScreenshotRequested(),
    yield takeLeading(RecorderTypes.START_REQUESTED, startRequested),
    yield takeLeading(RecorderTypes.STOP_REQUESTED, stopRequested),
    yield takeEvery(RecorderTypes.UPDATE_STEP_SCREENSHOT_REQUESTED, updateStepScreenshotRequested),
    yield takeLatest(RecorderTypes.OPEN_NEW_TAB_WITH_URL_REQUESTED, openNewTabWithUrlRequested),
    yield takeLeading(RecorderTypes.START_TO_CLIPBOARD_REQUESTED, startToClipboardRequested),
    yield takeLeading(RecorderTypes.STOP_TO_CLIPBOARD_REQUESTED, stopToClipboardRequested),
    yield takeLeading(
      RecorderTypes.COPY_CONTEXT_FROM_RUNNER_REQUESTED,
      copyContextFromRunnerRequested,
    ),
    yield takeEvery(
      RecorderTypes.LOCK_NATIVE_MOUSE_INTERACTIONS_REQUESTED,
      lockNativeMouseInteractionsRequested,
    ),
    yield takeEvery(
      RecorderTypes.UNLOCK_NATIVE_MOUSE_INTERACTIONS_REQUESTED,
      unlockNativeMouseInteractionsRequested,
    ),
    yield takeLatest(RecorderTypes.GET_VARIABLES_LIST_REQUESTED, getVariablesListRequested),
    yield takeLatest(RecorderTypes.ADD_VARIABLE_TO_LIST_REQUESTED, addVariableToListRequested),
  ]);
}
