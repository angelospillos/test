import { TAB_STATUS } from '~/constants/browser';
import { TABS_API_RETRY_TIME } from '~/constants/test';
import {
  catchUnexpectedErrors,
  CHROME_ERROR,
  hasExpectedChromeErrorOccurred,
  captureExceptionAsWarning,
} from '~/utils/errors';
import { sleep, createCompleteStepUrl } from '~/utils/misc';

import { isExcludedUrl } from './browser.helpers';
import * as windows from './windows';

const resolveOrRetryTabHandler =
  (resolve, reject, callAction, ...actionArgs) =>
  async (result) => {
    if (hasExpectedChromeErrorOccurred([CHROME_ERROR.TABS_CANNOT_BE_QUERIED])) {
      await sleep(TABS_API_RETRY_TIME);
      try {
        const retryResult = await callAction(...actionArgs);
        resolve(retryResult);
      } catch (e) {
        reject(e);
      }
    } else {
      resolve(result);
    }
  };

export const queryTabs = (query = {}) =>
  new Promise((resolve, reject) => {
    chrome.tabs.query(
      query,
      catchUnexpectedErrors(resolveOrRetryTabHandler(resolve, reject, queryTabs, query), {
        onError: reject,
        ignoredErrors: [CHROME_ERROR.TABS_CANNOT_BE_QUERIED],
      }),
    );
  });
export const queryTabsByUrl = (url, currentWindow) => queryTabs({ url, currentWindow });

export const getCurrent = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.getCurrent(catchUnexpectedErrors(resolve, { onError: reject }));
  });

export const create = (windowId, step, ignoreUrlTransform = false) =>
  new Promise((resolve, reject) => {
    const url = ignoreUrlTransform ? step.url : createCompleteStepUrl(step);

    const onResolve = async (data = {}) => {
      if (chrome.runtime?.lastError?.message?.includes(CHROME_ERROR.NO_CURRENT_WINDOW)) {
        const [currentWindow, windowsList] = await Promise.all([
          windows.getCurrent(),
          windows.getList(),
        ]);
        captureExceptionAsWarning(
          { message: CHROME_ERROR.NO_CURRENT_WINDOW },
          {
            browserApi: { currentWindow, windowsList },
          },
        );
      }
      resolve(data);
    };

    chrome.tabs.create(
      { windowId, url },
      catchUnexpectedErrors(onResolve, {
        onError: reject,
        ignoredErrors: [CHROME_ERROR.NO_CURRENT_WINDOW],
      }),
    );
  });

export const update = (tabId, params = {}) =>
  new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, params, catchUnexpectedErrors(resolve, { onError: reject }));
  });

export const remove = (tabId) =>
  new Promise((resolve, reject) => {
    if (tabId === undefined) {
      console.debug('Tab id is undefined. Skipping tab removal.');
      resolve();
      return;
    }
    chrome.tabs.remove(tabId, catchUnexpectedErrors(resolve, { onError: reject }));
  });

export const resetTabZoomSettings = async (tabId) => {
  const REQUIRED_ZOOM_LEVEL = 1;
  const getCallback = (resolve, reject) =>
    catchUnexpectedErrors(resolve, {
      onError: reject,
      ignoredErrors: [CHROME_ERROR.NO_TAB_WITH_ID],
    });
  const currentZoomLevel = await new Promise((resolve, reject) => {
    chrome.tabs.getZoom(tabId, getCallback(resolve, reject));
  });

  if (currentZoomLevel !== REQUIRED_ZOOM_LEVEL) {
    return new Promise((resolve, reject) => {
      chrome.tabs.setZoom(tabId, REQUIRED_ZOOM_LEVEL, getCallback(resolve, reject));
    });
  }

  return Promise.resolve();
};

export const focusTabWithUrl = async ({
  url = process.env.WEBAPP_HOME_URL,
  createIfNotExists = false,
  currentWindow,
}) => {
  const tabs = await queryTabsByUrl(url, currentWindow);
  if (tabs.length) {
    return update(tabs[0].id, { active: true });
  }
  if (createIfNotExists) {
    return create(undefined, { url }, true);
  }
  return {};
};

export const goto = ({ tabId, step }) =>
  new Promise((resolve, reject) => {
    const gotoExecutor = (activeTabId) => {
      const listener = (changeTabId, changeInfo) => {
        if (
          changeTabId === activeTabId &&
          changeInfo.status === TAB_STATUS.LOADING &&
          (changeInfo.url === undefined || !isExcludedUrl(changeInfo.url))
        ) {
          /**
           * loading (instead complete) is better when page is already rendered but
           * the browser is still waiting for some external JS sources like facebook
           *
           * changeInfo.url === undefined => this is true when current url is the same as
           * the url from step
           */
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      const url = createCompleteStepUrl(step);
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.update(
        activeTabId,
        { url },
        catchUnexpectedErrors(null, {
          onError: reject,
          ignoredErrors: [CHROME_ERROR.NO_TAB_WITH_ID],
        }),
      );
    };

    gotoExecutor(tabId);
  });

export const isOpen = async (tabId) => {
  try {
    await new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, () => {
        if (chrome.runtime.lastError) {
          reject();
        } else {
          resolve();
        }
      });
    });
    return true;
  } catch {
    return false;
  }
};
