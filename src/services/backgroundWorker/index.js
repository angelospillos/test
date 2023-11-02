/* eslint-disable no-underscore-dangle */
import * as Sentry from '@sentry/browser';

import {
  LoggerHandlers,
  DebuggerHandlers,
  RuntimeHandlers,
  StorageHandlers,
  TabsHandlers,
  WebNavigationHandlers,
  WindowsHandlers,
} from '~/background/handlers';
import ContentHandlers from '~/background/handlers/content.handlers';
import storage from '~/services/browser/storage';
import { catchUnexpectedErrors } from '~/utils/errors';
import { extendListener } from '~/utils/extension';

import BaseService from '../baseService';
import featureFlags from '../featureFlags/featureFlags';
import runtimeMessaging, * as command from '../runtimeMessaging';

import offscreen from './offscreen';

const BATCH_LOGS_WATCHER_INTERVAL = 5000;

class BackgroundWorker extends BaseService {
  constructor() {
    super('BackgroundWorker');
  }

  setup = () => {
    this.logDebug('Initializing setup...');
    this.#setupWorkerListeners();
    this.#setupBrowserListeners();
    this.logDebug('Worker script is ready.');
  };

  initKeepingWorkerAwake = async () => {
    this.logInfo('Init keeping worker awake');

    // First solution using port reconnecting
    const deleteTimer = (port) => {
      if (port._timer) {
        clearTimeout(port._timer);
        // eslint-disable-next-line no-param-reassign
        delete port._timer;
      }
    };

    const forceReconnect = (port) => {
      this.logInfo('Force reconnecting port', port.name);
      deleteTimer(port);
      port.disconnect();
    };

    chrome.runtime.onConnect.addListener((port) => {
      if (['content', 'webappContent'].includes(port.name)) {
        port.onDisconnect.addListener(deleteTimer);
        // eslint-disable-next-line no-param-reassign
        port._timer = setTimeout(forceReconnect, 250e3, port);
      }
    });

    // Second solution using offscreen API
    await offscreen.createOffscreen();
  };

  initBatchLogsWatcher = () => {
    this.logDebug('Logs batcher initiated');
    setInterval(() => {
      if (featureFlags.isEnabled('runLogs')) {
        this.logDebug('Checking logs size...');
        if (this.shouldSendLogs()) {
          LoggerHandlers.onBatch();
        }
      }
    }, BATCH_LOGS_WATCHER_INTERVAL);
  };

  refreshWebappIfNeeded = async () => {
    /*
      Extension's lifecycle:

      - extension installed -> RuntimeHandlers.onInstalled
      - extension updated to a new version -> RuntimeHandlers.onInstalled
      - extension enabled (already installed but disabled for some reason) -> RuntimeHandlers.setup(false, true)
      - activated incognito mode => RuntimeHandlers.setup(false, true)
    */
    const currentVersion = chrome.runtime.getManifest().version;
    const prevVersion = await storage.getPersistentValue('prevVersion');

    if (prevVersion === currentVersion) {
      this.logInfo('Enabled', currentVersion);
      this.logInfo('Setup initialized after enabling extension or changing incognito settings');
      RuntimeHandlers.setup(false, true);
    }
    await storage.setPersistentValue('prevVersion', currentVersion);
    this.logDebug('Setup finished successfully');
  };

  #setupWorkerListeners = () => {
    // eslint-disable-next-line no-restricted-globals
    self.addEventListener('unhandledrejection', (event) => {
      this.logError('background.js unhandledrejection', event.reason);
      Sentry.captureEvent(event.reason);
    });

    // eslint-disable-next-line no-restricted-globals
    self.addEventListener('error', (error) => {
      this.logError('background.js error', error);
      Sentry.captureException(error);
    });

    // eslint-disable-next-line no-restricted-globals
    self.addEventListener('install', () => self.skipWaiting());
    this.logDebug('Worker listeners initiated.');
  };

  #setupBrowserListeners = () => {
    // Runtime handlers
    chrome.runtime.onInstalled.addListener(catchUnexpectedErrors(RuntimeHandlers.onInstalled));
    chrome.runtime.onUpdateAvailable.addListener(
      catchUnexpectedErrors(RuntimeHandlers.onUpdateAvailable),
    );
    chrome.runtime.onStartup.addListener(catchUnexpectedErrors(RuntimeHandlers.onStartup));

    // WebNavigation handlers
    chrome.webNavigation.onBeforeNavigate.addListener(
      extendListener(WebNavigationHandlers.onBeforeNavigate),
    );
    chrome.webNavigation.onDOMContentLoaded.addListener(
      extendListener(WebNavigationHandlers.onDOMContentLoaded),
    );
    chrome.webNavigation.onCommitted.addListener(extendListener(WebNavigationHandlers.onCommitted));
    chrome.webNavigation.onCompleted.addListener(extendListener(WebNavigationHandlers.onCompleted));
    chrome.webNavigation.onHistoryStateUpdated.addListener(
      extendListener(WebNavigationHandlers.onHistoryStateUpdated),
    );

    // TabsH handlers
    chrome.tabs.onCreated.addListener(extendListener(TabsHandlers.onCreated));
    chrome.tabs.onActivated.addListener(extendListener(TabsHandlers.onActivated));
    chrome.tabs.onRemoved.addListener(extendListener(TabsHandlers.onRemoved));
    chrome.tabs.onUpdated.addListener(extendListener(TabsHandlers.onUpdated));
    chrome.tabs.onZoomChange.addListener(extendListener(TabsHandlers.onZoomChange));
    chrome.windows.onRemoved.addListener(extendListener(WindowsHandlers.onRemoved));
    chrome.windows.onFocusChanged.addListener(extendListener(WindowsHandlers.onFocusChanged));

    // Debugger handlers
    chrome.debugger.onDetach.addListener(extendListener(DebuggerHandlers.onDetach));

    // Storage handlers
    storage.onChanged(extendListener(StorageHandlers.onChanged));

    // Runtime messaging handlers
    runtimeMessaging.onMessage(command.CONNECT_SELENIUM, RuntimeHandlers.onConnectSelenium);
    runtimeMessaging.onMessage(command.DISCONNECT_SELENIUM, RuntimeHandlers.onDisconnectSelenium);
    runtimeMessaging.onMessage(command.DISPATCH_IN_BACKGROUND, RuntimeHandlers.onActionFromContent);
    runtimeMessaging.onMessage(command.CONNECT_WITH_WEBAPP, RuntimeHandlers.onConnectWebapp);
    runtimeMessaging.onMessage(command.OPEN_SETTINGS_URL, RuntimeHandlers.onOpenSettings);
    runtimeMessaging.onMessage(
      command.REGISTER_WEB_APP_SESSION,
      RuntimeHandlers.onRegisterWebAppSession,
    );
    runtimeMessaging.onMessage(
      command.UNREGISTER_WEB_APP_SESSION,
      RuntimeHandlers.onUnregisterWebAppSession,
    );
    runtimeMessaging.onMessage(command.PING_FROM_CONTENT);
    runtimeMessaging.onMessage(command.KEEP_ALIVE_FROM_OFFSCREEN);
    runtimeMessaging.onAsyncMessage(
      command.GET_INCOGNITO_WINDOWS_STATUS,
      RuntimeHandlers.onGetIncognitoWindowsStatus,
    );

    // Content handlers
    runtimeMessaging.onAsyncMessage(command.EXECUTE_CODE, ContentHandlers.onExecute);
    runtimeMessaging.onAsyncMessage(
      command.GET_LATEST_DOWNLOADED_FILES,
      ContentHandlers.onGetLatestDownloadedFiles,
    );
    runtimeMessaging.onAsyncMessage(
      command.GET_EVENT_LISTENERS,
      ContentHandlers.onGetEventListeners,
    );
    this.logDebug('Browser listeners initiated.');
  };
}

export default new BackgroundWorker();
