import { STATUS } from '~/constants/test';
import { produce } from 'immer';

import { isNil, mergeDeepRight, omit } from 'ramda';
import { createActions, createReducer } from 'reduxsauce';

import {
    SCROLL_TIMEOUT_FACTOR_BIG,
    SCROLL_TIMEOUT_FACTOR_SMALL,
    WAITING_CONDITIONS_TIMEOUT_FACTOR_BIG,
    WAITING_CONDITIONS_TIMEOUT_FACTOR_SMALL,
    MAIN_FRAME_DATA,
} from '~/constants/test';
import { RecorderTypes } from '~/modules/recorder/recorder.redux';

export const { Types: RunnerTypes, Creators: RunnerActions } = createActions(
    {
        updateStepRunCoveringElementScreenshotRequested: [
            'testRunId',
            'tabId',
            'stepId',
            'screenshotUploadUrl',
        ],
        startRequested: [
            'testRunId',
            'testId',
            'project',
            'step',
            'userSettings',
            'variables',
            'screenSizeType',
            'uploadContext',
        ],
        startSucceeded: [
            'testRunId',
            'testId',
            'userId',
            'project',
            'step',
            'userSettings',
            'uploadContext',
        ],
        setTestRunRequested: ['testRunId', 'testId', 'userId', 'project', 'step', 'userSettings'],
        setRunningStepSucceeded: ['testRunId', 'step', 'stepRunId', 'isFirstStep'],
        setRunningStepTimer: ['testRunId', 'startTimestamp', 'timeout', 'sleep'],
        stopAllRequested: ['status', 'shouldFetchTestRun'],
        stopRequested: ['testRunId', 'status', 'shouldFetchTestRun'],
        stopSucceeded: ['testRunId', 'status', 'error'],
        updateTestRunSucceeded: ['testRunId', 'testRun'],
        uploadTestRunLogsRequested: ['testRunId'],
        uploadTestRunLogsFailed: [],
        uploadTestRunLogsSucceeded: [],
        updateTestRunFailed: ['testRunId', 'testRun'],
        stopFailed: ['error'],
        stopTestOnTabClosedRequested: ['testRunId', 'stepId'],
        stopTestOnDebuggerDetachedRequested: [],
        stopTestOnWindowMinimizedRequested: [],
        updateStepRunStatusRequested: ['testRunId', 'stepId', 'status', 'changeInfo', 'predefinedTask'],
        updateStepRunStatusSucceeded: ['testRunId', 'stepId', 'status', 'result'],
        updateStepScreenshotRequested: ['testRunId', 'stepId', 'screenshot'],
        updateStepScreenshotSucceeded: [],
        updateStepScreenshotFailed: [],
        updateStepRunScreenshotRequested: ['testRunId', 'tabId', 'stepId', 'screenshot'],
        updateStepRunScreenshotSucceeded: ['testRunId', 'tabId', 'stepId', 'screenshotUploadUrl'],
        updateStepRunScreenshotFailed: ['error'],
        updateCoveringElementScreenshotRequested: ['testRunId', 'tabId', 'stepId', 'rect'],
        updateCoveringElementScreenshotSucceeded: ['screenshotUploadUrl'],
        updateCoveringElementScreenshotFailed: ['error'],
        runStepRequested: ['step', 'stepRunId', 'testRunId', 'testId', 'variables', 'isFirstStep'],
        runStepSucceeded: [],
        updateStepRunResultRequested: ['testRunId', 'stepId', 'changeInfo'],
        updateStepRunResultSucceeded: ['testRunId', 'stepId', 'result', 'testId'],
        setPotentialTimeoutReasonRequested: ['testRunId', 'reason'],
        updateCurrentTabContextExecutionUrl: ['testRunId', 'executionUrl'],
        updateCurrentTabContextSucceeded: ['testRunId', 'tabId', 'frameId'],
        updateMousePositionRequested: ['tabId', 'x', 'y'],
        updateMousePositionFailed: ['error'],
        runPlainExecutorRequested: ['step'],
        openPromptRequested: ['tabId'],
        openPromptSucceeded: ['tabId', 'frameId', 'stepId'],
        closePromptRequested: ['tabId', 'result', 'userInput'],
        closePromptSucceeded: ['tabId', 'frameId', 'stepId'],
        resetRequested: [],
    },
    { prefix: 'RUNNER/' },
);

export const INITIAL_STATE = {
    isStopping: false,
    lastTestRunEndTime: Date.now(),
    testRuns: {},
};

const setRunningStepSucceeded = (state, { testRunId, step, stepRunId, isFirstStep }) =>
    produce(state, (draftState) => {
        if (draftState.testRuns[testRunId]) {
            draftState.testRuns[testRunId].prevRunningStep =
                draftState.testRuns[testRunId].lastRunningStep;
            draftState.testRuns[testRunId].lastRunningStep = { ...step, stepRunId };
            draftState.testRuns[testRunId].isFirstStep = isFirstStep;
            draftState.testRuns[testRunId].lastRunningStepTimer = {};
        }
    });

const setRunningStepTimer = (state, { testRunId, startTimestamp, timeout, sleep }) =>
    produce(state, (draftState) => {
        if (draftState.testRuns[testRunId]) {
            const timeoutMs = timeout * 1000;
            const sleepMs = sleep * 1000;
            const conditionsTimeoutFactor =
                timeout <= 10
                    ? WAITING_CONDITIONS_TIMEOUT_FACTOR_BIG
                    : WAITING_CONDITIONS_TIMEOUT_FACTOR_SMALL;
            const scrollTimeoutFactor =
                timeout <= 10 ? SCROLL_TIMEOUT_FACTOR_SMALL : SCROLL_TIMEOUT_FACTOR_BIG;
            const conditionsTimeout = timeoutMs * conditionsTimeoutFactor;

            const delayedStartTimestamp = sleepMs + startTimestamp;

            draftState.testRuns[testRunId].lastRunningStepTimer = {
                sleep: sleepMs,
                start: delayedStartTimestamp,
                conditionsEnd: delayedStartTimestamp + conditionsTimeout,
                end: delayedStartTimestamp + timeoutMs,
                conditionsTimeout,
                scrollTimeout: timeoutMs * scrollTimeoutFactor,
            };
        }
    });

const stopRequested = (state) =>
    produce(state, (draftState) => {
        draftState.isStopping = true;
    });

const setTestRunRequested = (state, actionData) => {
    const {
        testRunId,
        project,
        testId,
        userId,
        step = null,
        externalLoggingEnabled = false,
    } = actionData;
    return produce(state, (draftState) => {
        draftState.testRuns[testRunId] = {
            projectId: project.id,
            testRunId,
            testId,
            userId,
            status: null,
            prevRunningStep: null,
            lastRunningStep: step,
            potentialTimeoutReason: null,
            error: null,
            externalLoggingEnabled,
            tabContext: {
                executionUrl: undefined,
                currentTabId: undefined,
                currentFrameId: MAIN_FRAME_DATA.frameId,
            },
        };
    });
};

const startSucceeded = (state, actionData) => {
    const {
        testRunId,
        project,
        testId,
        userId,
        uploadContext,
        step = null,
        externalLoggingEnabled = false,
    } = actionData;
    return produce(state, (draftState) => {
        draftState.testRuns[testRunId] = {
            startTime: Date.now(),
            projectId: project.id,
            uploadContext,
            testRunId,
            testId,
            userId,
            status: STATUS.RUNNING,
            prevRunningStep: null,
            lastRunningStep: step,
            potentialTimeoutReason: null,
            error: null,
            externalLoggingEnabled,
            tabContext: {
                executionUrl: undefined,
                currentTabId: undefined,
                currentFrameId: MAIN_FRAME_DATA.frameId,
            },
        };
    });
};

const stopSucceeded = (state, { testRunId, status = STATUS.STOPPED, error }) =>
    produce(state, (draftState) => {
        draftState.isStopping = false;
        draftState.lastTestRunEndTime = Date.now();
        if (draftState.testRuns[testRunId]) {
            draftState.testRuns[testRunId].status = status;

            if (!isNil(error)) {
                draftState.testRuns[testRunId].error = error;
            }
        }
    });

const updateCurrentTabContextSucceeded = (state, { testRunId, tabId, frameId = 0 }) =>
    produce(state, (draftState) => {
        if (draftState.testRuns[testRunId]) {
            draftState.testRuns[testRunId].tabContext.currentFrameId = frameId;
            draftState.testRuns[testRunId].tabContext.currentTabId = tabId;
        }
    });

const updateCurrentTabContextExecutionUrl = (state, { testRunId, executionUrl }) =>
    produce(state, (draftState) => {
        if (draftState.testRuns[testRunId]) {
            draftState.testRuns[testRunId].tabContext.executionUrl = executionUrl;
        }
    });

const setPotentialTimeoutReasonRequested = (state, { testRunId, reason }) =>
    produce(state, (draftState) => {
        if (draftState.testRuns[testRunId]) {
            draftState.testRuns[testRunId].potentialTimeoutReason = reason;
        }
    });

const updateTestRunSucceeded = (state, { testRunId, testRun }) =>
    produce(state, (draftState) => {
        if (draftState.testRuns[testRunId]) {
            draftState.testRuns[testRunId] = mergeDeepRight(draftState.testRuns[testRunId], testRun);
        }
    });

const resetTestRun = (state, { testRunId }) =>
    produce(state, (draftState) => {
        draftState.testRuns = omit([testRunId], draftState.testRuns);
    });

export const reducer = createReducer(INITIAL_STATE, {
    [RunnerTypes.START_SUCCEEDED]: startSucceeded,
    [RunnerTypes.STOP_REQUESTED]: stopRequested,
    [RunnerTypes.STOP_TEST_ON_DEBUGGER_DETACHED_REQUESTED]: stopRequested,
    [RunnerTypes.STOP_SUCCEEDED]: stopSucceeded,
    [RunnerTypes.SET_TEST_RUN_REQUESTED]: setTestRunRequested,
    [RunnerTypes.SET_RUNNING_STEP_SUCCEEDED]: setRunningStepSucceeded,
    [RunnerTypes.UPDATE_CURRENT_TAB_CONTEXT_SUCCEEDED]: updateCurrentTabContextSucceeded,
    [RunnerTypes.UPDATE_CURRENT_TAB_CONTEXT_EXECUTION_URL]: updateCurrentTabContextExecutionUrl,
    [RunnerTypes.SET_POTENTIAL_TIMEOUT_REASON_REQUESTED]: setPotentialTimeoutReasonRequested,
    [RunnerTypes.SET_RUNNING_STEP_TIMER]: setRunningStepTimer,
    [RunnerTypes.UPDATE_TEST_RUN_SUCCEEDED]: updateTestRunSucceeded,
    [RecorderTypes.START_SUCCEEDED]: resetTestRun,
});
