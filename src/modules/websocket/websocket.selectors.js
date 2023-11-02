import { createSelector } from 'reselect';

const selectWebsocketDomain = (state) => state.websocket;

export const selectWebsocketIsConnected = createSelector(
  selectWebsocketDomain,
  (state) => state.connected,
);

export const selectWebsocketId = createSelector(
  selectWebsocketDomain,
  (state) => state.websocketId,
);
