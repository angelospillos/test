import storeRegistry from '~/modules/storeRegistry';
import { selectWebsocketIsConnected } from '~/modules/websocket/websocket.selectors';

import { catchUnexpectedErrors } from './errors';

export const extendListener = (callback, options) => {
  const listener = catchUnexpectedErrors(callback, options);

  return (...args) => {
    const state = storeRegistry.getBackgroundState();
    const isConnected = selectWebsocketIsConnected(state);

    if (isConnected) {
      return listener(...args);
    }
    return null;
  };
};

export const createPersistentPort = (name, onDisconnect) => {
  const reconnect = () => {
    const port = chrome.runtime.connect({ name });
    port.onDisconnect.addListener(() => {
      try {
        reconnect();
      } catch (error) {
        onDisconnect(port);
      }
    });
  };
  reconnect();
};
