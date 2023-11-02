import { store } from '~/background/store';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import {
  selectTabIdWindowIdMap,
  selectWindowTestRunId,
} from '~/modules/extension/extension.selectors';
import { RunnerActions } from '~/modules/runner/runner.redux';
import {
  selectCurrentTabContext,
  selectIsRunningTestRun,
  selectRunningTestRun,
} from '~/modules/runner/runner.selectors';
import * as windows from '~/services/browser/windows';

const WindowsHandlers = {
  onRemoved: (windowId) => {
    const state = store.getState();
    const testRunId = selectWindowTestRunId(windowId)(state);
    const isRunning = selectIsRunningTestRun(testRunId)(state);
    store.dispatch(ExtensionActions.closeWindowsRequested(true, isRunning, false, [windowId]));
  },

  onFocusChanged: async () => {
    const state = store.getState();
    const testRun = selectRunningTestRun(state);

    if (testRun) {
      const { currentTabId } = selectCurrentTabContext(testRun.testRunId)(state);
      const tabIdWindowIdMap = selectTabIdWindowIdMap(state);
      const currentWindowId = tabIdWindowIdMap[currentTabId];

      if (currentWindowId) {
        const windowData = await windows.get(currentWindowId);
        if (windowData.state === chrome.windows.WindowState.MINIMIZED) {
          store.dispatch(RunnerActions.stopTestOnWindowMinimizedRequested());
        }
      }
    }
  },
};

export default WindowsHandlers;
