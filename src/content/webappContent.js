import { proxyStore } from '~/content/store';
import domLayer from '~/services/domLayer';
import Logger from '~/services/logger';
import runtimeMessaging, * as command from '~/services/runtimeMessaging';
import { createPersistentPort } from '~/utils/extension';
import * as webapp from '~/utils/webapp';

const logger = Logger.get('WebappContent');

const handleConnectWithWebapp = (event, isRootFrame) => {
  if (isRootFrame) {
    runtimeMessaging.sendMessageToBackground({
      command: command.CONNECT_WITH_WEBAPP,
      token: event.data.token,
    });
  }
};

const handleOpenSettingsUrl = (isRootFrame) => {
  if (isRootFrame) {
    runtimeMessaging.sendMessageToBackground({
      command: command.OPEN_SETTINGS_URL,
    });
  }
};

const handleRegisterWebAppSession = (isRootFrame) => {
  if (isRootFrame) {
    runtimeMessaging.sendMessageToBackground({
      command: command.REGISTER_WEB_APP_SESSION,
    });
  }
};

const handleUnregisterWebAppSession = (isRootFrame) => {
  if (isRootFrame) {
    runtimeMessaging.sendMessageToBackground({
      command: command.UNREGISTER_WEB_APP_SESSION,
    });
  }
};

const handleGetIncognitoWindowsStatus = async (isRootFrame, event) => {
  if (isRootFrame) {
    let hasIncognitoWindows;
    try {
      hasIncognitoWindows = await runtimeMessaging.sendMessageToBackground({
        command: command.GET_INCOGNITO_WINDOWS_STATUS,
      });
    } catch (error) {
      hasIncognitoWindows = false;
    }
    domLayer.postMessage(
      {
        type: command.GET_INCOGNITO_WINDOWS_STATUS_RESULT,
        hasIncognitoWindows,
        meta: event.meta,
      },
      '*',
    );
  }
};

const handleMessage = (event) => {
  if (
    !event.data ||
    typeof event.data !== 'object' ||
    !process.env.WEBAPP_HOME_URL.includes(event.origin)
  ) {
    return;
  }

  const isRootFrame = !domLayer.isInIframe();
  switch (event.data.type) {
    case command.CONNECT_WITH_WEBAPP: {
      handleConnectWithWebapp(event, isRootFrame);
      break;
    }
    case command.OPEN_SETTINGS_URL: {
      handleOpenSettingsUrl(isRootFrame);
      break;
    }
    case command.REGISTER_WEB_APP_SESSION: {
      handleRegisterWebAppSession(isRootFrame);
      break;
    }
    case command.UNREGISTER_WEB_APP_SESSION: {
      handleUnregisterWebAppSession(isRootFrame);
      break;
    }
    case command.GET_INCOGNITO_WINDOWS_STATUS: {
      handleGetIncognitoWindowsStatus(isRootFrame, event.data);
      break;
    }
    default:
      break;
  }
};

const handleBackgroundMessage = (msg, sender) => {
  logger.info('Have message from background', msg, sender);
  domLayer.postMessage(msg, '*');
};

const closeWebappSession = () => {
  chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
  domLayer.removeEventListener('message', handleMessage);
  webapp.sendExtensionSettingsToWebapp({}, false);
};

const initWebappSession = () => {
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  domLayer.addEventListener('message', handleMessage);

  createPersistentPort('webappContent', () => {
    closeWebappSession();
    logger.debug('Connection with background.js aborted');
  });
};

proxyStore.ready().then(() => {
  if (!document.head) {
    return;
  }
  initWebappSession();
});
