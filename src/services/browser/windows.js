import { omit, prop } from 'ramda';

import { SCREEN_RESOLUTION_TYPE } from '~/constants/test';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import { selectIsWindowUnderControl } from '~/modules/extension/extension.selectors';
import StoreRegistry, { STORE_TYPES } from '~/modules/storeRegistry';
import { isCloud } from '~/utils/env';
import { catchUnexpectedErrors, CHROME_ERROR } from '~/utils/errors';

const dispatch = (...args) => StoreRegistry.get(STORE_TYPES.BACKGROUND).dispatch(...args);

const create = (options) =>
  new Promise((resolve, reject) => {
    chrome.windows.create(
      options,
      catchUnexpectedErrors(resolve, {
        onError: reject,
        ignoredErrors: [CHROME_ERROR.INVALID_BOUNDS],
      }),
    );
  });

const getCloudSettings = (userSettings) => {
  if (!isCloud()) {
    return {};
  }

  return {
    top: userSettings.windowPositionTop,
    left: userSettings.windowPositionLeft,
  };
};

const getWindowSize = (projectSettings, screenSizeType) => {
  if (screenSizeType === SCREEN_RESOLUTION_TYPE.DESKTOP) {
    return {
      width: projectSettings.browserWidth,
      height: projectSettings.browserHeight,
    };
  }
  return {
    width: projectSettings.mobileBrowserWidth,
    height: projectSettings.mobileBrowserHeight,
  };
};

export const open = async ({
  projectSettings,
  testId,
  incognitoMode = null,
  testRunId = null,
  url,
  userSettings = {},
  screenSizeType,
}) => {
  const windowOptions = {
    type: 'normal',
    focused: true,
    incognito: incognitoMode !== null ? incognitoMode : projectSettings.incognitoMode,
    url,
    ...getWindowSize(projectSettings, screenSizeType),
    ...getCloudSettings(userSettings),
  };

  let windowObject = await create(windowOptions);
  if (!windowObject) {
    windowObject = await create(omit(['top', 'left'], windowOptions));
  }

  const newTabId = windowObject.tabs[0].id;
  const viewport = {
    innerWidth: windowObject.tabs[0].width,
    innerHeight: windowObject.tabs[0].height,
  };

  dispatch(
    ExtensionActions.addTabSucceeded(
      newTabId,
      windowObject.id,
      projectSettings.projectId,
      testId,
      viewport,
      testRunId,
    ),
  );

  return { tabId: newTabId, windowId: windowObject.id };
};

export const get = (windowId) =>
  new Promise((resolve, reject) => {
    chrome.windows.get(windowId, catchUnexpectedErrors(resolve, { onError: reject }));
  });

export const update = (windowId, options) => {
  const windowOptions = {
    ...options,
  };
  return new Promise((resolve, reject) => {
    chrome.windows.update(
      windowId,
      windowOptions,
      catchUnexpectedErrors(resolve, {
        onError: reject,
        ignoredErrors: [CHROME_ERROR.NO_WINDOW_WITH_ID, CHROME_ERROR.NO_TAB_WITH_ID],
      }),
    );
  });
};

export const remove = (windowId) =>
  new Promise((resolve, reject) => {
    chrome.windows.remove(
      windowId,
      catchUnexpectedErrors(resolve, {
        onError: reject,
        ignoredErrors: [CHROME_ERROR.NO_WINDOW_WITH_ID, CHROME_ERROR.NO_TAB_WITH_ID],
      }),
    );
  });

export const getList = (query = {}) =>
  new Promise((resolve, reject) => {
    chrome.windows.getAll(
      query,
      catchUnexpectedErrors(resolve, {
        onError: reject,
      }),
    );
  });

export const getAllInIncognitoMode = () =>
  new Promise((resolve, reject) => {
    chrome.windows.getAll(
      {},
      catchUnexpectedErrors((windows) => resolve(windows.filter(prop('incognito'))), {
        onError: reject,
      }),
    );
  });

export const hasOpenedIncognitoWindows = async () => {
  const state = StoreRegistry.getBackgroundState();
  const nonangelosIncognitoWindows = (await getAllInIncognitoMode()).filter(
    ({ id }) => !selectIsWindowUnderControl(id)(state),
  );
  return !!nonangelosIncognitoWindows.length;
};

export const closeAllInIncognitoMode = async () => {
  const windows = await getAllInIncognitoMode();
  await Promise.all(windows.map((windowObj) => remove(windowObj.id)));
};

export const getCurrent = () =>
  new Promise((resolve, reject) => {
    chrome.windows.getCurrent(
      catchUnexpectedErrors(resolve, {
        onError: reject,
        ignoredErrors: [CHROME_ERROR.NO_CURRENT_WINDOW],
      }),
    );
  });
