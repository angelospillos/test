/* eslint-disable no-underscore-dangle */
import changesBatcher from '~/modules/recorder/recorder.batch';
import backgroundWorker from '~/services/backgroundWorker';
// eslint-disable-next-line import/no-named-as-default
import browser from '~/services/browser';
import devToolsClient from '~/services/browser/devTools';
import Logger from '~/services/logger';
import variables from '~/services/variables';
import * as sentryUtils from '~/utils/sentry';

if (process.env.SENTRY_DSN) {
  sentryUtils.init('background');
}

backgroundWorker.setup();
backgroundWorker.initKeepingWorkerAwake();
backgroundWorker.refreshWebappIfNeeded();
backgroundWorker.initBatchLogsWatcher();

const services = {
  changesBatcher,
  devTools: devToolsClient,
  browser,
  logger: Logger,
  worker: backgroundWorker,
  variables,
};

// eslint-disable-next-line no-restricted-globals
self.bb = {
  ...services,
  toggleVerboseLogs() {
    Object.values(services).forEach((service) => {
      if (service.toggleVerboseLogs) {
        service.toggleVerboseLogs();
      }
    });
  },
};
