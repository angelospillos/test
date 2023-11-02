import { produce } from 'immer';
import { omit, without } from 'ramda';
import { createActions, createReducer } from 'reduxsauce';

import { RECORDING_MODE } from '~/constants/test';

import { DEFAULT_CONTEXT } from './recorder.constants';

export const { Types: RecorderTypes, Creators: RecorderActions } = createActions(
  {
    addEventRequested: ['eventData', 'sync', 'meta'],
    addEventSucceeded: ['eventData', 'diff', 'meta'],
    addEventFailure: ['error', 'meta'],
    startRequested: ['project', 'test', 'windowId', 'userId', 'userSettings', 'url', 'variables'],
    startSucceeded: ['project', 'test', 'userId', 'testRunId', 'isInitial', 'userSettings'],
    stopRequested: ['viaContentMenu'],
    stopSucceeded: [],
    stopFailure: [],
    startToClipboardRequested: ['testId', 'windowId'],
    startToClipboardSucceeded: [],
    startToClipboardFailure: [],
    stopToClipboardRequested: ['testId'],
    stopToClipboardSucceeded: [],
    stopToClipboardFailure: ['error'],
    updateStepScreenshotRequested: ['testId', 'stepId', 'screenshot'],
    updateStepScreenshotSucceeded: ['stepId', 'screenshot'],
    updateStepScreenshotFailed: [],
    modeSwitched: ['mode', 'multiple'],
    setIsSavingSucceeded: ['isSaving'],
    removeStepsByIdsSucceeded: ['ids'],
    changeStepsRequested: ['result'],
    changeStepsSucceeded: ['deltaId', 'diff', 'stepsAdded', 'stepsModified', 'tabContext'],
    changeStepsFailure: [],
    changeStepsStarted: ['deltaId'],
    copyContextFromRunnerRequested: ['testRun'],
    copyContextFromRunnerSucceeded: ['tabContext', 'steps', 'stepsOrder'],
    lockNativeMouseInteractionsRequested: [],
    unlockNativeMouseInteractionsRequested: [],
    openNewTabWithUrlFailed: ['error'],
    openNewTabWithUrlRequested: ['windowId', 'url'],
    openNewTabWithUrlSucceeded: [],
    getVariablesListFailure: ['error'],
    getVariablesListRequested: [],
    getVariablesListSucceeded: ['variables'],
    addVariableToListRequested: ['variable'],
    addVariableToListSucceeded: ['variable'],
    addVariableToListFailure: ['error'],
    setPendingLocalVariableEventSucceeded: ['event'],
    resetRequested: [],
  },
  { prefix: 'RECORDER/' },
);

const INITIAL_STATE = {
  groupSequence: 0,
  processing: [],
  cachedScreenshots: {},
  test: undefined,
  project: undefined,
  isRecording: false,
  isClipboard: false,
  isInitial: true,
  isSaving: false,
  mode: RECORDING_MODE.EVENT,
  log: [],
  steps: {},
  stepsOrder: [],
  stepsNumber: 0,
  tabContext: DEFAULT_CONTEXT,
  pendingLocalVariable: null,
  variables: {},
};

const startSucceeded = (state, { test, userId, testRunId, project, isInitial = true }) =>
  produce(state, (draftState) => {
    draftState.groupSequence = 0;
    draftState.test = {
      ...(draftState.test || {}),
      ...(test || {}),
    };
    draftState.testId = test.id;
    draftState.userId = userId;
    draftState.testRunId = testRunId;
    draftState.project = project;
    draftState.isRecording = true;
    draftState.processing = [];
    draftState.log = [];
    draftState.tabContext = draftState.tabContext || DEFAULT_CONTEXT;
    draftState.isInitial = isInitial;
  });

const stopSucceeded = (state) =>
  produce(state, (draftState) => {
    draftState.isRecording = false;
  });

const modeSwitched = (state, { mode, multiple = false }) =>
  produce(state, (draftState) => {
    draftState.mode = mode;
    draftState.multipleMode = multiple;
  });

const addEventSucceeded = (state) =>
  produce(state, (draftState) => {
    draftState.isInitial = false;

    /*
      Uncomment to see real events recording path

      Add this as second reducer's argument: { eventData }

      const { frontId, type, timestamp, xpath } = eventData;
      const extendedNewLogRecord = {
        frontId,
        type,
        timestamp,
        xpath,
        details: eventData,
      };
      draftState.log.push(extendedNewLogRecord);
    */
  });

const removeStepsByIdsSucceeded = (state, { ids }) =>
  produce(state, (draftState) => {
    draftState.log = draftState.log.filter((event) => !ids.includes(event.frontId));
    draftState.steps = omit(ids, draftState.steps);
    draftState.stepsOrder = without(ids, draftState.stepsOrder);
    draftState.stepsNumber = draftState.stepsOrder.length;
  });

const changeStepsStarted = (state, { deltaId }) =>
  produce(state, (draftState) => {
    draftState.processing.push(deltaId);
  });

const startToClipboardSucceeded = (state) =>
  produce(state, (draftState) => {
    draftState.isClipboard = true;
  });

const stopToClipboardSucceeded = (state) =>
  produce(state, (draftState) => {
    draftState.isClipboard = false;
  });

const setIsSavingSucceeded = (state, { isSaving }) =>
  produce(state, (draftState) => {
    draftState.isSaving = isSaving;
  });

const setPendingLocalVariableEventSucceeded = (state, { event }) =>
  produce(state, (draftState) => {
    draftState.pendingLocalVariableEvent = event;
  });

const changeStepsSucceeded = (state, { deltaId, diff, stepsAdded, stepsModified, tabContext }) =>
  produce(state, (draftState) => {
    draftState.stepsOrder = without(diff.removed, draftState.stepsOrder);
    draftState.steps = omit(diff.removed, draftState.steps);

    draftState.stepsOrder = [...draftState.stepsOrder, ...diff.added];
    draftState.steps = {
      ...draftState.steps,
      ...stepsAdded,
      ...stepsModified,
    };
    draftState.tabContext = tabContext;
    draftState.processing = without([deltaId], state.processing);
    draftState.stepsNumber = draftState.stepsOrder.length;
  });

const updateStepScreenshotSucceeded = (state, { stepId, screenshot }) =>
  produce(state, (draftState) => {
    draftState.cachedScreenshots[stepId] = screenshot;
  });

const copyContextFromRunnerSucceeded = (
  state,
  { tabContext = DEFAULT_CONTEXT, steps = {}, stepsOrder = [] },
) =>
  produce(state, (draftState) => {
    draftState.tabContext = { ...DEFAULT_CONTEXT, ...tabContext };
    draftState.steps = steps;
    draftState.stepsOrder = stepsOrder;
  });

const getVariablesListSucceeded = (state, { variables }) =>
  produce(state, (draft) => {
    draft.variables = { ...draft.variables, ...variables };
  });

const addVariableToListSucceeded = (state, { variable }) =>
  produce(state, (draft) => {
    draft.variables[variable.name] = variable;
  });

export const reducer = createReducer(INITIAL_STATE, {
  [RecorderTypes.START_SUCCEEDED]: startSucceeded,
  [RecorderTypes.STOP_SUCCEEDED]: stopSucceeded,
  [RecorderTypes.MODE_SWITCHED]: modeSwitched,
  [RecorderTypes.ADD_EVENT_SUCCEEDED]: addEventSucceeded,
  [RecorderTypes.CHANGE_STEPS_STARTED]: changeStepsStarted,
  [RecorderTypes.START_TO_CLIPBOARD_SUCCEEDED]: startToClipboardSucceeded,
  [RecorderTypes.STOP_TO_CLIPBOARD_SUCCEEDED]: stopToClipboardSucceeded,
  [RecorderTypes.SET_IS_SAVING_SUCCEEDED]: setIsSavingSucceeded,
  [RecorderTypes.CHANGE_STEPS_SUCCEEDED]: changeStepsSucceeded,
  [RecorderTypes.REMOVE_STEPS_BY_IDS_SUCCEEDED]: removeStepsByIdsSucceeded,
  [RecorderTypes.UPDATE_STEP_SCREENSHOT_SUCCEEDED]: updateStepScreenshotSucceeded,
  [RecorderTypes.COPY_CONTEXT_FROM_RUNNER_SUCCEEDED]: copyContextFromRunnerSucceeded,
  [RecorderTypes.SET_PENDING_LOCAL_VARIABLE_EVENT_SUCCEEDED]: setPendingLocalVariableEventSucceeded,
  [RecorderTypes.GET_VARIABLES_LIST_SUCCEEDED]: getVariablesListSucceeded,
  [RecorderTypes.ADD_VARIABLE_TO_LIST_SUCCEEDED]: addVariableToListSucceeded,
});
