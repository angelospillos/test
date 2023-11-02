import { STATUS } from '~/constants/test';
import * as Sentry from '@sentry/browser';
import { path, prop, pick, propOr, omit, isEmpty } from 'ramda';
import { all, put, takeLatest, delay, take, race, select, call } from 'redux-saga/effects';

import { MODAL_TYPE } from '~/constants/modal';
import {
  DEFAULT_MOBILE_USER_AGENT,
  DELAY_AFTER_WINDOW_CLOSE_TO_PREVENT_COOKIES_PROBLEM,
  SCREEN_RESOLUTION_TYPE,
} from '~/constants/test';
import { BackgroundActions } from '~/modules/background/background.redux';
import { ContentActions } from '~/modules/content/content.redux';
import { ExtensionActions, ExtensionTypes } from '~/modules/extension/extension.redux';
import {
  selectHasOpenedWindows,
  selectExtensionDomain,
} from '~/modules/extension/extension.selectors';
import { ProjectActions } from '~/modules/project';
import changesBatcher from '~/modules/recorder/recorder.batch';
import { RecorderActions } from '~/modules/recorder/recorder.redux';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import { RunnerActions } from '~/modules/runner/runner.redux';
import {
  selectRunningTestRun,
  selectStepRunningStatus,
  selectStepRunningResult,
  selectPreviousTestRunEndTime,
  selectIsStopping,
  selectTestRun,
} from '~/modules/runner/runner.selectors';
import { UIStateActions } from '~/modules/uistate/uistate.redux';
import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import browser from '~/services/browser';
import storage from '~/services/browser/storage';
import webRequests from '~/services/browser/webRequests';
import domLayer from '~/services/domLayer';
import Logger from '~/services/logger';
import system from '~/services/system';
import variables from '~/services/variables';
import { serializeError, deserializeError } from '~/utils/errors';
import { sleep } from '~/utils/misc';

import { HEARTBEAT_INTERVAL } from './core.constants';
import { CoreActions, CoreTypes } from './core.redux';

const logger = Logger.get('Core');

export function* startHeartbeatRequested() {
  let isActive = true;
  while (isActive) {
    const { stopped } = yield race({
      delayed: delay(HEARTBEAT_INTERVAL),
      stopped: take(CoreTypes.STOP_HEARTBEAT_REQUESTED),
    });

    if (stopped) {
      isActive = false;
    } else {
      yield put(WebsocketActions.sendRequested(CoreTypes.PING, {}));
    }
  }
}

export function* handleError({ errorCode }) {
  yield put(
    CoreActions.captureException(
      serializeError({ message: `Unexpected error occured on the server (${errorCode})` }),
    ),
  );
}

const pickStepLogData = (step) =>
  pick(['waitingConditions', 'selectors', 'id', 'type', 'stepRunId'], step || {});

const pickStepRunLogData = (stepRun) =>
  stepRun ? { ...stepRun, variables: variables.getVariables(stepRun.id) } : {};

function* getLogData(details = {}) {
  const extensionState = yield select(selectExtensionDomain);
  const runningTestRun = yield select(selectRunningTestRun);
  const isStopping = yield select(selectIsStopping);
  const runningStep = propOr({}, 'lastRunningStep', runningTestRun);
  const stepRunId = prop('stepRunId', runningStep);
  const stepRunResult = runningTestRun
    ? yield select(selectStepRunningResult(runningTestRun.testRunId, runningStep.id))
    : {};
  const isRecording = yield select(selectIsRecording);
  return {
    tags: {
      extensionSessionType: isRecording ? 'recording' : 'running',
      stepRunId,
    },
    contexts: {
      ...details,
      state: {
        extension: {
          type: 'Redux',
          value: extensionState,
        },
        currentStep: {
          type: 'Redux',
          value: pickStepLogData(runningStep),
        },
        currentStepRunResult: {
          type: 'Redux',
          value: pickStepRunLogData(stepRunResult),
        },
        timeouts: {
          type: 'Redux',
          value: runningTestRun?.lastRunningStepTimer,
        },
        runner: {
          type: 'Redux',
          value: {
            isStopping,
          },
        },
      },
    },
  };
}

export function* captureExceptionAsWarning({ sourceError, details }) {
  const logData = yield call(getLogData, details);
  const parsedError = JSON.parse(sourceError);
  const error = Object.assign(new Error(parsedError.message), parsedError);
  yield call(Sentry.captureException, error, {
    level: 'warning',
    ...logData,
  });
}

export function* dumpExtensionState({ title = 'Extension state dump requested' }) {
  const logData = yield call(getLogData);
  const runningTestRun = yield select(selectRunningTestRun);
  const runId = runningTestRun?.testRunId || 'Test stopped or never run. See tags to get run ID.';
  const message = `${title} (${runId})`;
  yield call(Sentry.captureMessage, message, {
    level: 'debug',
    ...logData,
  });
}

export function* captureException({ sourceError, lastAction, details = {} }) {
  try {
    const runTimeError = deserializeError(sourceError);
    logger.debug('Captured exception:', runTimeError.message);
    logger.error(runTimeError);

    const isRecording = yield select(selectIsRecording);

    if (isRecording) {
      yield put(RecorderActions.stopRequested());
    }

    const runningTestRun = yield select(selectRunningTestRun);
    let testRunId = prop('testRunId', runningTestRun);
    let stepId = path(['lastRunningStep', 'id'], runningTestRun);
    let shouldUpdateStatus = testRunId && stepId;

    if (lastAction) {
      testRunId = lastAction.testRunId;
      stepId = lastAction.stepId || path(['step', 'id'], lastAction);
      shouldUpdateStatus = testRunId && stepId && lastAction.status !== STATUS.ERROR;
    }

    const logData = yield call(getLogData, {
      ...details,
      error: {
        id: runTimeError.params.errorId,
      },
    });

    if (testRunId) {
      yield put(RunnerActions.stopSucceeded(testRunId, STATUS.ERROR, runTimeError.params));
      yield put(RunnerActions.stopAllRequested(STATUS.ERROR, runTimeError));
      yield put(ContentActions.stopRunningRequested());
    }

    if (shouldUpdateStatus) {
      const status = yield select(selectStepRunningStatus(testRunId, stepId));
      if (!status || status === STATUS.RUNNING) {
        const stepRunResult = {
          ...runTimeError.params,
          status: STATUS.ERROR,
          forceFailed: true,
        };
        const taskObj = pick(['testRunId', 'testId'], lastAction || runningTestRun);
        yield put(
          RunnerActions.updateStepRunStatusRequested(
            testRunId,
            stepId,
            STATUS.ERROR,
            stepRunResult,
            taskObj,
          ),
        );
      } else {
        yield put(RunnerActions.stopSucceeded(testRunId, STATUS.ERROR, runTimeError.params));
      }
    }

    yield put(UIStateActions.showModal(MODAL_TYPE.RUNTIME_ERROR));

    yield call(Sentry.captureException, runTimeError, logData);
  } catch (error) {
    logger.debug('Error captured while pushing error log to sentry');
    yield call(Sentry.captureException, error);
  }
}

export function* clearPreviousSessionRequested({ project }) {
  try {
    logger.debug('[Session setup]', 'Checking if some incognito windows are opened');
    const hasOpenedUncontrolledIncognitoWindows = yield call(
      browser.windows.hasOpenedIncognitoWindows,
    );
    const hasOpenedControlledWindows = yield select(selectHasOpenedWindows);
    const previousTestRunEndTime = yield select(selectPreviousTestRunEndTime);

    if (project?.settings?.incognitoMode) {
      logger.debug('[Session setup]', 'Closing controlled incognito windows');
      yield call(browser.windows.closeAllInIncognitoMode);
    }
    if (hasOpenedControlledWindows || hasOpenedUncontrolledIncognitoWindows) {
      yield put(ExtensionActions.restartPendingDisconnectionRequested());
      yield put(ExtensionActions.closeWindowsRequested());
      logger.debug('[Session setup]', 'Closing uncontrolled incognito windows');
      yield take(ExtensionTypes.CLOSE_WINDOWS_SUCCEEDED);
    }

    if (
      hasOpenedControlledWindows ||
      hasOpenedUncontrolledIncognitoWindows ||
      (previousTestRunEndTime &&
        Date.now() - previousTestRunEndTime < DELAY_AFTER_WINDOW_CLOSE_TO_PREVENT_COOKIES_PROBLEM)
    ) {
      logger.debug('[Session setup]', 'Waiting some delay to prevent cookies issues');
      yield call(sleep, DELAY_AFTER_WINDOW_CLOSE_TO_PREVENT_COOKIES_PROBLEM);
    }
    yield put(CoreActions.clearPreviousSessionSucceeded());
  } catch (error) {
    yield put(CoreActions.clearPreviousSessionFailure(error));
  }
}

export function* setupSessionRequested({
  testRunId,
  userId,
  project,
  screenSizeType,
  isRunAndRecordSession = false,
}) {
  try {
    yield call(Logger.resetLogs);
    logger.info('[Session setup]', 'Resetting store state');
    if (!isRunAndRecordSession) {
      yield put(CoreActions.clearPreviousSessionRequested(project));

      logger.debug('[Session setup]', 'Waiting until previous session cleared');
      yield take([
        CoreTypes.CLEAR_PREVIOUS_SESSION_SUCCEEDED,
        CoreTypes.CLEAR_PREVIOUS_SESSION_FAILURE,
      ]);
    }

    if (!isRunAndRecordSession) {
      yield put(BackgroundActions.clearScreenshotsHistoryRequested());
      yield put(RecorderActions.resetRequested());
      yield put(RecorderActions.resetRequested());
      yield put(ExtensionActions.resetRequested());
      yield put(RunnerActions.resetRequested());
      yield put(ProjectActions.resetRequested());
      yield put(UIStateActions.resetRequested());
      yield put(ContentActions.resetRequested());
    } else {
      /*
        Copy runner context to recorder if user continues recording after run

        While recording one by one we have to ignore recorder store resetting
        because we'll lose recording context
      */
      const testRun = yield select(selectTestRun(testRunId));
      if (testRun && !isEmpty(testRun)) {
        yield put(BackgroundActions.clearScreenshotsHistoryRequested());
        yield put(RecorderActions.resetRequested());
        logger.debug('[Session setup]', 'Copying context from previous test run...');
        yield put(RecorderActions.copyContextFromRunnerRequested(testRun));
      }
    }

    logger.debug('[Session setup]', 'Resetting services...');
    logger.debug('[Session setup]', 'Resetting local storage');
    yield call(storage.reset);
    logger.debug('[Session setup]', 'Resetting dev tools settings');
    yield call(browser.devTools.reset);
    logger.debug('[Session setup]', 'Enabling commands errors');
    yield call(browser.devTools.enableCommandsErrors);
    logger.debug('[Session setup]', 'Resetting web requests service');
    yield call(webRequests.reset);
    logger.debug('[Session setup]', 'Resetting variables service');
    yield call(variables.reset);
    logger.debug('[Session setup]', 'Resetting recorded events batching service');
    yield call(changesBatcher.reset);
    logger.debug('[Session setup]', 'Resetting dom layer');
    yield call(domLayer.reset);

    logger.debug('[Session setup]', 'Setting session data');
    yield call(Sentry.setTag, 'projectId', project.id);
    yield call(Sentry.setTag, 'testRunId', testRunId);
    yield call(
      Sentry.setTag,
      'testRunUrl',
      `${process.env.WEBAPP_HOME_URL}starship-admin/runner/testrun/${testRunId}`,
    );
    yield call(
      Sentry.setTag,
      'userUrl',
      `${process.env.WEBAPP_HOME_URL}starship-admin/user/user/?id__icontains=${userId}`,
    );

    logger.debug('[Session setup]', 'Getting displays info');
    const displays = yield call(system.getDisplaysInfo);
    yield call(Sentry.setContext, 'displays', { data: displays });
    yield call(Sentry.setUser, { id: userId });

    logger.debug('[Session setup]', 'Initializing extra HTTP headers');
    yield call(
      webRequests.initializeExtraHeaders,
      screenSizeType === SCREEN_RESOLUTION_TYPE.MOBILE
        ? project.settings.userAgent || DEFAULT_MOBILE_USER_AGENT
        : project.settings.userAgent,
      project.settings.browserLanguage,
      project.settings.browserCustomHeaders,
    );
    yield put(CoreActions.setupSessionSucceeded());
  } catch (error) {
    yield put(
      CoreActions.captureException(
        serializeError(error),
        {},
        {
          arguments: {
            testRunId,
            userId,
            project: omit(['settings'], project || {}),
            isRunAndRecordSession,
          },
        },
      ),
    );
    yield put(CoreActions.setupSessionFailure());
  }
}

export default function* coreSagas() {
  yield all([
    yield takeLatest(CoreTypes.START_HEARTBEAT_REQUESTED, startHeartbeatRequested),
    yield takeLatest(CoreTypes.ERROR, handleError),
    yield takeLatest(CoreTypes.CAPTURE_EXCEPTION, captureException),
    yield takeLatest(CoreTypes.CAPTURE_EXCEPTION_AS_WARNING, captureExceptionAsWarning),
    yield takeLatest(CoreTypes.SETUP_SESSION_REQUESTED, setupSessionRequested),
    yield takeLatest(CoreTypes.CLEAR_PREVIOUS_SESSION_REQUESTED, clearPreviousSessionRequested),
    yield takeLatest(CoreTypes.DUMP_EXTENSION_STATE, dumpExtensionState),
  ]);
}
