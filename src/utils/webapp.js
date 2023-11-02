import { CoreActions } from '~/modules/core';
import storeRegistry from '~/modules/storeRegistry';
import { queryTabsByUrl } from '~/services/browser/tabs';
import domLayer from '~/services/domLayer';
import logger from '~/services/logger';

import { CHROME_ERROR, serializeError } from './errors';

export const sendMessageToWebapp = async (message = {}) => {
  try {
    const tabs = await queryTabsByUrl(process.env.QUERY_APP_TABS_URL);
    tabs.forEach((tabObj) => {
      chrome.tabs.sendMessage(tabObj.id, message).catch((error) => {
        const serializedError = serializeError(error);
        const details = { issuer: { message, webappTabs: tabs } };

        if (error.message.startsWith(CHROME_ERROR.NO_ACTIVE_PORT)) {
          // eslint-disable-next-line no-console
          console.debug(
            'Webapp content script is not initialized in frame, so the message could not be sent.',
            process.env.QUERY_APP_TABS_URL,
            tabs,
          );
        } else {
          storeRegistry.dispatchInBackground(
            CoreActions.captureException(serializedError, null, details),
          );
        }
      });
    });
  } catch (error) {
    logger.debug('Error while sending message to webapp', message, error);
  }
};

export const sendExtensionSettingsToWebapp = async (settings = {}, isBackground = true) => {
  const message = {
    type: 'UPDATE_EXTENSION_SETTINGS',
    settings,
  };
  if (isBackground) {
    await sendMessageToWebapp(message);
  } else {
    domLayer.postMessage(message);
  }
};
