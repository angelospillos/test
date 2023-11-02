import { produce } from 'immer';
import { without, keys, omit } from 'ramda';
import { createActions, createReducer } from 'reduxsauce';

import { UserTypes } from '~/modules//user/user.redux';

import { RunnerTypes } from '../runner/runner.redux';

export const { Types: ExtensionTypes, Creators: ExtensionActions } = createActions(
  {
    registerSeleniumSucceeded: [],
    updateSettingsRequested: [],
    updateSettingsSucceeded: ['settings'],
    updateSettingsFailed: ['error'],
    removeWindowRequested: ['windowId', 'closeWindow'],
    removeWindowSucceeded: ['windowId', 'testRunId'],
    sendSettingsToWebappRequested: ['settings'],
    sendSettingsToWebappSucceeded: [],
    settingsUpdated: ['extensionSettingsId'],
    removeWindowFailed: ['error'],
    closeWindowsRequested: ['updateSettings', 'waitUntilTestStop', 'closeWindow', 'windowsIds'],
    closeWindowsSucceeded: [],
    closeSelectedWindowsRequested: [
      'windowsIds',
      'updateSettings',
      'closeWindow',
      'waitUntilTestStop',
    ],
    closeSelectedWindowsSucceeded: [],
    addActiveWebAppTab: ['tabId'],
    removeActiveWebAppTab: ['tabId'],
    addTabSucceeded: ['tabId', 'windowId', 'projectId', 'testId', 'viewport', 'testRunId'],
    removeTabSucceeded: ['tabId'],
    addFrameSucceeded: ['tabId', 'frameId', 'frameLocation', 'url'],
    addTrackerFrameSucceeded: ['tabId', 'frameId', 'url'],
    removeFrameSucceeded: ['tabId', 'frameId'],
    updateTabStatusSucceeded: ['tabId', 'status', 'url'],
    updateWindowViewportSucceeded: ['windowId', 'viewport'],
    updateWindowStatusSucceeded: ['windowId', 'status'],
    updateMousePositionSucceeded: ['tabId', 'x', 'y', 'isInitial'],
    addTabConnectionSucceeded: ['tabId', 'requestId'],
    removeTabConnectionSucceeded: ['tabId', 'requestId'],
    setIsTabNetworkIdleSucceeded: ['tabId', 'isNetworkIdle', 'pendingRequests'],
    setIsTabDebuggerDetachedByUserSucceeded: ['tabId', 'isDetached'],
    setTabPendingRequestsSucceeded: ['tabId', 'pendingRequests'],
    setIsCursorVisible: ['isVisible'],
    openSettingsRequested: [],
    restartPendingDisconnectionRequested: [],
    resetRequested: [],
  },
  { prefix: 'EXTENSION/' },
);

const INITIAL_STATE = {
  isSelenium: false,
  settings: {
    isAllowedIncognitoAccess: false,
    hasOpenedWindows: false,
    browserName: null,
    browserVersion: null,
  },
  lastMousePosition: {},
  isCursorVisible: true,
  isPromptOpened: false,
  activeWebAppTabs: {},
  windows: {},
  tabs: {},
};

const resetRequested = (state) =>
  produce(state, (draftState) => {
    draftState.windows = {};
    draftState.tabs = {};
    draftState.isPromptOpened = false;
    draftState.isCursorVisible = true;
    draftState.lastMousePosition = {};
  });

const registerSeleniumSucceeded = (state) =>
  produce(state, (draftState) => {
    draftState.isSelenium = true;
  });

const updateSettingsSucceeded = (state, action) =>
  produce(state, (draftState) => {
    draftState.settings = { ...state.settings, ...action.settings };
  });

const removeWindowSucceeded = (state, { windowId }) =>
  produce(state, (draftState) => {
    if (state.windows[windowId]) {
      draftState.tabs = omit(draftState.windows[windowId].tabs, draftState.tabs);
      draftState.windows = omit([windowId], draftState.windows);
      draftState.settings.hasOpenedWindows = Boolean(keys(draftState.windows).length);
    }
  });

const addActiveWebAppTab = (state, { tabId }) =>
  produce(state, (draftState) => {
    draftState.activeWebAppTabs[tabId] = true;
  });

const removeActiveWebAppTab = (state, { tabId }) =>
  produce(state, (draftState) => {
    if (tabId === null) {
      draftState.activeWebAppTabs = {};
    } else {
      draftState.activeWebAppTabs = omit([tabId], draftState.activeWebAppTabs);
    }
  });

const addTabSucceeded = (state, { tabId, windowId, projectId, testId, viewport, testRunId }) =>
  produce(state, (draftState) => {
    if (draftState.tabs[tabId]) {
      return;
    }

    draftState.tabs[tabId] = {
      id: tabId,
      windowId,
      no: keys(state.tabs).length,
      frames: {},
      trackerFrames: {},
      status: null,
      url: null,
      projectId,
      testId,
      testRunId,
      mousePosition: {},
      pendingRequests: 0,
      isNetworkIdle: true,
    };
    if (!keys(state.windows).includes(String(windowId))) {
      draftState.windows[windowId] = {
        id: windowId,
        no: keys(state.windows).length,
        tabs: [],
        status: null,
        projectId,
        testId,
        testRunId,
        viewport,
      };
    }
    draftState.settings.hasOpenedWindows = true;
    draftState.windows[windowId].tabs.push(tabId);
  });

const removeTabSucceeded = (state, { tabId }) =>
  produce(state, (draftState) => {
    if (draftState.tabs[tabId]) {
      const { windowId } = draftState.tabs[tabId];
      draftState.windows[windowId].tabs = without([tabId], draftState.windows[windowId].tabs);
      delete draftState.tabs[tabId];
    }
  });

const setIsTabNetworkIdleSucceeded = (state, { tabId, isNetworkIdle, pendingRequests }) =>
  produce(state, (draftState) => {
    if (draftState.tabs[tabId]) {
      draftState.tabs[tabId].isNetworkIdle = isNetworkIdle;
      draftState.tabs[tabId].pendingRequests = pendingRequests;
    }
  });

const setIsTabDebuggerDetachedByUserSucceeded = (state, { tabId, isDetached = true }) =>
  produce(state, (draftState) => {
    if (draftState.tabs[tabId]) {
      draftState.tabs[tabId].isTabDetachedByUser = isDetached;
    }
  });

const setTabPendingRequestsSucceeded = (state, { tabId, pendingRequests }) =>
  produce(state, (draftState) => {
    if (draftState.tabs[tabId]) {
      draftState.tabs[tabId].pendingRequests = pendingRequests;
    }
  });

const updateWindowStatusSucceeded = (state, { windowId, status }) =>
  produce(state, (draftState) => {
    if (draftState.windows[windowId]) {
      draftState.windows[windowId].status = status;
    }
  });

const updateTabStatusSucceeded = (state, { tabId, status, url = null }) =>
  produce(state, (draftState) => {
    if (state.tabs[tabId]) {
      draftState.tabs[tabId].status = status;
      draftState.tabs[tabId].url = url;
    }
  });

const updateWindowViewportSucceeded = (state, { windowId, viewport }) =>
  produce(state, (draftState) => {
    if (state.windows[windowId]) {
      draftState.windows[windowId].viewport = viewport;
    }
  });

const addFrameSucceeded = (state, { tabId, frameId, frameLocation }) =>
  produce(state, (draftState) => {
    if (state.tabs[tabId]) {
      draftState.tabs[tabId].frames[frameId] = {
        id: frameId,
        frameId,
        frameLocation,
      };
    }
  });

const addTrackerFrameSucceeded = (state, { tabId, frameId }) =>
  produce(state, (draftState) => {
    if (state.tabs[tabId]) {
      draftState.tabs[tabId].trackerFrames[frameId] = {
        id: frameId,
        frameId,
      };
    }
  });

const removeFrameSucceeded = (state, { tabId, frameId }) =>
  produce(state, (draftState) => {
    if (state.tabs[tabId]) {
      delete draftState.tabs[tabId].frames[frameId];
      delete draftState.tabs[tabId].trackerFrames[frameId];
    }
  });

const updateMousePositionSucceeded = (state, { tabId, x, y, isInitial = false }) =>
  produce(state, (draftState) => {
    if (draftState.tabs[tabId]) {
      draftState.tabs[tabId].mousePosition = { x, y, isInitial };
    }
    draftState.lastMousePosition = { x, y, isInitial };
  });

const setIsCursorVisible = (state, { isVisible = false }) =>
  produce(state, (draftState) => {
    draftState.isCursorVisible = isVisible;
  });

const updateIsPromptOpenedSucceeded = (state, { isOpened }) =>
  produce(state, (draftState) => {
    draftState.isPromptOpened = isOpened;
  });

export const reducer = createReducer(INITIAL_STATE, {
  [ExtensionTypes.REMOVE_WINDOW_SUCCEEDED]: removeWindowSucceeded,
  [ExtensionTypes.ADD_TAB_SUCCEEDED]: addTabSucceeded,
  [ExtensionTypes.REMOVE_TAB_SUCCEEDED]: removeTabSucceeded,
  [ExtensionTypes.REGISTER_SELENIUM_SUCCEEDED]: registerSeleniumSucceeded,
  [ExtensionTypes.UPDATE_SETTINGS_SUCCEEDED]: updateSettingsSucceeded,
  [ExtensionTypes.UPDATE_WINDOW_STATUS_SUCCEEDED]: updateWindowStatusSucceeded,
  [ExtensionTypes.UPDATE_TAB_STATUS_SUCCEEDED]: updateTabStatusSucceeded,
  [ExtensionTypes.UPDATE_WINDOW_VIEWPORT_SUCCEEDED]: updateWindowViewportSucceeded,
  [ExtensionTypes.ADD_FRAME_SUCCEEDED]: addFrameSucceeded,
  [ExtensionTypes.ADD_TRACKER_FRAME_SUCCEEDED]: addTrackerFrameSucceeded,
  [ExtensionTypes.REMOVE_FRAME_SUCCEEDED]: removeFrameSucceeded,
  [ExtensionTypes.UPDATE_MOUSE_POSITION_SUCCEEDED]: updateMousePositionSucceeded,
  [ExtensionTypes.SET_IS_TAB_NETWORK_IDLE_SUCCEEDED]: setIsTabNetworkIdleSucceeded,
  [ExtensionTypes.SET_TAB_PENDING_REQUESTS_SUCCEEDED]: setTabPendingRequestsSucceeded,
  [ExtensionTypes.SET_IS_TAB_DEBUGGER_DETACHED_BY_USER_SUCCEEDED]:
    setIsTabDebuggerDetachedByUserSucceeded,
  [ExtensionTypes.ADD_ACTIVE_WEB_APP_TAB]: addActiveWebAppTab,
  [ExtensionTypes.REMOVE_ACTIVE_WEB_APP_TAB]: removeActiveWebAppTab,
  [ExtensionTypes.RESET_REQUESTED]: resetRequested,
  [ExtensionTypes.SET_IS_CURSOR_VISIBLE]: setIsCursorVisible,
  //
  [UserTypes.LOGOUT_SUCCEEDED]: (state) => removeActiveWebAppTab(state, { tabId: null }),
  [RunnerTypes.OPEN_PROMPT_SUCCEEDED]: (state) =>
    updateIsPromptOpenedSucceeded(state, { isOpened: true }),
  [RunnerTypes.CLOSE_PROMPT_REQUESTED]: (state) =>
    updateIsPromptOpenedSucceeded(state, { isOpened: false }),
});
