/* eslint-disable no-console */
/* eslint-disable max-classes-per-file */

import { Logtail } from '@logtail/browser';
import * as Sentry from '@sentry/browser';
import { is, without, sortBy, prop } from 'ramda';

import { SERIALIZABLE_ERROR_FIELDS } from '~/modules/runner/runner.exceptions';
import runtimeMessaging from '~/services/runtimeMessaging';
import { isDebugEnabled } from '~/utils/env';
import { isBackgroundContext } from '~/utils/misc';

const MAX_BATCH_LOGS_BUFFER_SIZE = 2000;

export const CUSTOM_CONSOLE_METHODS = ['debug', 'error', 'verbose', 'debugAction'];

export const DEFAULT_CONSOLE_METHODS = [
  ...CUSTOM_CONSOLE_METHODS,
  'info',
  'log',
  'dir',
  'group',
  'groupCollapsed',
  'groupEnd',
];

export const LOG_CATEGORY = {
  SESSION: 'session.log',
  REDUX: 'redux.action',
};

export const externalLogger = process.env.EXTERNAL_LOGGING_TOKEN
  ? new Logtail(process.env.EXTERNAL_LOGGING_TOKEN)
  : null;

export const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    // eslint-disable-next-line consistent-return
    return value;
  };
};

class Logger {
  #name = 'Unnamed';

  debug = console.debug;

  error = console.error;

  verbose = console.debug;

  log = console.log;

  constructor(name, loggingService) {
    this.#name = name;

    this.#setupConsoleHandlers(loggingService);

    this.addToList = (...args) => loggingService.addToList(`[${this.#name}]`, ...args);

    this.shouldSendLogs = () => loggingService.shouldSendLogs();
  }

  #setupConsoleHandlers = (loggingService) => {
    DEFAULT_CONSOLE_METHODS.forEach((type) => {
      this[type] = (...args) => loggingService[type](`[${this.#name}]`, ...args);
    });
  };
}

export const LOGGER_EVENT_TYPE = {
  SET: 'angelos_LOGGER/SET',
  ADD: 'angelos_LOGGER/ADD',
  GET: 'angelos_LOGGER/GET',
  STORE: 'angelos_LOGGER/STORE',
};

class LoggingService {
  #isDebugMode = isDebugEnabled();

  #areExternalLogsEnabled = false;

  #areGeneralLogsEnabled = true;

  #metaData = {};

  #logs = [];

  constructor() {
    this.isBackgroundContext = isBackgroundContext();
    this.#setupConsoleHandlers();
    this.startListeningForEvents();
  }

  #setupConsoleHandlers = () => {
    without(CUSTOM_CONSOLE_METHODS, DEFAULT_CONSOLE_METHODS).forEach((type) => {
      this[type] = (...args) => {
        console[type](...args);
      };
    });
  };

  #handleSetMessages = (message) => {
    this.#logs = message.data;
    return this.#logs;
  };

  #handleAddMessage = (message) => {
    this.#setAsBreadcrumb(message.data);
    return message;
  };

  #handleGetMessages = () => this.getStoredLogs();

  #handleStoreMessage = (message) => {
    this.storeLog(message.data.logType, message.data.args);
  };

  #setAsBreadcrumb = (log) => {
    Sentry.addBreadcrumb({
      ...log,
      level: log.category === LOG_CATEGORY.REDUX ? 'info' : 'debug',
    });
  };

  startListeningForEvents = () => {
    if (this.isBackgroundContext) {
      runtimeMessaging.onMessage(LOGGER_EVENT_TYPE.SET, this.#handleSetMessages);
      runtimeMessaging.onMessage(LOGGER_EVENT_TYPE.ADD, this.#handleAddMessage);
      runtimeMessaging.onMessage(LOGGER_EVENT_TYPE.GET, this.#handleGetMessages);
      runtimeMessaging.onMessage(LOGGER_EVENT_TYPE.STORE, this.#handleStoreMessage);
    }
  };

  getStoredLogs = () => sortBy(prop('timestamp'), this.#logs);

  #convertArgsToString = (args) =>
    `${args
      .map((value) => {
        if (is(String, value)) {
          return value;
        }
        if (!this.isBackgroundContext && value instanceof HTMLElement) {
          return `[${value.constructor.name}]`;
        }
        if (value instanceof Error) {
          return JSON.stringify(value, SERIALIZABLE_ERROR_FIELDS);
        }
        return JSON.stringify(value, getCircularReplacer());
      })
      .join(' ')}`;

  addToList = async (category = 'session.log', ...args) => {
    const message = this.#convertArgsToString(args);
    const log = { message, category };
    if (this.isBackgroundContext) {
      this.storeLog('angelos', [message]);
      this.#setAsBreadcrumb(log);
    } else {
      await runtimeMessaging.sendMessageToBackground({
        command: LOGGER_EVENT_TYPE.ADD,
        data: log,
      });
    }
    return log;
  };

  setMetaData = (metaData) => {
    this.#metaData = metaData;
  };

  enableDebugMode = () => {
    this.#isDebugMode = true;
  };

  disableDebugMode = () => {
    this.#isDebugMode = false;
  };

  enableExternalLogs = () => {
    this.#areExternalLogsEnabled = true;
  };

  disableExternalLogs = () => {
    this.#areExternalLogsEnabled = false;
  };

  enableGeneralLogs = () => {
    this.#areGeneralLogsEnabled = true;
  };

  disableGeneralLogs = () => {
    this.#areGeneralLogsEnabled = false;
  };

  get = (name) => new Logger(name, this);

  storeLog = async (logType, args = []) => {
    if (!this.#areGeneralLogsEnabled) {
      return;
    }

    if (this.isBackgroundContext) {
      const message = this.#convertArgsToString([`[${logType.toUpperCase()}]`, ...args]);
      const log = {
        type: logType,
        timestamp: Date.now(),
        message,
      };
      this.#logs.push(log);
    } else {
      await runtimeMessaging.sendMessageToBackground({
        command: LOGGER_EVENT_TYPE.STORE,
        data: { logType, args },
      });
    }
  };

  #logToExternalService = async (type, ...args) => {
    if (this.#areExternalLogsEnabled) {
      const data = args || [];
      const message = [...data];

      externalLogger[type](message.join(' '), {
        raw: data.slice(1),
        meta: this.#metaData,
      });
    }
  };

  debug = (...args) => {
    this.addToList(LOG_CATEGORY.SESSION, ...args);
    if (this.#isDebugMode) {
      console.debug(...args);
      this.#logToExternalService('debug', ...args);
    }
  };

  debugAction = (...args) => {
    this.addToList(LOG_CATEGORY.REDUX, ...args.slice(1));

    if (this.#isDebugMode) {
      this.#logToExternalService('debug', ...args);
    }
  };

  verbose = (...args) => {
    if (this.#isDebugMode) {
      console.debug(...args);
      this.#logToExternalService('debug', ...args);
    }
  };

  error = (...args) => {
    this.#logToExternalService('error', ...args);
  };

  // Only for testing purposes
  _stopListeningForEvents = () => {
    if (this.isBackgroundContext) {
      runtimeMessaging.removeMessageListener(LOGGER_EVENT_TYPE.SET, this.#handleSetMessages);
      runtimeMessaging.removeMessageListener(LOGGER_EVENT_TYPE.ADD, this.#handleAddMessage);
      runtimeMessaging.removeMessageListener(LOGGER_EVENT_TYPE.GET, this.#handleGetMessages);
      runtimeMessaging.removeMessageListener(LOGGER_EVENT_TYPE.STORE, this.#handleStoreMessage);
    }
  };

  resetLogs = () => {
    this.#logs = [];
  };

  reset = () => {
    this.#metaData = {};
    this.disableExternalLogs();
    this.enableGeneralLogs();
    this.resetLogs();

    if (process.env.ENV !== 'development') {
      this.disableDebugMode();
    }
  };

  shouldSendLogs() {
    return this.#areGeneralLogsEnabled && this.getStoredLogs().length > MAX_BATCH_LOGS_BUFFER_SIZE;
  }
}

export default new LoggingService();
