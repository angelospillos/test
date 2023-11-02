import { propEq } from 'ramda';

import {
  emitRunningPageNavigationCommitted,
  emitRunningPageNavigationCompleted,
  loadContentScripts,
  recordGotoStep,
  removeFrame,
} from '~/background/background.helpers';
import { store } from '~/background/store';
import { TAB_STATUS, TRANSITION_QUALIFIER, TRANSITION_TYPE } from '~/constants/browser';
import { BackgroundActions } from '~/modules/background/background.redux';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import { selectTab } from '~/modules/extension/extension.selectors';
import { selectCurrentProjectSettings, selectFeatureFlags } from '~/modules/project';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import { selectIsRunningTestRun } from '~/modules/runner/runner.selectors';
import { isExcludedUrl } from '~/services/browser/browser.helpers';

const WebNavigationHandlers = {
  onBeforeNavigate: (details) => {
    if (details.frameId !== 0) {
      return;
    }
    const state = store.getState();
    const tabObj = selectTab(details.tabId)(state);
    if (tabObj) {
      const isRecording = selectIsRecording(state);
      const isRunning = selectIsRunningTestRun(tabObj?.testRunId)(state);

      if (isRunning || isRecording) {
        store.dispatch(
          ExtensionActions.updateTabStatusSucceeded(details.tabId, TAB_STATUS.LOADING, details.url),
        );
      }
    }
  },

  onDOMContentLoaded: (details) => {
    const state = store.getState();
    const tabObj = selectTab(details.tabId)(state);
    const isRunning = selectIsRunningTestRun(tabObj?.testRunId)(state);
    const isRecording = selectIsRecording(state);

    if (tabObj && (isRunning || isRecording)) {
      store.dispatch(BackgroundActions.domContentLoaded(details.tabId, details.frameId));

      if (details.frameId === 0) {
        store.dispatch(
          ExtensionActions.updateTabStatusSucceeded(
            details.tabId,
            TAB_STATUS.COMPLETED,
            details.url,
          ),
        );
      }
    }
  },

  onCommitted: async (details) => {
    const state = store.getState();
    const tabObj = selectTab(details.tabId)(state);
    const isRecording = selectIsRecording(state);
    const isRunning = selectIsRunningTestRun(tabObj?.testRunId)(state);
    if (tabObj) {
      const projectSettings = selectCurrentProjectSettings(state);
      const featureFlags = selectFeatureFlags(state);
      loadContentScripts(details, isRecording, projectSettings, featureFlags);
    }

    if (details.frameId === 0 && tabObj && isRecording && !isExcludedUrl(details.url)) {
      if (
        tabObj?.url &&
        (details.transitionQualifiers.includes(TRANSITION_QUALIFIER.FROM_ADDRESS_BAR) ||
          details.transitionType === TRANSITION_TYPE.TYPED ||
          details.transitionType === TRANSITION_TYPE.RELOAD)
      ) {
        recordGotoStep(details, tabObj?.url);
      }
    }

    if (propEq('status', TAB_STATUS.LOADING)(tabObj) && isRunning && details.frameId === 0) {
      emitRunningPageNavigationCommitted(tabObj?.testRunId, details.tabId, details.frameId);
    }
    if (tabObj && isRunning) {
      removeFrame(details);
    }
  },

  onCompleted: (details) => {
    const state = store.getState();
    const tabObj = selectTab(details.tabId)(state);
    const isRunning = selectIsRunningTestRun(tabObj?.testRunId)(state);

    if (isRunning && details.frameId === 0) {
      emitRunningPageNavigationCompleted(tabObj?.testRunId, details.tabId, details.frameId);
    }
  },

  onHistoryStateUpdated: (details) => {
    const state = store.getState();
    const tabObj = selectTab(details.tabId)(state);
    const isRunning = selectIsRunningTestRun(tabObj?.testRunId)(state);

    if (tabObj && isRunning && details.frameId === 0) {
      /*
          Tested cases:
            - history.pushState()
            - history.back()
            - history.replaceState()
            - url typed in address bar
            - browser back button
            - location.href
            - location.hash - not supported
            - location.reload()
        */
      emitRunningPageNavigationCommitted(tabObj?.testRunId, details.tabId, details.frameId);
    }
  },
};

export default WebNavigationHandlers;
