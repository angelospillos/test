import { isVerboseEnabled } from '~/utils/env';
import { isBackgroundContext } from '~/utils/misc';

import logger from './logger';

export default class BaseService {
  #logger = null;

  #showVerboseLogs = isVerboseEnabled();

  constructor(loggerName) {
    this.isBackgroundContext = isBackgroundContext();
    this.#logger = logger.get(loggerName || this.constructor.name);
  }

  toggleVerboseLogs = () => {
    this.#showVerboseLogs = !this.#showVerboseLogs;
  };

  logVerbose = (...args) => {
    if (this.#showVerboseLogs) {
      this.#logger.verbose(...args);
    }
  };

  shouldSendLogs = () => this.#logger.shouldSendLogs();

  logDebug = (...args) => this.#logger.debug(...args);

  logInfo = (...args) => this.#logger.log(...args);

  logError = (...args) => this.#logger.error(...args);
}
