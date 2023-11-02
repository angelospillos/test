import { store } from '~/background/store';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import { RunnerActions } from '~/modules/runner/runner.redux';
import { selectHasRunningTestRun, selectIsStopping } from '~/modules/runner/runner.selectors';
import browser from '~/services/browser';
import devToolsClient from '~/services/browser/devTools';
import * as tabs from '~/services/browser/tabs';
import Logger from '~/services/logger';

const logger = Logger.get('DebuggerHandlers');

const DebuggerHandlers = {
  onDetach: async (source, reason) => {
    logger.debug('Debugger detached!', source, reason);

    const isCanceledByUser = reason === chrome.debugger.DetachReason.CANCELED_BY_USER;
    if (isCanceledByUser) {
      store.dispatch(ExtensionActions.setIsTabDebuggerDetachedByUserSucceeded(source.tabId));
    }

    if (await tabs.isOpen(source.tabId)) {
      logger.debug('Tab is still open. Trying to reconnect...');
      browser.devTools.removeFromAttachedTabs(source.tabId);

      try {
        const state = store.getState();
        const isRunning = selectHasRunningTestRun(state);
        const isStopping = selectIsStopping(state);
        logger.debug(
          `Extra checks before reconnect: Is running test run: ${isRunning}, is stopping: ${isStopping}`,
        );
        if (isRunning && !isStopping) {
          // Probably bug in Chrome. Devtools detach when iframe has blob resources
          // but after re-attach everything works OK
          await browser.webRequests.waitUntilPendingRequestsBelowLimit(source.tabId, '0');
          await devToolsClient.connect(source.tabId);
          logger.debug('Tab reconnected!', source.tabId);

          if (isCanceledByUser) {
            store.dispatch(
              ExtensionActions.setIsTabDebuggerDetachedByUserSucceeded(source.tabId, false),
            );
          }
        }
      } catch (error) {
        logger.debug('Error while reconnecting tab', error);
        store.dispatch(RunnerActions.stopTestOnDebuggerDetachedRequested());
      }
    }
  },
};

export default DebuggerHandlers;
