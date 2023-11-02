import { STATUS } from '@angelos/core/constants';

import {
  emitRunningPageNavigationCommitted,
  recordSwitchContext,
} from '~/background/background.helpers';
import { store } from '~/background/store';
import { NEW_TAB_URLS } from '~/constants/browser';
import { EVENT_TYPE, STEP_TYPE } from '~/constants/test';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import {
  selectIsWindowUnderControl,
  selectTab,
  selectTabsCount,
  selectWindowProjectId,
  selectWindowTestId,
  selectWindowTestRunId,
  selectWindowViewport,
} from '~/modules/extension/extension.selectors';
import { RecorderActions } from '~/modules/recorder/recorder.redux';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import { PageLoadingError } from '~/modules/runner/runner.exceptions';
import { RunnerActions } from '~/modules/runner/runner.redux';
import { selectIsRunningTestRun, selectLastRunningStep } from '~/modules/runner/runner.selectors';
import browser from '~/services/browser';
import { isExcludedUrl } from '~/services/browser/browser.helpers';
import WebRequests from '~/services/browser/webRequests';

const TabsHandlers = {
  lastTabRemoved: false,
  onCreated: async (tab) => {
    const state = store.getState();
    const isRecording = selectIsRecording(state);
    const isWindowUnderControl = selectIsWindowUnderControl(tab.windowId)(state);
    const testRunId = selectWindowTestRunId(tab.windowId)(state);
    const projectId = selectWindowProjectId(tab.windowId)(state);
    const testId = selectWindowTestId(tab.windowId)(state);
    const isRunning = selectIsRunningTestRun(testRunId)(state);
    const tabObj = selectTab(tab.id)(state);
    const viewport = { innerWidth: tab.width, innerHeight: tab.height };

    if (!isRecording) {
      WebRequests.startListeningRequests(tab.id);
      WebRequests.setIsNetworkBusy(tab.id);
    }

    if (!isRunning && (!isRecording || !isWindowUnderControl)) {
      return;
    }

    if (!tabObj) {
      store.dispatch(
        ExtensionActions.addTabSucceeded(
          tab.id,
          tab.windowId,
          projectId,
          testId,
          viewport,
          testRunId,
        ),
      );
    }
    if (isRunning && tab.active) {
      store.dispatch(RunnerActions.updateCurrentTabContextSucceeded(testRunId, tab.id));
    }

    if (isRecording) {
      if (NEW_TAB_URLS.includes(tab.pendingUrl)) {
        store.dispatch(
          RecorderActions.addEventRequested({
            timestamp: new Date().getTime(),
            type: EVENT_TYPE.NEW_TAB,
            tabId: tab.id,
            isTrusted: true,
          }),
        );
      }
    }
  },

  onUpdated: async (tabId, changeInfo, tab) => {
    const state = store.getState();
    const testRunId = selectWindowTestRunId(tab.windowId)(state);
    const currentViewport = selectWindowViewport(tab.windowId)(state);
    const isRunning = selectIsRunningTestRun(testRunId)(state);
    const tabObj = selectTab(tabId)(state);
    const viewport = { innerWidth: tab.width, innerHeight: tab.height };

    if (tabObj && isRunning) {
      if (viewport.innerHeight > currentViewport.innerHeight) {
        store.dispatch(ExtensionActions.updateWindowViewportSucceeded(tab.windowId, viewport));
      }

      if (!isExcludedUrl(tab.url) && !browser.devTools.isConnected(tabId)) {
        try {
          await browser.devTools.connect(tabId);
        } catch (error) {
          const failedRequest = WebRequests.getFailedRequest(
            tabId,
            tab.url,
            `chrome-extension://${chrome.runtime.id}`,
          );

          if (failedRequest) {
            const step = selectLastRunningStep(state);
            store.dispatch(
              RunnerActions.updateStepRunStatusRequested(
                testRunId,
                step.id,
                STATUS.FAILED,
                new PageLoadingError(failedRequest.error, { forceFailed: true }).params,
              ),
            );
          } else {
            throw error;
          }
        }
      }
    }

    if (!isExcludedUrl(tab.url) && tabObj) {
      await browser.tabs.resetTabZoomSettings(tab.id);
    }

    if (!isExcludedUrl(changeInfo.url) && tabObj) {
      store.dispatch(RunnerActions.updateCurrentTabContextExecutionUrl(testRunId, changeInfo.url));
    }

    if (!isExcludedUrl(changeInfo.url) && tabObj) {
      if (isRunning) {
        emitRunningPageNavigationCommitted(tabObj.testRunId, tabId, 0);
      }
    }
  },

  onZoomChange: async ({ tabId }) => {
    const state = store.getState();
    const tabObj = selectTab(tabId)(state);
    const isRunning = tabObj && selectIsRunningTestRun(tabObj?.testRunId)(state);

    if (tabObj && isRunning) {
      await browser.tabs.resetTabZoomSettings(tabId);
    }
  },

  onActivated: (details) => {
    const state = store.getState();
    const isRecording = selectIsRecording(state);
    const isWindowUnderControl = selectIsWindowUnderControl(details.windowId)(state);
    if (!isRecording || !isWindowUnderControl) {
      return;
    }
    const tabObj = selectTab(details.tabId)(state);
    if (tabObj) {
      recordSwitchContext(details);
    }
  },

  onRemoved: (tabId) => {
    const state = store.getState();
    const tabObj = selectTab(tabId)(state);
    if (!tabObj) {
      return;
    }

    const isRecording = selectIsRecording(state);
    const isRunning = selectIsRunningTestRun(tabObj.testRunId)(state);
    if (!isRunning && !isRecording) {
      return;
    }

    const tabsCount = selectTabsCount(tabObj.testRunId)(state);
    TabsHandlers.lastTabRemoved = true;

    if (isRunning) {
      const step = selectLastRunningStep(state);
      WebRequests.stopListeningRequests(tabId);
      const { testRunId } = tabObj;
      if (step.type !== STEP_TYPE.CLOSE_TAB && tabObj.no === step.tabNo) {
        store.dispatch(RunnerActions.stopTestOnTabClosedRequested(testRunId));
      }
    }
    if (isRecording && tabsCount > 1) {
      store.dispatch(
        RecorderActions.addEventRequested({
          timestamp: new Date().getTime(),
          type: EVENT_TYPE.CLOSE_TAB,
          tabId,
          isTrusted: true,
        }),
      );
    }

    store.dispatch(ExtensionActions.removeTabSucceeded(tabId));
  },
};

export default TabsHandlers;
