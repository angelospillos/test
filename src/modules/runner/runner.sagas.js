import { STATUS } from '~/constants/test';
import { equals, isEmpty, omit, prop, propOr, values } from 'ramda';
import {
  all,
  call,
  delay,
  put,
  race,
  select,
  take,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';

import captureScreenshot from '~/background/utils/captureScreenshot';
import { WAITING_CONDITION_TYPE } from '~/constants/step';
import {
  DEFAULT_RUN_TIMEOUT_MILLISECONDS,
  LOGS_UPLOAD_TIMEOUT,
  MAIN_FRAME_DATA,
  SCREENSHOT_UPLOAD_TIMEOUT,
  STEP_TYPE,
  STEP_TYPES_WITHOUT_CURSOR,
} from '~/constants/test';
import { COMPUTABLE_FIELDS, COMPUTABLE_SELECTOR_FIELDS } from '~/constants/variables';
import { BackgroundTypes } from '~/modules/background/background.redux';
import { ContentActions, ContentTypes } from '~/modules/content/content.redux';
import { CoreActions, CoreTypes } from '~/modules/core/core.redux';
import { ExtensionActions, ExtensionTypes } from '~/modules/extension/extension.redux';
import {
  selectIsPromptOpened,
  selectIsSelenium,
  selectTabIdListForTestRunId,
} from '~/modules/extension/extension.selectors';
import { selectCurrentProjectSettings } from '~/modules/project';
import * as exceptions from '~/modules/runner/runner.exceptions';
import * as executors from '~/modules/runner/runner.executors';
import * as helpers from '~/modules/runner/runner.helpers';
import { takeFromFrame } from '~/modules/runner/runner.helpers';
import { RunnerActions, RunnerTypes } from '~/modules/runner/runner.redux';
import {
  selectCurrentTabIdForTestRunId,
  selectExecutionUrlForTestRunId,
  selectHasStepFailedWaitingConditions,
  selectIsRunningTestRun,
  selectIsStopping,
  selectLastRunningStep,
  selectRunningTestError,
  selectRunningTestRun,
  selectRunningTestStatus,
  selectStepRunningResult,
  selectStepRunningStatus,
  selectTestRun,
  selectTestRunIds,
} from '~/modules/runner/runner.selectors';
import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import api from '~/services/api';
import browser from '~/services/browser';
import WebRequests from '~/services/browser/webRequests';
import featureFlags from '~/services/featureFlags/featureFlags';
import Logger from '~/services/logger';
import variables from '~/services/variables';
import { isCloud } from '~/utils/env';
import { captureException, PAGE_LOADING_ERROR_CODE, serializeError } from '~/utils/errors';
import {
  checkIsSelectorRequired,
  convertBoolToString,
  createCompleteStepUrl,
  isValidUrl,
} from '~/utils/misc';

const logger = Logger.get('Runner Sagas');

const stepRunners = {
  [STEP_TYPE.GOTO]: executors.goto,
  [STEP_TYPE.TYPE]: executors.type,
  [STEP_TYPE.HOVER]: executors.hover,
  [STEP_TYPE.MOUSEDOWN]: executors.mousedown,
  [STEP_TYPE.MOUSEUP]: executors.mouseup,
  [STEP_TYPE.CLICK]: executors.click,
  [STEP_TYPE.DOUBLE_CLICK]: executors.dblClick,
  [STEP_TYPE.RIGHT_CLICK]: executors.rightClick,
  [STEP_TYPE.CHANGE]: executors.change,
  [STEP_TYPE.CLEAR]: executors.clear,
  [STEP_TYPE.ASSERT]: executors.assert,
  [STEP_TYPE.SCROLL]: executors.scroll,
  [STEP_TYPE.NEW_TAB]: executors.newTab,
  [STEP_TYPE.SWITCH_CONTEXT]: executors.switchContext,
  [STEP_TYPE.CLOSE_TAB]: executors.closeTab,
  [STEP_TYPE.EXECUTE]: executors.execute,
  [STEP_TYPE.UPLOAD_FILE]: executors.uploadFile,
  [STEP_TYPE.SELECT]: executors.selectOption,
  [STEP_TYPE.DRAG_AND_DROP]: executors.dragAndDrop,
  [STEP_TYPE.ANSWER_PROMPT]: executors.answerPrompt,
  [STEP_TYPE.SET_LOCAL_VARIABLE]: executors.setLocalVariable,
};

function* runExecutor({ tabId, step, testRunId, projectSettings, frameLocation, runVariables }) {
  const shouldHideCursor = STEP_TYPES_WITHOUT_CURSOR.includes(step.type);
  yield put(ExtensionActions.setIsCursorVisible(!shouldHideCursor));

  yield call(stepRunners[step.type], {
    step,
    testRunId,
    projectSettings,
    tabId,
    frameLocation,
    variables: runVariables,
  });

  if (step.invokesPrompt) {
    yield takeFromFrame(tabId, MAIN_FRAME_DATA.frameId, RunnerTypes.OPEN_PROMPT_SUCCEEDED, {
      stepId: step.id,
    });
  }
  return true;
}

export function* executeStep(params) {
  const {
    step,
    testRunId,
    projectSettings,
    tabId,
    frameLocation,
    variables: runVariables,
  } = params;
  logger.debug('[executeStep]: start');
  logger.verbose('[executeStep]: step', step);

  if (!prop(step.type, stepRunners)) {
    throw new exceptions.UnrecognizedStepTypeError({ type: step.type });
  }
  if (checkIsSelectorRequired(step) && isEmpty(step.selectors)) {
    throw new exceptions.SelectorRequiredError();
  }
  const sleepMilliseconds = (step.sleep ?? projectSettings.sleep) * 1000;
  if (sleepMilliseconds) {
    yield delay(sleepMilliseconds);
  }
  let executed = false;
  while (!executed) {
    yield call(helpers.waitForActiveRequestsIfNeeded, {
      tabId,
      testRunId,
      step,
    });

    const stepRun = yield select(selectStepRunningResult(testRunId, step.id));
    if (stepRun && stepRun.executed) {
      const hasStepFailedWaitingConditions = yield select(
        selectHasStepFailedWaitingConditions(testRunId, step.id),
      );

      if (!hasStepFailedWaitingConditions) {
        break;
      }
    }

    logger.debug('[executeStep]: call executor');

    const result = yield race({
      executed: call(runExecutor, {
        tabId,
        step,
        testRunId,
        projectSettings,
        frameLocation,
        runVariables,
      }),
      promptInvoked: takeFromFrame(
        tabId,
        MAIN_FRAME_DATA.frameId,
        RunnerTypes.OPEN_PROMPT_SUCCEEDED,
        { stepId: step.id },
      ),
      aborted: takeFromFrame(tabId, MAIN_FRAME_DATA.frameId, ContentTypes.ELEMENT_REMOVED),
      pageReloaded: takeFromFrame(
        tabId,
        MAIN_FRAME_DATA.frameId,
        ExtensionTypes.REMOVE_FRAME_SUCCEEDED,
      ),
    });

    if (result.aborted) {
      logger.debug('[executeStep]: executor aborted because related element was removed');
    }

    executed = result.promptInvoked || (!result.pageReloaded && !result.aborted);
    logger.debug('[executeStep]: executor finished work', executed);
    logger.verbose('[executeStep]: executor result', result);
  }

  yield put(
    RunnerActions.updateStepRunResultRequested(testRunId, step.id, {
      executed: true,
    }),
  );

  yield call(helpers.waitForPageNavigationIfNeeded, {
    testRunId,
    tabId,
    step,
  });

  yield put(
    RunnerActions.updateStepRunResultRequested(testRunId, step.id, {
      finished: true,
    }),
  );
  logger.debug('executeStep: finished, status PASSED');
  return yield select(selectStepRunningResult(testRunId, step.id));
}

function* computeValues(testRunId, testId, stepId, source, fields, tabContext = {}) {
  try {
    return yield call(variables.computeValues, {
      variablesSetKey: stepId,
      source,
      sourceFields: fields,
      executionContext: tabContext,
    });
  } catch (error) {
    if (error.params) {
      yield put(
        RunnerActions.updateStepRunStatusRequested(testRunId, stepId, STATUS.FAILED, error.params, {
          testId,
        }),
      );
    }
    throw error;
  }
}

function* getComputedStepFields(testRunId, testId, step, tabContext) {
  const computedStepFields = yield call(
    computeValues,
    testRunId,
    testId,
    step.id,
    step,
    COMPUTABLE_FIELDS,
    tabContext,
  );

  for (let i = 0; i < COMPUTABLE_SELECTOR_FIELDS.length; i += 1) {
    const selectorsFieldName = COMPUTABLE_SELECTOR_FIELDS[i];
    if (step[selectorsFieldName]) {
      const selectors = [...step[selectorsFieldName]];
      for (let index = 0; index < selectors.length; index += 1) {
        const selector = selectors[index];
        if (selector.isCustom) {
          const { computedSelector } = yield call(
            computeValues,
            testRunId,
            testId,
            step.id,
            selector,
            ['selector'],
            tabContext,
          );
          // eslint-disable-next-line no-param-reassign
          selectors[index] = {
            ...selectors[index],
            computedSelector,
          };
        }
      }
      computedStepFields[selectorsFieldName] = selectors;
    }
  }

  return computedStepFields;
}

export function* prepareAndRunStep(testRunId, baseStep) {
  let status = STATUS.FAILED;
  try {
    const testRun = yield select(selectTestRun(testRunId));
    const { params, tabContext, testId } = testRun;
    const projectSettings = yield select(selectCurrentProjectSettings);
    const computedStepValues = yield call(
      getComputedStepFields,
      testRunId,
      testId,
      baseStep,
      tabContext,
    );

    // eslint-disable-next-line no-param-reassign
    const step = { ...baseStep, params, ...computedStepValues };

    yield put(
      RunnerActions.updateStepRunStatusRequested(
        testRunId,
        step.id,
        STATUS.RUNNING,
        computedStepValues,
      ),
    );

    const runVariables = yield call(variables.getComputedVariables, step.id);

    yield call(executeStep, {
      step,
      variables: runVariables,
      testRunId,
      projectSettings,
      tabId: tabContext.currentTabId,
      frameLocation: tabContext.frameLocation,
    });

    status = STATUS.PASSED;
  } catch (error) {
    logger.verbose('[prepareAndRunStep] error catched', error);
    const isHandledError = !!exceptions[error.name];
    const isRuntimeError = isHandledError && error.params.errorCode === exceptions.RUNTIME_ERROR;
    if (isHandledError) {
      const errorParams = propOr({}, 'params', error);
      const updateState = {
        warning: baseStep.type === STEP_TYPE.ASSERT && !!baseStep.continueOnFailure,
        forceFailed: !isHandledError || !baseStep.continueOnFailure,
        ...errorParams,
      };

      yield put(RunnerActions.updateStepRunResultRequested(testRunId, baseStep.id, updateState));
    }

    if (!isHandledError || isRuntimeError) {
      throw error;
    }
  }
  return status;
}

function handleInvalidFirstStep() {
  const result = {
    status: STATUS.FAILED,
    shouldCaptureScreenshot: false,
    shouldUpdateStatus: true,
  };

  const changeInfo = {
    ...new exceptions.MissingGotoStep({ message: null }).params,
    timeout: false,
    status: result.status,
    forceFailed: true,
  };

  return { result, changeInfo };
}

function* handleRedundantStep(testRunId) {
  // It handles race condition, when BE sent new run request
  // and received final status for previous step in the same time
  const result = {
    shouldCaptureScreenshot: false,
    shouldUpdateStatus: true,
  };
  const currentTestStatus = yield select(selectRunningTestStatus(testRunId));
  const currentTestError = yield select(selectRunningTestError(testRunId));
  result.status = currentTestStatus || STATUS.ERROR;

  const changeInfo = {
    ...(currentTestError || new exceptions.StepRunInitializationError().params),
    timeout: false,
    status: result.status,
    forceFailed: true,
  };

  return { result, changeInfo };
}

const isScreenshotRequired = (result, changeInfo, step) =>
  !(
    step.type === STEP_TYPE.GOTO &&
    changeInfo.error === PAGE_LOADING_ERROR_CODE.ERR_CONNECTION_TIMED_OUT
  ) &&
  !result.windowClosed &&
  !result.tabClosedUnexpectedly &&
  !result.debuggerDetachedUnexpectedly &&
  !result.windowMinimizedUnexpectedly;

const isStatusUpdateRequired = (result) =>
  !result.internalError &&
  !result.windowClosed &&
  !result.tabClosedUnexpectedly &&
  !result.runtimeError;

const shouldMarkStepAsWarning = (step, changeInfo) => {
  const isTimeoutOnAllowedAssertion = step.type === STEP_TYPE.ASSERT && !!step.continueOnFailure;
  const isTimeoutOnAllowedChange =
    step.type === STEP_TYPE.CHANGE && changeInfo.errorCode === exceptions.INVALID_FIELD_VALUE;
  return isTimeoutOnAllowedAssertion || isTimeoutOnAllowedChange;
};

export function* runStepRequested(params) {
  const { testRunId, step, stepRunId, testId, variables: runVariables = {}, isFirstStep } = params;
  logger.debug(`[runStepRequested] Start: ${step.type}, ${step.id}`);
  const start = new Date();

  yield put(RunnerActions.setRunningStepSucceeded(testRunId, step, stepRunId, isFirstStep));
  const isRunning = yield select(selectIsRunningTestRun(testRunId));
  let result = {};
  let changeInfo = {};

  if (isFirstStep && step.type !== STEP_TYPE.GOTO) {
    ({ result, changeInfo } = yield call(handleInvalidFirstStep));
  } else if (!isRunning) {
    logger.debug(
      '[runStepRequested] New step run detected, while test run is not in running state:',
      step.id,
    );
    ({ result, changeInfo } = yield call(handleRedundantStep, testRunId, step));
  } else {
    const testRun = yield select(selectTestRun(testRunId));
    const projectSettings = yield select(selectCurrentProjectSettings);
    const runTimeoutSeconds =
      step.runTimeout ?? projectSettings.runTimeout ?? DEFAULT_RUN_TIMEOUT_MILLISECONDS;
    const sleepSeconds = step.sleep ?? projectSettings.sleep;

    logger.verbose(
      '[runStepRequested] project settings',
      projectSettings,
      testRun,
      testRunId,
      runTimeoutSeconds,
    );
    yield put(
      RunnerActions.setRunningStepTimer(
        testRunId,
        start.getTime(),
        runTimeoutSeconds,
        sleepSeconds,
      ),
    );
    yield call(variables.setVariables, step.id, runVariables);

    result = yield race({
      status: call(prepareAndRunStep, testRunId, step),
      stopped: take(RunnerTypes.STOP_REQUESTED),
      timeout: call(helpers.waitForTimeout, testRunId, step.id, runTimeoutSeconds, sleepSeconds),
      windowClosed: take(ExtensionTypes.REMOVE_WINDOW_SUCCEEDED),
      tabClosedUnexpectedly: take(RunnerTypes.STOP_TEST_ON_TAB_CLOSED_REQUESTED),
      debuggerDetachedUnexpectedly: take(RunnerTypes.STOP_TEST_ON_DEBUGGER_DETACHED_REQUESTED),
      windowMinimizedUnexpectedly: take(RunnerTypes.STOP_TEST_ON_WINDOW_MINIMIZED_REQUESTED),
      internalError: take(CoreTypes.ERROR),
      runtimeError: take(CoreTypes.CAPTURE_EXCEPTION),
    });

    logger.debug(
      'result here',
      Object.keys(result)[0],
      omit(['internalError', 'runtimeError'], result),
    );

    if (result.debuggerDetachedUnexpectedly) {
      yield call(browser.devTools.disableCommandsErrors);
      logger.debug('command errors disabled');
      changeInfo = new exceptions.DebuggerDetached().params;
      result.status = STATUS.FAILED;
    }

    if (result.windowMinimizedUnexpectedly) {
      changeInfo = new exceptions.WindowMinimized().params;
      result.status = STATUS.FAILED;
    }

    if (result.timeout) {
      const errorParams = yield call(helpers.getRunnerErrorParams, testRunId, step);
      changeInfo = {
        ...errorParams,
        timeout: true,
        runTimeout: runTimeoutSeconds,
        warning: false,
      };

      if (shouldMarkStepAsWarning(step, changeInfo)) {
        changeInfo.warning = true;
        result.status = STATUS.PASSED;
      } else {
        /*
          We have to stop all running content scripts as soon as possible
          to avoid unnecessary calls to attached debugger and errors, which
          can be thrown after debugger is detached.
        */
        const tabIdList = yield select(selectTabIdListForTestRunId(testRunId));
        logger.debug(
          '[runStepRequested] Stopping pending content script functions in tabs:',
          tabIdList,
        );
        for (let n = 0; n < tabIdList.length; n += 1) {
          yield put(ContentActions.stopRunningRequested(tabIdList[n]));
        }
      }
    }
  }

  result.shouldCaptureScreenshot = isScreenshotRequired(result, changeInfo, step);
  result.shouldUpdateStatus = isStatusUpdateRequired(result);
  result.status = result.status || (result.stopped ? STATUS.STOPPED : STATUS.FAILED);

  if (result.shouldCaptureScreenshot && (result.status !== STATUS.PASSED || !!changeInfo.warning)) {
    const currentTabId = yield select(selectCurrentTabIdForTestRunId(testRunId));
    logger.debug('[runStepRequested] Waiting for screenshot for tab', currentTabId);
    if (!currentTabId) {
      logger.debug('[runStepRequested] Taking screenshot canceled. Tab does not exists.');
    } else {
      yield put(RunnerActions.updateStepRunScreenshotRequested(testRunId, currentTabId, step.id));
      const isDebuggerConnected = yield call(browser.devTools.isConnected, currentTabId);
      if (result.status !== STATUS.PASSED && isDebuggerConnected) {
        yield take([
          RunnerTypes.UPDATE_STEP_RUN_SCREENSHOT_FAILED,
          RunnerTypes.UPDATE_STEP_RUN_SCREENSHOT_SUCCEEDED,
        ]);
      }
      logger.debug('[runStepRequested] Screenshot taken');
    }
  }

  if (result.status !== STATUS.PASSED) {
    logger.debug('[runStepRequested] init disconnecting debugger from all tabs');
    const hasOpenedPrompt = yield select(selectIsPromptOpened);
    yield call(browser.devTools.disconnectAll, hasOpenedPrompt);
    logger.debug('[runStepRequested] disconnecting debugger from all tabs finished');
  } else if (!result.timeout && !changeInfo.warning) {
    changeInfo.errorCode = '';
    changeInfo.error = '';
  }

  if (result.shouldUpdateStatus) {
    yield put(
      RunnerActions.updateStepRunStatusRequested(testRunId, step.id, result.status, changeInfo, {
        testId,
      }),
    );
  }

  if (exceptions.EXCEPTIONS_TO_DUMP_STATE.includes(changeInfo.errorCode) && !changeInfo.warning) {
    if (changeInfo.errorCode === exceptions.PAGE_LOADING_ERROR) {
      if (changeInfo.error === PAGE_LOADING_ERROR_CODE.ERR_CONNECTION_TIMED_OUT) {
        yield put(CoreActions.dumpExtensionState(changeInfo.error));
      }
    } else {
      yield put(CoreActions.dumpExtensionState(changeInfo.errorCode));
    }
  }

  const stop = new Date();
  const runDelta = (stop.getTime() - start.getTime()) / 1000;
  logger.debug(`[runStepRequested] End time: ${runDelta} ${step.id}`);
}

export function* prepareBrowserAndRunStep(actionData) {
  const {
    project,
    step,
    stepRunId,
    testRunId,
    testId,
    userId,
    userSettings,
    variables: runVariables,
    externalLoggingEnabled,
    screenSizeType,
    uploadContext,
  } = actionData;

  if (externalLoggingEnabled) {
    logger.debug('[prepareBrowserAndRunStep]', 'Enabling external logging started');
    yield call(Logger.setMetaData, { userId, testRunId });
    yield call(Logger.enableDebugMode);
    yield call(Logger.enableExternalLogs);
    logger.debug('[prepareBrowserAndRunStep]', 'Enabling external logging finished');
  }

  const runLogsEnabled = yield call(featureFlags.isEnabled, 'runLogs');
  if (!runLogsEnabled) {
    logger.debug('[prepareBrowserAndRunStep]', 'Run logs disabled by feature flag');
    yield call(Logger.disableGeneralLogs);
  }

  try {
    if (yield select(selectIsStopping)) {
      /*
        While running suite, BE still emits STOP_REQUESTED event after each test.
        Sometimes the next test run is starting before the stopping process is finished (race),
        so we have to wait first for the success event, and then continue starting a new test.
      */
      logger.debug(
        '[prepareBrowserAndRunStep]',
        'Waiting until previous test stopped successfully',
      );
      yield take(RunnerTypes.STOP_SUCCEEDED);
    }
    const isSelenium = yield select(selectIsSelenium);
    yield put(CoreActions.setupSessionRequested(testRunId, userId, project, screenSizeType));
    logger.debug('[prepareBrowserAndRunStep]', 'Waiting until session setup finished');
    yield take([CoreTypes.SETUP_SESSION_SUCCEEDED, CoreTypes.SETUP_SESSION_FAILURE]);

    yield put(
      RunnerActions.startSucceeded(
        testRunId,
        testId,
        userId,
        project,
        step,
        userSettings,
        uploadContext,
      ),
    );
    logger.debug('[prepareBrowserAndRunStep]', 'Setting variables');
    yield call(variables.setVariables, step.id, runVariables);
    logger.debug('[prepareBrowserAndRunStep]', 'Computing url for initial step', step.url);
    const { computedUrl } = yield call(computeValues, testRunId, testId, step.id, step, ['url']);

    if (step.type === STEP_TYPE.GOTO && !isValidUrl(computedUrl || step.url)) {
      yield put(
        RunnerActions.updateStepRunStatusRequested(
          testRunId,
          step.id,
          STATUS.FAILED,
          new exceptions.InvalidUrl({ message: computedUrl || step.url }).params,
          {
            testId,
          },
        ),
      );
      return;
    }

    step.computedUrl = computedUrl;
    const url = createCompleteStepUrl(step);
    logger.debug('[prepareBrowserAndRunStep]', 'Opening window with computed url', url);
    const { tabId } = yield call(browser.windows.open, {
      projectSettings: project.settings,
      userSettings,
      incognitoMode: isSelenium ? false : project.settings.incognitoMode,
      testId,
      testRunId,
      screenSizeType,
      url,
    });

    yield put(
      RunnerActions.updateCurrentTabContextSucceeded(testRunId, tabId, MAIN_FRAME_DATA.frameId),
    );

    yield put(
      RunnerActions.runStepRequested(step, stepRunId, testRunId, testId, runVariables, true),
    );
  } catch (error) {
    if (!error.isHandled) {
      captureException(error, true, { testRunId, testId, step });
    }
  }
}

export function* startRequested(actionData) {
  const { testRunId, testId, project, step } = actionData;

  const runTimeoutSeconds =
    step.runTimeout ?? project?.settings?.runTimeout ?? DEFAULT_RUN_TIMEOUT_MILLISECONDS;
  const sleepSeconds = step.sleep ?? project?.settings?.sleep;

  let error;
  let isSupportedBrowser = false;
  try {
    isSupportedBrowser = yield call(browser.details.isSupportedBrowser);
  } catch (checkError) {
    logger.error('[startRequested] Error while checking browser support', testRunId, checkError);
  }

  if (isSupportedBrowser) {
    const result = yield race({
      timeout: call(helpers.waitForTimeout, testRunId, step.id, runTimeoutSeconds, sleepSeconds),
      finished: call(prepareBrowserAndRunStep, actionData),
    });

    if (result.timeout) {
      error = new exceptions.InitializationError();
      error.params.timeout = true;
    }
  } else {
    error = new exceptions.UnsupportedBrowser();
  }

  if (error) {
    yield put(
      RunnerActions.updateStepRunStatusRequested(testRunId, step.id, STATUS.FAILED, error.params, {
        testId,
      }),
    );
    yield put(CoreActions.dumpExtensionState(error.params.errorCode));
  }
}

export function* stopRequested({ status = STATUS.STOPPED, testRunId, shouldFetchTestRun = true }) {
  yield call(browser.devTools.disableCommandsErrors);

  const tabIdList = yield select(selectTabIdListForTestRunId(testRunId));
  for (let n = 0; n < tabIdList.length; n += 1) {
    yield put(ContentActions.stopRunningRequested(tabIdList[n]));
  }

  if (shouldFetchTestRun && !isCloud()) {
    try {
      const { data: testRun } = yield call(api.testRuns.get, testRunId);
      yield put(RunnerActions.updateTestRunSucceeded(testRunId, testRun));
    } catch (error) {
      yield put(RunnerActions.updateTestRunFailed(error));
    }
  }
  if (shouldFetchTestRun) {
    yield put(RunnerActions.uploadTestRunLogsRequested(testRunId));
  }
  yield put(RunnerActions.stopSucceeded(testRunId, status));
  logger.debug('[stopRequested] init disconnecting debugger from all tabs');
  yield call(browser.devTools.disconnectAll);
  logger.debug('[stopRequested] disconnecting debugger from all tabs finished');
  yield call(WebRequests.reset);
}

export function* stopAllRequested({ status = STATUS.STOPPED, shouldFetchTestRun }) {
  const testRunIds = yield select(selectTestRunIds);

  for (let n = 0; n < testRunIds.length; n += 1) {
    const testRunId = testRunIds[n];
    yield call(stopRequested, { testRunId, status, shouldFetchTestRun });
  }
}

export function* stopTestOnTabClosedRequested({ testRunId }) {
  const lastRunningStep = yield select(selectLastRunningStep);
  const stepStatus = yield select(selectStepRunningStatus(testRunId, lastRunningStep.id));

  if (lastRunningStep.type !== STEP_TYPE.CLOSE_TAB) {
    const tabClosedError = new exceptions.TabClosed({
      timeout: false,
      forceFailed: true,
    });

    if (stepStatus !== STATUS.RUNNING) {
      yield put(RunnerActions.stopSucceeded(testRunId, STATUS.STOPPED, tabClosedError.params));
    } else {
      yield put(
        RunnerActions.updateStepRunStatusRequested(
          testRunId,
          lastRunningStep.id,
          STATUS.STOPPED,
          tabClosedError.params,
        ),
      );
    }
  }
}

export function* updateStepRunStatusRequested({
  testRunId,
  stepId,
  status,
  changeInfo = {},
  predefinedTask = {},
}) {
  const testRun = yield select(selectTestRun(testRunId));

  // FIXME: is it really necessary this predefinedTask?
  const testId = testRun.testId || predefinedTask.testId;
  const currentStepRunResult = yield select(selectStepRunningResult(testRunId, stepId));
  const newResult = helpers.mergeStepRunResult(currentStepRunResult, changeInfo);

  const result = {
    ...newResult,
    conditionsState: values(newResult.conditionsState),
  };

  const data = {
    testRunId,
    stepId,
    status,
    testId,
    result,
  };

  if (!data.testId) {
    yield put(
      CoreActions.captureExceptionAsWarning(
        serializeError(new exceptions.InvalidRequestParams(['testId'])),
      ),
    );
  }

  yield put(WebsocketActions.sendRequested(RunnerTypes.UPDATE_STEP_RUN_STATUS_REQUESTED, data));
  yield put(RunnerActions.updateStepRunStatusSucceeded(testRunId, stepId, status, newResult));
}

export function* updateStepRunResultRequested({ testRunId, stepId, changeInfo }) {
  const { testId } = yield select(selectTestRun(testRunId));
  const currentStepRunResult = yield select(selectStepRunningResult(testRunId, stepId));
  const executionUrl = yield select(selectExecutionUrlForTestRunId(testRunId));
  const newResult = helpers.mergeStepRunResult(currentStepRunResult, changeInfo);
  const result = {
    ...newResult,
    executionUrl,
    conditionsState: values(newResult.conditionsState),
  };

  if (equals(currentStepRunResult, newResult)) {
    return;
  }

  const data = {
    testRunId,
    stepId,
    testId,
    result,
  };

  if (!data.testId) {
    yield put(
      CoreActions.captureExceptionAsWarning(
        serializeError(new exceptions.InvalidRequestParams(['testId'])),
      ),
    );
  }

  yield put(
    WebsocketActions.sendUpdateStepRunResultRequested(
      RunnerTypes.UPDATE_STEP_RUN_RESULT_REQUESTED,
      data,
    ),
  );
  yield put(RunnerActions.updateStepRunResultSucceeded(testRunId, stepId, newResult, testId));
}

export function* pageNavigationCommitted({ testRunId }) {
  /*
    Page navigation handling is splitted into two parts:
      - listening for navigation changes: helpers.waitForPageNavigationIfNeeded
      - updating run status on navigation changes: RunnerActions.pageNavigationCommitted

    A reason for this approach is an issue when the page navigation is committed
    just after interaction (e.g "click") but before the listening process starts.
    It happens very often on SPA's.
  */
  const lastRunningStep = yield select(selectLastRunningStep);
  if (!lastRunningStep) {
    return;
  }

  const stepRunResult = yield select(selectStepRunningResult(testRunId, lastRunningStep.id));
  const waitForPageNavigation = yield call(
    helpers.hasPageNavigationWaitingCondition,
    lastRunningStep,
  );

  if (
    !waitForPageNavigation ||
    stepRunResult.status !== STATUS.RUNNING ||
    !stepRunResult.elementConditionsSuccess
  ) {
    return;
  }

  yield put(
    RunnerActions.updateStepRunResultRequested(testRunId, lastRunningStep.id, {
      conditionsState: {
        [WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION]: {
          type: WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION,
          isSuccess: true,
          expected: convertBoolToString(true),
          current: convertBoolToString(true),
        },
      },
    }),
  );
}

export function* uploadTestRunLogsRequested({ testRunId }) {
  try {
    const logs = yield call(Logger.getStoredLogs);

    const data = {
      logs,
    };
    yield call(Logger.resetLogs);

    const { timeout } = yield race({
      finished: call(api.logs.uploadTestRunLogs, testRunId, data),
      timeout: delay(LOGS_UPLOAD_TIMEOUT),
    });
    if (timeout) {
      yield put(RunnerActions.uploadTestRunLogsFailed());
      throw new exceptions.LogsUploadTimeout();
    }
    yield put(RunnerActions.uploadTestRunLogsSucceeded());
  } catch (error) {
    yield put(CoreActions.captureExceptionAsWarning(serializeError(error)));
    yield put(RunnerActions.uploadTestRunLogsFailed());
  }
}

export function* updateStepScreenshotRequested({ testRunId, stepId, screenshot }) {
  try {
    if (!screenshot) {
      throw new exceptions.MissingElementScreenshot(chrome.runtime.lastError);
    }
    const { testId } = yield select(selectTestRun(testRunId));

    const { uploadContext } = yield select(selectRunningTestRun);

    const { timeout, screenshotUploadUrl } = yield race({
      screenshotUploadUrl: call(api.screenshots.updateRunScreenshot, {
        uploadContext,
        screenshotType: 'step',
        file: screenshot,
      }),
      timeout: delay(SCREENSHOT_UPLOAD_TIMEOUT),
    });
    if (timeout) {
      yield put(RunnerActions.updateStepScreenshotFailed());
    } else {
      yield put(
        WebsocketActions.sendRequested(RunnerTypes.UPDATE_STEP_SCREENSHOT_REQUESTED, {
          testRunId,
          stepId,
          testId,
          screenshotUploadUrl,
        }),
      );

      yield put(RunnerActions.updateStepScreenshotSucceeded());
    }
  } catch (error) {
    if (!screenshot) {
      yield put(CoreActions.captureExceptionAsWarning(serializeError(error)));
    }
    yield put(RunnerActions.updateStepScreenshotFailed());
  }
}

export function* updateCoveringElementScreenshotRequested({ testRunId, tabId, stepId, rect }) {
  yield call(captureScreenshot.captureTab, tabId, true);
  const coveringElementScreenshot = yield call(captureScreenshot.captureElement, tabId, rect);
  try {
    if (!coveringElementScreenshot) {
      throw new exceptions.MissingElementScreenshot(chrome.runtime.lastError);
    }

    const { uploadContext } = yield select(selectRunningTestRun);

    const { timeout, screenshotUploadUrl } = yield race({
      screenshotUploadUrl: call(api.screenshots.updateRunScreenshot, {
        uploadContext,
        file: coveringElementScreenshot,
        screenshotType: 'stepRunCoverageElement',
      }),
      timeout: delay(SCREENSHOT_UPLOAD_TIMEOUT),
    });

    if (timeout) {
      yield put(RunnerActions.updateCoveringElementScreenshotFailed());
    } else {
      yield put(RunnerActions.updateCoveringElementScreenshotSucceeded());
      yield put(
        WebsocketActions.sendRequested(
          RunnerTypes.UPDATE_STEP_RUN_COVERING_ELEMENT_SCREENSHOT_REQUESTED,
          {
            testRunId,
            tabId,
            stepId,
            screenshotUploadUrl,
          },
        ),
      );
    }
  } catch (error) {
    if (!coveringElementScreenshot) {
      yield put(CoreActions.captureExceptionAsWarning(serializeError(error)));
    }
    yield put(RunnerActions.updateCoveringElementScreenshotFailed());
  }
}

export function* updateStepRunScreenshotRequested({ testRunId, tabId, stepId, screenshot }) {
  if (!screenshot) {
    // eslint-disable-next-line no-param-reassign
    screenshot = yield call(captureScreenshot.captureTab, tabId);
  }

  try {
    if (!screenshot) {
      logger.debug('[updateStepRunScreenshotRequested] Screenshot is missing');
      throw new exceptions.MissingStepScreenshot(chrome.runtime.lastError?.message);
    }

    const { uploadContext } = yield select(selectRunningTestRun);
    const { timeout, screenshotUploadUrl } = yield race({
      screenshotUploadUrl: call(api.screenshots.updateRunScreenshot, {
        uploadContext,
        screenshotType: 'stepRunWindow',
        file: screenshot,
      }),
      timeout: delay(SCREENSHOT_UPLOAD_TIMEOUT),
    });

    if (timeout) {
      logger.debug('[updateStepRunScreenshotRequested] Taking screenshot timeout');
      yield put(RunnerActions.updateStepRunScreenshotFailed());
    } else {
      yield put(RunnerActions.updateStepRunScreenshotSucceeded(testRunId, tabId, stepId));
      yield put(
        WebsocketActions.sendRequested(RunnerTypes.UPDATE_STEP_RUN_SCREENSHOT_REQUESTED, {
          testRunId,
          tabId,
          stepId,
          screenshotUploadUrl,
        }),
      );
    }
  } catch (error) {
    yield put(RunnerActions.updateStepRunScreenshotFailed(error));
  }
}

export function* updateMousePositionRequested({ tabId, x, y }) {
  try {
    yield call(browser.devTools.mouse.move, tabId, x, y);
    yield put(ExtensionActions.updateMousePositionSucceeded(tabId, x, y));
  } catch (error) {
    logger.debug('[updateMousePositionRequested] Exception occurred for (x, y):', x, y);
    logger.error(error);
    yield put(RunnerActions.updateMousePositionFailed(error));
  }
}

export function* runPlainExecutorRequested({ step }) {
  const testRun = yield select(selectRunningTestRun);

  if (testRun) {
    yield call(stepRunners[step.type], {
      step,
      testRunId: testRun.testRunId,
      tabId: testRun.tabContext.currentTabId,
    });
  }
}

export function* disableExternalLogsIfNeeded() {
  yield call(Logger.reset);
}

export function* openPromptRequested({ tabId }) {
  const lastRunningStep = yield select(selectLastRunningStep);

  if (lastRunningStep.type !== STEP_TYPE.ANSWER_PROMPT) {
    logger.debug('[openPromptRequested]', lastRunningStep.type);
    if (lastRunningStep.invokesPrompt) {
      yield put(
        RunnerActions.openPromptSucceeded(tabId, MAIN_FRAME_DATA.frameId, lastRunningStep.id),
      );
    } else {
      const timeoutReason = new exceptions.UnhandledPrompt();
      const testRun = yield select(selectRunningTestRun);
      yield put(
        RunnerActions.updateStepRunResultRequested(testRun.testRunId, lastRunningStep.id, {
          ...timeoutReason.params,
          warning: false,
        }),
      );
      yield put(RunnerActions.setPotentialTimeoutReasonRequested(testRun.testRunId, timeoutReason));
    }
  } else {
    logger.debug('[openPromptRequested] Ignored due to step type.', lastRunningStep.type);
  }
}

export function* closePromptRequested({ tabId, result, userInput }) {
  const lastRunningStep = yield select(selectLastRunningStep);

  if (lastRunningStep.type === STEP_TYPE.ANSWER_PROMPT) {
    logger.debug('[closePromptRequested]', result.toString(), userInput, lastRunningStep.value);
    yield put(
      RunnerActions.closePromptSucceeded(tabId, MAIN_FRAME_DATA.frameId, lastRunningStep.id),
    );
  } else {
    logger.debug('[closePromptRequested] Ignored due to step type.', lastRunningStep.type);
  }
}

export default function* runnerSaga() {
  yield all([
    yield takeLatest(RunnerTypes.START_REQUESTED, startRequested),
    yield takeLatest(RunnerTypes.STOP_REQUESTED, stopRequested),
    yield takeLatest(RunnerTypes.STOP_ALL_REQUESTED, stopAllRequested),
    yield takeLatest(RunnerTypes.STOP_TEST_ON_TAB_CLOSED_REQUESTED, stopTestOnTabClosedRequested),
    yield takeLatest(RunnerTypes.RUN_STEP_REQUESTED, runStepRequested),
    yield takeLatest(RunnerTypes.UPDATE_STEP_RUN_STATUS_REQUESTED, updateStepRunStatusRequested),
    yield takeEvery(RunnerTypes.UPDATE_STEP_RUN_RESULT_REQUESTED, updateStepRunResultRequested),
    yield takeLatest(RunnerTypes.UPDATE_STEP_SCREENSHOT_REQUESTED, updateStepScreenshotRequested),
    yield takeEvery(RunnerTypes.UPLOAD_TEST_RUN_LOGS_REQUESTED, uploadTestRunLogsRequested),
    yield takeLatest(RunnerTypes.OPEN_PROMPT_REQUESTED, openPromptRequested),
    yield takeLatest(RunnerTypes.CLOSE_PROMPT_REQUESTED, closePromptRequested),
    yield takeLatest(
      RunnerTypes.UPDATE_COVERING_ELEMENT_SCREENSHOT_REQUESTED,
      updateCoveringElementScreenshotRequested,
    ),
    yield takeLatest(RunnerTypes.UPDATE_MOUSE_POSITION_REQUESTED, updateMousePositionRequested),
    yield takeEvery(
      RunnerTypes.UPDATE_STEP_RUN_SCREENSHOT_REQUESTED,
      updateStepRunScreenshotRequested,
    ),
    yield takeLatest(RunnerTypes.RUN_PLAIN_EXECUTOR_REQUESTED, runPlainExecutorRequested),
    yield takeEvery(BackgroundTypes.PAGE_NAVIGATION_COMMITTED, pageNavigationCommitted),
    yield takeEvery(RunnerTypes.STOP_SUCCEEDED, disableExternalLogsIfNeeded),
  ]);
}
