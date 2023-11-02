import debounce from 'lodash.debounce';
import { remove } from 'ramda';

import { CoreActions } from '~/modules/core';
import { selectIsTabDebuggerDetachedByUser } from '~/modules/extension/extension.selectors';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import * as exceptions from '~/modules/runner/runner.exceptions';
import { RunnerActions } from '~/modules/runner/runner.redux';
import {
  selectRunningTestRunTabContext,
  selectHasRunningTestRun,
  selectIsStopping,
} from '~/modules/runner/runner.selectors';
import storeRegistry, { STORE_TYPES } from '~/modules/storeRegistry';
import Logger from '~/services/logger';
import runtimeMessaging from '~/services/runtimeMessaging';
import i18n from '~/translations';

export const CHROME_ERROR = {
  FRAME_WAS_REMOVED_LEGACY: 'The frame was removed',
  FRAME_WAS_REMOVED: 'Frame with ID',
  NO_FRAME_WITH_ID: 'No frame with id',
  CANNOT_ACCESS_CHROME_URL: 'Cannot access a chrome:// URL',
  NO_TAB_WITH_ID: 'No tab with',
  NO_WINDOW_WITH_ID: 'No window with',
  NO_CURRENT_WINDOW: 'No current window',
  TAB_WAS_CLOSED: 'The tab was closed',
  DEBUGGER_IS_NOT_ATTACHED: 'Debugger is not attached',
  ANOTHER_DEBUGGER_IS_ATTACHED: 'Another debugger is already attached',
  DEBUGGER_DETACHED: 'Detached while handling',
  TABS_CANNOT_BE_QUERIED: 'Tabs cannot be queried right now',
  CANNOT_ACCESS_CHROME_EXT: 'Cannot access a chrome-extension://',
  CANNOT_ACCESS_ABOUT: 'Cannot access &quot;about:',
  CANNOT_ACCESS_CONTENTS: 'Cannot access contents of url',
  CANNOT_FIND_CONTEXT_ID: 'Cannot find context with specified id',
  CANNOT_ATTACH_TARGET: 'Cannot attach to this target',
  INTERNAL_ERROR: 'Internal error',
  INVALID_BOUNDS: 'Invalid value for bounds',
  NO_DIALOG_IS_SHOWING: 'No dialog is showing',
  NO_ACTIVE_PORT: 'Could not establish connection. Receiving end does not exist',
  QUOTA_BYTES_EXCEEDED: 'QUOTA_BYTES quota exceeded',
};

export const PAGE_LOADING_ERROR_CODE = {
  ERR_CONNECTION_TIMED_OUT: 'ERR_CONNECTION_TIMED_OUT',
};

const logger = Logger.get('Errors');

const getStore = (isBackgroundContext = true) => {
  if (isBackgroundContext) {
    const store = storeRegistry.get(STORE_TYPES.BACKGROUND);
    return store;
  }

  const store = storeRegistry.get(STORE_TYPES.CONTENT);
  return {
    getState: store.getState,
    dispatch: runtimeMessaging.dispatchActionInBackground,
  };
};

export const isContentAccessError = (error) => {
  const expectedErrors = [CHROME_ERROR.CANNOT_ACCESS_CONTENTS, CHROME_ERROR.CANNOT_ACCESS_ABOUT];
  return expectedErrors.some((expectedError) => error.message?.includes?.(expectedError));
};

export const isDebuggerDetachedError = (error) => {
  const expectedErrors = [CHROME_ERROR.DEBUGGER_DETACHED, CHROME_ERROR.DEBUGGER_IS_NOT_ATTACHED];
  return expectedErrors.some((expectedError) => error.message?.includes?.(expectedError));
};

export const deserializeError = (error) => {
  const parsedError = JSON.parse(error);
  return parsedError.params
    ? Object.assign(new exceptions.RuntimeError(), parsedError)
    : new exceptions.RuntimeError(parsedError.message ? parsedError : { message: parsedError });
};

export const serializeError = (error) =>
  JSON.stringify(error, exceptions.SERIALIZABLE_ERROR_FIELDS);

export const captureException = (sourceError, isBackgroundContext = true, lastAction) => {
  const { dispatch } = getStore(isBackgroundContext);
  dispatch(CoreActions.captureException(serializeError(sourceError), lastAction));
};

export const captureExceptionAsWarning = debounce(
  (sourceError, details, isBackgroundContext = true) => {
    const { dispatch } = getStore(isBackgroundContext);
    dispatch(CoreActions.captureExceptionAsWarning(serializeError(sourceError), details));
  },
  1000,
  { leading: true, trailing: false },
);

export const hasExpectedChromeErrorOccurred = (expectedErrorMessages, lastRuntimeError) => {
  // eslint-disable-next-line no-param-reassign
  lastRuntimeError = lastRuntimeError ?? chrome.runtime.lastError;
  if (!lastRuntimeError) {
    return false;
  }
  const { message } = lastRuntimeError;
  return expectedErrorMessages.some((errorString) => message.includes(errorString));
};

export const getBaseExtensionAPIError = () => {
  const message = i18n.t(
    'exceptions.chromeError.defaultMessage',
    'An error occurred during browser API call. {{ message }}',
    { message: chrome.runtime.lastError.message },
  );
  return new Error(message);
};

const throwLastChromeErrorIfNeeded = (
  ignoredErrors,
  sourceStack,
  isBackgroundContext,
  lastRuntimeError,
) => {
  // eslint-disable-next-line no-param-reassign
  lastRuntimeError = lastRuntimeError ?? chrome.runtime.lastError;
  if (lastRuntimeError && !hasExpectedChromeErrorOccurred(ignoredErrors, lastRuntimeError)) {
    const { message: srcMessage } = lastRuntimeError;

    if (isDebuggerDetachedError(lastRuntimeError)) {
      const { dispatch, getState } = getStore(isBackgroundContext);
      const state = getState();
      const tabContext = selectRunningTestRunTabContext(state);
      const isDebuggerDetachedByUser = selectIsTabDebuggerDetachedByUser(tabContext?.currentTabId)(
        state,
      );

      logger.debug('Debugger detached by user', isDebuggerDetachedByUser);
      if (isDebuggerDetachedByUser) {
        dispatch(RunnerActions.stopTestOnDebuggerDetachedRequested());
        return;
      }

      const isRunning = selectHasRunningTestRun(state);
      const isRecording = selectIsRecording(state);
      const isStopping = selectIsStopping(state);
      if ((!isRunning && !isRecording) || isStopping) {
        return;
      }
    }

    const error = getBaseExtensionAPIError();
    logger.debug(
      `Catched error: ${srcMessage}\n`,
      `But missing in the list of expected errors: \n${
        ignoredErrors.length ? ignoredErrors.join(', ') : '<empty>'
      }`,
    );

    error.stack = remove(1, 1, sourceStack.split('\n')).join('\n');
    throw error;
  }
};

export const catchUnexpectedErrors = (callback = Function.prototype, options = {}) => {
  const sourceStack = Error().stack;
  // eslint-disable-next-line consistent-return
  return (...args) => {
    const isBackgroundContext = options.isBackgroundContext ?? true;
    const ignoredErrors = options.ignoredErrors ?? [];

    try {
      const lastRuntimeError = chrome.runtime.lastError;
      throwLastChromeErrorIfNeeded(
        ignoredErrors,
        sourceStack,
        isBackgroundContext,
        lastRuntimeError,
      );

      if (callback) {
        callback(...args);
      }
    } catch (error) {
      if (isContentAccessError(error)) {
        captureExceptionAsWarning(
          error,
          {
            callbackArgs: args,
          },
          isBackgroundContext,
        );

        if (options.onWarning) {
          options.onWarning(error);
          return;
        }

        if (callback) {
          callback(...args);
        }
        return;
      }

      if (options.onError) {
        options.onError(error);
      }
      captureException(error, isBackgroundContext);
    }
  };
};

export const handleStepExecutorException = (
  sourceError,
  id,
  createFailureAction = Function.prototype,
) => {
  const isHandledException = sourceError instanceof exceptions.RunnerError;

  if (isHandledException) {
    runtimeMessaging.dispatchActionInBackground(createFailureAction(id, sourceError));
    logger.error(sourceError);
  } else {
    throw sourceError;
  }
};

export const crashReporter = () => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    captureException(error, true, action);
    error.isHandled = true;
    throw error;
  }
};
