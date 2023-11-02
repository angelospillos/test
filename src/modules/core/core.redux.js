import { createActions, createReducer } from 'reduxsauce';

export const { Types: CoreTypes, Creators: CoreActions } = createActions(
  {
    startHeartbeatRequested: [],
    stopHeartbeatRequested: [],
    ping: [],
    pong: [],
    error: ['errorCode'],
    captureException: ['sourceError', 'lastAction', 'details'],
    captureExceptionAsWarning: ['sourceError', 'details'],
    setupSessionRequested: [
      'testRunId',
      'userId',
      'project',
      'screenSizeType',
      'isRunAndRecordSession',
    ],
    setupSessionSucceeded: [],
    setupSessionFailure: [],
    clearPreviousSessionRequested: ['project', 'isRunAndRecordSession'],
    clearPreviousSessionSucceeded: [],
    clearPreviousSessionFailure: ['error'],
    dumpExtensionState: ['title'],
  },
  { prefix: 'CORE/' },
);

export const INITIAL_STATE = {};

export const reducer = createReducer(INITIAL_STATE, {});
