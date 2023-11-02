import { store } from '~/background/store';
import {
  EXCLUDED_EXTERNAL_URLS,
  EXCLUDED_BROWSER_URLS,
  ABOUT_PAGE_URL,
  NEW_TAB_URLS,
  EXCLUDED_FRAME_FILE_EXTENSIONS,
} from '~/constants/browser';
import { STEP_TYPE, MAIN_FRAME_LOCATION } from '~/constants/test';
import { BackgroundActions } from '~/modules/background/background.redux';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import { selectActiveWebAppTabs, selectFrameById } from '~/modules/extension/extension.selectors';
import { RecorderActions } from '~/modules/recorder/recorder.redux';
import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import storage from '~/services/browser/storage';
import { queryTabsByUrl } from '~/services/browser/tabs';
import Logger from '~/services/logger';
import { WEBSOCKET_CLOSED_REASON } from '~/services/websocketConnection/websocketConnection';
import { catchUnexpectedErrors, CHROME_ERROR, isContentAccessError } from '~/utils/errors';
import { genFrontId, sleep } from '~/utils/misc';

const logger = Logger.get('Background Helpers');

const MAX_FRAME_STATE_CHECK_ATTEMPTS = 10;

export const reloadWebappPages = async () => {
  try {
    const tabs = await queryTabsByUrl(process.env.QUERY_APP_TABS_URL);
    tabs.forEach((tabObj) => {
      if (!tabObj.url.includes(process.env.ADMIN_PANEL_PATH)) {
        chrome.tabs.reload(tabObj.id);
      }
    });
  } catch (error) {
    logger.debug('Error while reloading pages', error);
  }
};

export const closeWebsocketConnectionWhenNoActiveApp = (tabId) => {
  store.dispatch(ExtensionActions.removeActiveWebAppTab(tabId));

  const state = store.getState();
  const activeWebAppTabs = selectActiveWebAppTabs(state);
  const activeWebAppTabsList = Object.keys(activeWebAppTabs);

  if (
    !activeWebAppTabsList.length ||
    (activeWebAppTabsList.length === 1 && activeWebAppTabsList.includes(String(tabId)))
  ) {
    store.dispatch(WebsocketActions.disconnectRequested(WEBSOCKET_CLOSED_REASON.WEBAPP_INACTIVE));
  }
};

export const emitRunningPageNavigationCommitted = (testRunId, tabId, frameId) => {
  store.dispatch(BackgroundActions.pageNavigationCommitted(testRunId, tabId, frameId));
};

export const emitRunningPageNavigationCompleted = (testRunId, tabId, frameId) => {
  store.dispatch(BackgroundActions.pageNavigationCompleted(testRunId, tabId, frameId));
};

export const runBackgroundScriptInFrame = (tabId, frameId, func, ...funcArgs) =>
  new Promise((resolve, reject) => {
    const onWarning = (error) => {
      if (isContentAccessError(error)) {
        logger.debug('[runBackgroundScriptInFrame] Content access frame', frameId);
      }
      // https://developer.chrome.com/docs/extensions/reference/scripting/#type-InjectionResult
      resolve([{ result: null }]);
    };

    chrome.scripting.executeScript(
      {
        target: { tabId, frameIds: [frameId] },
        injectImmediately: true,
        func,
        args: funcArgs ?? [],
        world: 'MAIN',
      },
      catchUnexpectedErrors(resolve, {
        onError: reject,
        onWarning,
        ignoredErrors: [
          CHROME_ERROR.FRAME_WAS_REMOVED_LEGACY,
          CHROME_ERROR.FRAME_WAS_REMOVED,
          CHROME_ERROR.NO_FRAME_WITH_ID,
          CHROME_ERROR.TAB_WAS_CLOSED,
          CHROME_ERROR.NO_TAB_WITH_ID,
        ],
      }),
    );
  });

export const injectOverrides = async (
  tabId,
  frameId,
  projectSettings = {},
  projectFeatureFlags = {},
) => {
  const src = chrome.runtime.getURL('injection.js');
  const prepareOverrides = (injectionSrc, settings, featureFlags) => {
    Object.defineProperty(window, '_angelosSettings', {
      value: settings,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, '_angelosFeatureFlags', {
      value: featureFlags,
      writable: true,
      configurable: true,
    });

    const script = document.createElement('script');
    script.setAttribute('src', injectionSrc);
    script.setAttribute('type', 'text/javascript');
    document.getElementsByTagName('head')[0].appendChild(script);
  };
  return runBackgroundScriptInFrame(
    tabId,
    frameId,
    prepareOverrides,
    src,
    projectSettings,
    projectFeatureFlags,
  );
};

export const isFrameLoaded = async (tabId, frameId, attemptNo = 1) => {
  const checkIfDomIsReady = () => document.readyState === 'complete';
  const results = await runBackgroundScriptInFrame(tabId, frameId, checkIfDomIsReady);

  if (results?.[0]?.result) {
    return true;
  }

  if (attemptNo === MAX_FRAME_STATE_CHECK_ATTEMPTS) {
    logger.debug('Frame', frameId, 'did not load properly.');
    return false;
  }

  await sleep(500);
  return isFrameLoaded(tabId, frameId, attemptNo + 1);
};

export const isTrackerFrame = async (tabId, frameId, maxAttempts = 1, attemptNo = 1) => {
  const checkIfTrackerInWebSiteContext = () =>
    !document.documentElement.clientHeight && !document.documentElement.clientWidth;
  const results = await runBackgroundScriptInFrame(tabId, frameId, checkIfTrackerInWebSiteContext);

  if (!results?.[0]?.result) {
    return false;
  }

  if (attemptNo === maxAttempts) {
    logger.debug('Frame', frameId, 'detected as tracker frame after', attemptNo, 'attempts.');
    return true;
  }
  await sleep(1000);
  return isTrackerFrame(tabId, frameId, maxAttempts, attemptNo + 1);
};

export const loadContentScripts = async (
  details,
  isRecording = false,
  projectSettings = {},
  featureFlags = {},
) => {
  const isRootFrame = details.frameId === 0;
  /*
    Dynamically created iframes without src attribute return `about:` url
    but they are still valid frames eg. siepomaga.pl
  */
  const isValidChildFrame = !isRootFrame && details.url.startsWith(ABOUT_PAGE_URL);

  if (
    (!isValidChildFrame && EXCLUDED_BROWSER_URLS.some((url) => details.url.startsWith(url))) ||
    EXCLUDED_EXTERNAL_URLS.some((url) => details.url.includes(url)) ||
    EXCLUDED_FRAME_FILE_EXTENSIONS.some((extension) => details.url.endsWith(`.${extension}`))
  ) {
    return;
  }

  if (!isRootFrame) {
    try {
      logger.debug('Checking if frame', details.frameId, 'is loaded\n', details.url);
      const result = await isFrameLoaded(details.tabId, details.frameId);
      logger.debug('Frame is loaded:', details.frameId, result);
    } catch (error) {
      logger.debug(
        'Error while checking if frame is loaded',
        details.frameId,
        details.url,
        details,
      );
      throw error;
    }

    try {
      logger.debug('Checking if frame', details.frameId, 'is tracker frame\n', details.url);
      if (await isTrackerFrame(details.tabId, details.frameId, projectSettings.runTimeout)) {
        store.dispatch(
          ExtensionActions.addTrackerFrameSucceeded(details.tabId, details.frameId, details.url),
        );
        return;
      }
    } catch (error) {
      logger.debug('Error while checking if frame is tracker frame', details.frameId, details.url);
      throw error;
    }
  }

  try {
    await injectOverrides(details.tabId, details.frameId, projectSettings, featureFlags);
  } catch (error) {
    logger.error('Error while overriding DOM prototypes', error);
  }

  const handleResponse = catchUnexpectedErrors(null, {
    ignoredErrors: [
      CHROME_ERROR.FRAME_WAS_REMOVED,
      CHROME_ERROR.FRAME_WAS_REMOVED_LEGACY,
      CHROME_ERROR.NO_FRAME_WITH_ID,
      CHROME_ERROR.TAB_WAS_CLOSED,
      CHROME_ERROR.NO_TAB_WITH_ID,
    ],
  });

  const files = ['content.js'];
  if (isRecording && isRootFrame) {
    files.push('recordingMessage.js');
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: details.tabId, frameIds: [details.frameId] },
      injectImmediately: true,
      files,
    },
    handleResponse,
  );
};

export const recordGotoStep = (details, url) => {
  chrome.tabs.get(
    details.tabId,
    catchUnexpectedErrors(() => {
      store.dispatch(
        RecorderActions.addEventRequested({
          timestamp: new Date().getTime(),
          type: STEP_TYPE.GOTO,
          tabId: details.tabId,
          url,
          isTrusted: true,
          frontId: genFrontId(),
        }),
      );
    }),
  );
};

export const recordSwitchContext = (tab) => {
  chrome.tabs.get(
    tab.tabId,
    catchUnexpectedErrors((tabInfo) => {
      if (!NEW_TAB_URLS.includes(tabInfo.pendingUrl) && tabInfo.openerTabId) {
        storage.set(
          'action',
          RecorderActions.addEventRequested({
            timestamp: Date.now(),
            type: STEP_TYPE.SWITCH_CONTEXT,
            tabId: tab.tabId,
            frameLocation: MAIN_FRAME_LOCATION,
            isTrusted: true,
            frontId: genFrontId(),
          }),
        );
      }
    }),
  );
};

export const removeFrame = (details) => {
  const state = store.getState();
  const frameObj = selectFrameById(details.tabId, details.frameId)(state);
  if (frameObj) {
    store.dispatch(ExtensionActions.removeFrameSucceeded(details.tabId, details.frameId));
  }
};
