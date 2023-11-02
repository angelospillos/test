import memoize from 'lodash.memoize';
import { pathOr, find, path, head, values, propOr } from 'ramda';
import { createSelector } from 'reselect';

export const selectExtensionDomain = (state) => state.extension;

export const selectExtensionSettings = createSelector(
  selectExtensionDomain,
  (state) => state.settings,
);

export const selectTabByIndex = (testRunId, tabNo) =>
  createSelector(
    selectExtensionDomain,
    (state) =>
      find(
        (tabObj) => tabObj?.testRunId === testRunId && tabObj.no === tabNo,
        Object.values(state.tabs),
      ) || false,
  );

export const selectWindowsIdList = createSelector(selectExtensionDomain, (state) =>
  Object.keys(state.windows).map((windowId) => parseInt(windowId, 10)),
);

export const selectHasOpenedWindows = createSelector(
  selectExtensionSettings,
  (settings) => settings.hasOpenedWindows,
);

export const selectActiveWebAppTabs = createSelector(
  selectExtensionDomain,
  propOr({}, 'activeWebAppTabs'),
);

export const selectHasActiveWebAppTabs = createSelector(
  selectActiveWebAppTabs,
  (activeWebAppTabs) => !!Object.keys(activeWebAppTabs).length,
);

export const selectWindow = (windowId) =>
  createSelector(selectExtensionDomain, (state) => pathOr(false, ['windows', windowId], state));

export const selectWindowTestRunId = (windowId) =>
  createSelector(selectExtensionDomain, path(['windows', windowId, 'testRunId']));

export const selectWindowTestId = (windowId) =>
  createSelector(selectExtensionDomain, path(['windows', windowId, 'testId']));

export const selectWindowProjectId = (windowId) =>
  createSelector(selectExtensionDomain, path(['windows', windowId, 'projectId']));

export const selectWindowViewport = (windowId) =>
  createSelector(selectExtensionDomain, path(['windows', windowId, 'viewport']));

export const selectWindowsListForTestRunId = (testRunId) =>
  createSelector(selectExtensionDomain, selectWindowsIdList, (state, windowsIds) =>
    windowsIds.filter((windowId) => state.windows[windowId]?.testRunId === testRunId),
  );

export const selectIsWindowUnderControl = (windowId) =>
  createSelector(selectWindowsIdList, (windowsIdsList) =>
    windowsIdsList.includes(parseInt(windowId, 10)),
  );

export const selectTab = (tabId) =>
  createSelector(selectExtensionDomain, (state) => pathOr(false, ['tabs', tabId], state));

export const selectTabsIdToNumbersMap = createSelector(selectExtensionDomain, (state) => {
  const mapped = {};
  values(state.tabs).forEach((tabObj) => {
    mapped[tabObj.id] = tabObj.no;
  });
  return mapped;
});

export const selectTabIdWindowIdMap = createSelector(selectExtensionDomain, (state) => {
  const mapped = {};
  values(state.windows).forEach((windowObj) => {
    windowObj.tabs.forEach((tabId) => {
      mapped[tabId] = windowObj.id;
    });
  });
  return mapped;
});

export const selectTabAndWindowNo = (tabId) =>
  createSelector(
    selectExtensionDomain,
    (state) =>
      head(
        values(state.windows)
          .filter((windowObj) => windowObj.tabs.includes(parseInt(tabId, 10)))
          .map((windowObj) => ({
            windowNo: windowObj.no,
            tabNo: state.tabs[tabId].no,
          })),
      ) || null,
  );

export const selectIsSelenium = createSelector(selectExtensionDomain, (state) => state.isSelenium);

export const selectFrameById = (tabId, frameId) =>
  createSelector(selectExtensionDomain, path(['tabs', tabId, 'frames', frameId]));

export const selectTrackerFrameById = (tabId, frameId) =>
  createSelector(selectExtensionDomain, path(['tabs', tabId, 'trackerFrames', frameId]));

export const selectFrames = (tabId) =>
  createSelector(selectExtensionDomain, path(['tabs', tabId, 'frames']));

export const selectFrameByLocation = (tabId, frameLocation) =>
  createSelector(selectExtensionDomain, (state) =>
    find(
      (frameObj) => frameObj.frameLocation === frameLocation,
      Object.values(pathOr({}, ['tabs', tabId, 'frames'], state)),
    ),
  );

export const selectTabIdListForTestRunId = (testRunId) =>
  createSelector(selectExtensionDomain, (state) =>
    Object.keys(state.tabs)
      .filter((tabId) => state.tabs[tabId]?.testRunId === testRunId)
      .map((tabId) => parseInt(tabId, 10)),
  );

export const selectTabIdListForTestId = (testId) =>
  createSelector(selectExtensionDomain, (state) =>
    Object.keys(state.tabs)
      .filter((tabId) => state.tabs[tabId]?.testId === testId)
      .map((tabId) => parseInt(tabId, 10)),
  );

export const selectTabsCount = (testRunId) =>
  createSelector(selectTabIdListForTestRunId(testRunId), (tabList) => tabList.length);

export const selectTabMousePosition = (tabId) =>
  createSelector(selectExtensionDomain, path(['tabs', tabId, 'mousePosition']));

export const selectLastMousePosition = createSelector(
  selectExtensionDomain,
  path(['lastMousePosition']),
);

export const selectIsCursorVisible = createSelector(
  selectExtensionDomain,
  path(['isCursorVisible']),
);

export const selectIsPromptOpened = createSelector(selectExtensionDomain, path(['isPromptOpened']));

export const selectTabPendingRequests = memoize((tabId) =>
  createSelector(selectExtensionDomain, path(['tabs', tabId, 'pendingRequests'])),
);

export const selectTabIsNetworkIdle = memoize((tabId) =>
  createSelector(selectExtensionDomain, path(['tabs', tabId, 'isNetworkIdle'])),
);

export const selectIsTabDebuggerDetachedByUser = (tabId) =>
  createSelector(selectExtensionDomain, path(['tabs', tabId, 'isTabDetachedByUser']));
