/* eslint-disable camelcase */
import { batch } from 'react-redux';

import {
  closeWebsocketConnectionWhenNoActiveApp,
  reloadWebappPages,
} from '~/background/background.helpers';
import { store } from '~/background/store';
import { EXCLUDED_NEW_TAB_URLS } from '~/constants/browser';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import { selectHasRunningTestRun } from '~/modules/runner/runner.selectors';
import { UserActions } from '~/modules/user/user.redux';
import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import { selectWebsocketIsConnected } from '~/modules/websocket/websocket.selectors';
import browser from '~/services/browser';
import * as browserDetails from '~/services/browser/details';
import * as tabs from '~/services/browser/tabs';
import * as windows from '~/services/browser/windows';
import Logger from '~/services/logger';
import { WEBSOCKET_CLOSED_REASON } from '~/services/websocketConnection/websocketConnection';
import { isCloud } from '~/utils/env';

const logger = Logger.get('Runtime Handlers');

const ONBOARDING_REDIRECT_URL = `${process.env.WEBAPP_HOME_URL}onboarding/redirect/`;

const getUrlOfTabWithExtensionModal = async () => {
  const appTabs = await browser.tabs.queryTabsByUrl(process.env.QUERY_APP_TABS_URL);
  return appTabs.find(({ url }) => url.includes('installExtension'))?.url;
};

const isChromeStoreTabOpened = async () => {
  const storeTabs = await browser.tabs.queryTabsByUrl(process.env.CHROME_WEBSTORE_URL);
  return storeTabs.some(({ url }) => url.includes(chrome.runtime.id));
};

const setup = async (wasInstalled, wasEnabled = false) => {
  if (isCloud()) {
    return;
  }

  const windowsList = await windows.getList({ populate: true });
  const hasNotOpenenedWindows = !windowsList.length;
  const hasOpenedSingleWindowWithNewTab =
    windowsList.length === 1 &&
    windowsList[0].tabs?.length === 1 &&
    EXCLUDED_NEW_TAB_URLS.includes(windowsList[0].tabs[0]?.url);

  if (hasNotOpenenedWindows || hasOpenedSingleWindowWithNewTab) {
    logger.info('Setup cancelled due to window states');
    return;
  }

  const tabWithExtensionModalUrl = await getUrlOfTabWithExtensionModal();
  const isStoreTabOpened = await isChromeStoreTabOpened();
  const angelosExtPrevIncognitoAccess =
    (await browser.storage.getPersistentValue(
      browser.STORAGE_DATA_TYPE.EXT_PREV_INCOGNITO_ACCESS,
    )) ?? (await browser.storage.get(browser.STORAGE_DATA_TYPE.EXT_PREV_INCOGNITO_ACCESS));

  logger.debug('Reloading webapp...', wasInstalled, wasEnabled);
  await reloadWebappPages();

  // Check if user activated incognito access
  const { isAllowedIncognitoAccess } = await browserDetails.get();
  const hasIncognitoAccessBeenActivated = !angelosExtPrevIncognitoAccess && isAllowedIncognitoAccess;
  await browser.storage.setPersistentValue(
    browser.STORAGE_DATA_TYPE.EXT_PREV_INCOGNITO_ACCESS,
    isAllowedIncognitoAccess,
  );

  const isOnboardingProcess = isStoreTabOpened || tabWithExtensionModalUrl;
  const shouldFocusOrOpenTab =
    isOnboardingProcess && (wasInstalled || wasEnabled || hasIncognitoAccessBeenActivated);

  if (shouldFocusOrOpenTab) {
    logger.info('Trying to back to previous tab', wasInstalled, hasIncognitoAccessBeenActivated);
    const angelosExtSetupInitiator = tabWithExtensionModalUrl ?? ONBOARDING_REDIRECT_URL;

    await tabs.focusTabWithUrl({
      url: angelosExtSetupInitiator,
      createIfNotExists: wasInstalled || hasIncognitoAccessBeenActivated,
    });
  }
};

const RuntimeHandlers = {
  setup,

  onActionFromContent: (msg, sender) => {
    if (sender.tab) {
      // eslint-disable-next-line no-param-reassign
      msg.tabId = sender.tab.id;
    }

    store.dispatch({
      ...msg.action,
      _sender: sender,
      source: 'content',
    });
  },

  onConnectSelenium: (msg) => {
    batch(() => {
      store.dispatch(ExtensionActions.registerSeleniumSucceeded());
      store.dispatch(UserActions.loginSucceeded(msg.token));
      store.dispatch(WebsocketActions.connectRequested(msg.seleniumKey));
    });
  },

  onDisconnectSelenium: () => {
    store.dispatch(
      WebsocketActions.disconnectRequested(WEBSOCKET_CLOSED_REASON.SELENIUM_DISCONNECTED),
    );
  },

  onConnectWebapp: (msg, sender) => {
    if (!msg.token) {
      batch(() => {
        store.dispatch(UserActions.logoutSucceeded());
        store.dispatch(WebsocketActions.disconnectRequested(WEBSOCKET_CLOSED_REASON.INVALID_TOKEN));
      });
    } else {
      const state = store.getState();
      const isWebsocketConnected = selectWebsocketIsConnected(state);

      batch(() => {
        store.dispatch(UserActions.loginSucceeded(msg.token));
        if (!isWebsocketConnected) {
          store.dispatch(ExtensionActions.addActiveWebAppTab(sender.tab.id));
          store.dispatch(WebsocketActions.connectRequested());
        } else {
          store.dispatch(WebsocketActions.sendWebsocketIdToWebappRequested());
        }
      });
    }
  },

  onOpenSettings: () => {
    store.dispatch(ExtensionActions.openSettingsRequested());
  },

  onRegisterWebAppSession: (msg, sender) => {
    store.dispatch(ExtensionActions.addActiveWebAppTab(sender.tab.id));
    store.dispatch(ExtensionActions.sendSettingsToWebappRequested());

    const state = store.getState();
    const isConnected = selectWebsocketIsConnected(state);
    if (!isConnected) {
      store.dispatch(WebsocketActions.connectRequested());
    }
  },

  onUnregisterWebAppSession: (msg, sender) => {
    closeWebsocketConnectionWhenNoActiveApp(sender.tab.id);
  },

  onGetIncognitoWindowsStatus: async () => browser.windows.hasOpenedIncognitoWindows(),

  onStartup: async () => {
    logger.info('Browser started up');
  },

  onInstalled: async (details) => {
    const envs = {
      API_WS_URL: process.env.API_WS_URL,
      API_HOST: process.env.API_HOST,
      API_REST_URL: process.env.API_REST_URL,
      QUERY_APP_TABS_URL: process.env.QUERY_APP_TABS_URL,
      WEBAPP_HOME_URL: process.env.WEBAPP_HOME_URL,
    };

    const wasInstalled = details.reason === chrome.runtime.OnInstalledReason.INSTALL;
    logger.debug(wasInstalled ? 'Installed:' : 'Updated:', details, '\nConfig:', envs);
    if (wasInstalled) {
      logger.info('Setup initialized after installation', details);
      await RuntimeHandlers.setup(true);
    }
  },

  onUpdateAvailable: (details) => {
    if (!RuntimeHandlers.isUpdating) {
      RuntimeHandlers.isUpdating = true;
      browser.alarms.setMinuteInterval(async (intervalId) => {
        const state = store.getState();
        const isRecording = selectIsRecording(state);
        const isRunning = selectHasRunningTestRun(state);
        if (!isRecording && !isRunning) {
          await browser.alarms.clearMinuteInterval(intervalId);
          RuntimeHandlers.isUpdating = false;
          chrome.runtime.reload();
          reloadWebappPages();
          logger.info('Extension updated after waiting for idle time', details);
        }
      });
    } else {
      chrome.runtime.reload();
      reloadWebappPages();
      logger.info('Extension updated in idle time', details);
    }
  },
};

export default RuntimeHandlers;
