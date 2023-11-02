import { is } from 'ramda';

import { MAIN_FRAME_DATA } from '~/constants/test';
import { CoreActions } from '~/modules/core';
import { selectFrameById, selectIsSelenium } from '~/modules/extension/extension.selectors';
import StoreRegistry, { STORE_TYPES } from '~/modules/storeRegistry';
import { selectUserToken } from '~/modules/user/user.selectors';
import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import { CHROME_ERROR, serializeError } from '~/utils/errors';

export const getState = () => StoreRegistry.get(STORE_TYPES.BACKGROUND).getState();
export const dispatch = (...args) => StoreRegistry.get(STORE_TYPES.BACKGROUND).dispatch(...args);

export const emitActionsToContent = (store) => (next) => (action) => {
  if (
    action.type &&
    action.type.startsWith('CONTENT/') &&
    action.source !== 'content' &&
    action.tabId
  ) {
    const { tabId } = action;
    const options = is(Number, action.frameId) ? { frameId: action.frameId } : {};
    chrome.tabs.sendMessage(parseInt(tabId, 10), action, options).catch((error) => {
      const state = store.getState();
      const isFrameInitialized = selectFrameById(state)(action.frameId ?? MAIN_FRAME_DATA.frameId);
      const serializedError = serializeError(error);
      const details = { issuer: { action } };

      if (!isFrameInitialized && error.message.startsWith(CHROME_ERROR.NO_ACTIVE_PORT)) {
        // eslint-disable-next-line no-console
        console.debug(
          'Content script is not initialized in frame, so the message could not be sent.',
        );
      } else {
        store.dispatch(CoreActions.captureException(serializedError, null, details));
      }
    });
  }
  return next(action);
};

export const reconnectWebsocket = () => {
  const state = getState();
  const isSelenium = selectIsSelenium(state);
  const token = selectUserToken(state);
  if (!isSelenium && token) {
    dispatch(WebsocketActions.connectRequested());
  }
};
