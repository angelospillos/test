import { without } from 'ramda';

import storage from '~/services/browser/storage';
import {
  captureExceptionAsWarning,
  catchUnexpectedErrors,
  CHROME_ERROR,
  getBaseExtensionAPIError,
  hasExpectedChromeErrorOccurred,
} from '~/utils/errors';

import BaseService from '../baseService';

export default class Debugger extends BaseService {
  constructor(client) {
    super('Debugger');
    this.client = client;
    this.protocolListeners = {};
    this.initProtocolListeners();
  }

  enableCommandsErrors = () => storage.set('areCommandsErrorsDisabled', false);

  disableCommandsErrors = () => storage.set('areCommandsErrorsDisabled', true);

  areCommandsErrorsDisabled = () => storage.get('areCommandsErrorsDisabled');

  logLastCommand = (target, method, params) => {
    this.logInfo('Last debugger command:', JSON.stringify(target), method, JSON.stringify(params));
  };

  #resolve = (onResolve, onReject, target, method, params, isFirstAttempt) => async (data) => {
    const lastRuntimeError = chrome.runtime.lastError;
    if (
      hasExpectedChromeErrorOccurred(
        [
          CHROME_ERROR.CANNOT_ACCESS_CHROME_EXT,
          CHROME_ERROR.CANNOT_FIND_CONTEXT_ID,
          CHROME_ERROR.INTERNAL_ERROR,
        ],
        lastRuntimeError,
      )
    ) {
      this.logLastCommand(target, method, params);
      captureExceptionAsWarning(getBaseExtensionAPIError());
    }

    if (
      isFirstAttempt &&
      hasExpectedChromeErrorOccurred([CHROME_ERROR.INTERNAL_ERROR], lastRuntimeError)
    ) {
      try {
        // eslint-disable-next-line no-param-reassign
        data = await this.sendCommand(target, method, params, false);
      } catch (error) {
        onReject(error);
      }
    }

    onResolve(data);
  };

  #reject =
    (onResolve, onReject, target, method, params) =>
    async (...args) => {
      this.logLastCommand(target, method, params);
      if (await this.areCommandsErrorsDisabled()) {
        onResolve({});
      } else {
        onReject(...args);
      }
    };

  sendCommand = (target, method, params, isFirstAttempt = true, ignoredErrors = []) =>
    new Promise((resolve, reject) => {
      this.logVerbose('sendCommand', method, params);
      chrome.debugger.sendCommand(
        target,
        method,
        params,
        catchUnexpectedErrors(
          this.#resolve(resolve, reject, target, method, params, isFirstAttempt),
          {
            onError: this.#reject(resolve, reject, target, method, params),
            ignoredErrors: [
              CHROME_ERROR.DEBUGGER_DETACHED,
              CHROME_ERROR.CANNOT_ACCESS_CHROME_EXT,
              CHROME_ERROR.NO_TAB_WITH_ID,
              CHROME_ERROR.CANNOT_FIND_CONTEXT_ID,
              CHROME_ERROR.INTERNAL_ERROR,
              ...ignoredErrors,
            ],
          },
        ),
      );
    });

  initProtocolListeners = () => {
    chrome.debugger.onEvent.addListener((source, method, params) => {
      // eslint-disable-next-line no-unused-expressions
      this.protocolListeners[method]?.forEach((handleEvent) => {
        handleEvent(params, source);
      });
    });
  };

  attach = (target, requiredVersion) =>
    new Promise((resolve, reject) => {
      this.logVerbose('attach', target);
      chrome.debugger.attach(
        target,
        requiredVersion,
        catchUnexpectedErrors(resolve, {
          onError: reject,
          ignoredErrors: [CHROME_ERROR.CANNOT_ACCESS_CHROME_EXT],
        }),
      );
    });

  detach = (target) =>
    new Promise((resolve, reject) => {
      const onResolve = (...args) => {
        this.logDebug('Detach succeeded', target);
        return resolve(...args);
      };
      const onReject = (error) => {
        this.logDebug('Detach failed');
        reject(error);
      };

      chrome.debugger.detach(
        target,
        catchUnexpectedErrors(this.#resolve(onResolve), {
          onError: onReject,
          ignoredErrors: [
            CHROME_ERROR.NO_TAB_WITH_ID,
            CHROME_ERROR.TAB_WAS_CLOSED,
            CHROME_ERROR.DEBUGGER_IS_NOT_ATTACHED,
            CHROME_ERROR.CANNOT_ACCESS_CHROME_EXT,
            CHROME_ERROR.CANNOT_ATTACH_TARGET,
          ],
        }),
      );
    });

  getTargets = () => {
    this.logVerbose('getTargets started');
    return new Promise((resolve, reject) => {
      const onResolve = (...args) => {
        this.logVerbose('getTargets finished with success');
        return resolve(...args);
      };
      const onReject = (error) => {
        this.logVerbose('getTargets finished with error', error);
        reject(error);
      };
      chrome.debugger.getTargets(
        catchUnexpectedErrors(this.#resolve(onResolve), {
          onError: onReject,
          ignoredErrors: [CHROME_ERROR.CANNOT_ACCESS_CHROME_EXT],
        }),
      );
    });
  };

  on = (eventName, handler) => {
    this.protocolListeners[eventName] = [...(this.protocolListeners[eventName] || []), handler];
  };

  off = (eventName, handler) => {
    this.protocolListeners[eventName] = without([handler], this.protocolListeners[eventName] || []);
  };

  reset = () => {
    Object.keys(this.protocolListeners).forEach((methodName) => {
      this.protocolListeners[methodName].forEach((handleEvent) => {
        this.off(methodName, handleEvent);
      });
    });
  };
}
