import {
    all,
    call,
    delay,
    put,
    race,
    select,
    take,
    takeEvery,
    takeLeading,
    throttle,
  } from 'redux-saga/effects';
  
  import { ExtensionActions, ExtensionTypes } from '~/modules/extension/extension.redux';
  import {
    selectHasActiveWebAppTabs,
    selectIsSelenium,
    selectWindowsIdList,
  } from '~/modules/extension/extension.selectors';
  import { selectUserToken } from '~/modules/user/user.selectors';
  import {
    CHECK_WEBSOCKET_CONNECTION_LIMIT,
    DELAY_BETWEEN_RECONNECTION_MS,
  } from '~/modules/websocket/websocket.constants';
  import { initializeWebSocketChannel, sendWebsocketId } from '~/modules/websocket/websocket.helpers';
  import {
    selectWebsocketId,
    selectWebsocketIsConnected,
  } from '~/modules/websocket/websocket.selectors';
  import Logger from '~/services/logger';
  // eslint-disable-next-line prettier/prettier
  import websocketConnection, { WEBSOCKET_CLOSED_REASON } from '~/services/websocketConnection/websocketConnection';
  import { isCloud } from '~/utils/env';
  
  import { CoreActions } from '../core';
  
  import { WebsocketActions, WebsocketTypes } from './websocket.redux';
  
  export const logger = Logger.get('Websocket Sagas');
  
  export function* connectRequested({ seleniumKey }) {
    const hasActiveWebapp = yield select(selectHasActiveWebAppTabs);
    let reconnect = hasActiveWebapp || seleniumKey;
    while (reconnect) {
      const token = yield select(selectUserToken);
  
      if (!token) {
        logger.debug('Connection closed by invalid token');
        yield call(websocketConnection.close, WEBSOCKET_CLOSED_REASON.INVALID_TOKEN);
        yield put(WebsocketActions.disconnectSucceeded());
        reconnect = false;
        break;
      }
      const { disconnect } = yield race({
        finished: call(initializeWebSocketChannel, token, seleniumKey),
        disconnect: take(WebsocketTypes.DISCONNECT_SUCCEEDED),
      });
  
      if (disconnect) {
        reconnect = false;
      }
  
      if (websocketConnection.closeReason === WEBSOCKET_CLOSED_REASON.RUNTIME_ERROR) {
        logger.debug('Connection interrupted by runtime error');
      } else {
        logger.debug('Connection closed by backend');
      }
  
      if (reconnect) {
        yield delay(DELAY_BETWEEN_RECONNECTION_MS);
        logger.debug('Reconnecting!');
      }
    }
  }
  
  export function* onopenRequested() {
    yield put(WebsocketActions.onopenSucceeded());
    yield put(CoreActions.startHeartbeatRequested());
    yield put(ExtensionActions.updateSettingsRequested());
  
    const isSelenium = yield select(selectIsSelenium);
    if (!isSelenium) {
      yield put(WebsocketActions.sendWebsocketIdToWebappRequested());
    }
  }
  
  export function* oncloseRequested() {
    yield put(CoreActions.stopHeartbeatRequested());
    yield put(ExtensionActions.sendSettingsToWebappRequested());
    yield put(WebsocketActions.oncloseSucceeded());
  }
  
  export function* disconnectRequested({ reason }) {
    const windowsUnderControl = yield select(selectWindowsIdList);
    logger.info('[disconnectRequested] windowsUnderControl', windowsUnderControl);
  
    if (reason === WEBSOCKET_CLOSED_REASON.WEBAPP_INACTIVE && !!windowsUnderControl.length) {
      const actionsToContinueDisconnection = [ExtensionTypes.CLOSE_WINDOWS_SUCCEEDED];
      const actionsToAbortDisconnection = [
        ExtensionTypes.ADD_ACTIVE_WEB_APP_TAB,
        ExtensionTypes.RESTART_PENDING_DISCONNECTION_REQUESTED,
        WebsocketTypes.DISCONNECT_REQUESTED,
      ];
      const actionsToWait = [...actionsToContinueDisconnection, ...actionsToAbortDisconnection];
      const action = yield take(actionsToWait);
  
      if (actionsToContinueDisconnection.includes(action.type)) {
        const windowsUnderControlAfterWindowsClose = yield select(selectWindowsIdList);
        const hasActiveWebAppTabs = yield select(selectHasActiveWebAppTabs);
        if (hasActiveWebAppTabs || !!windowsUnderControlAfterWindowsClose.length) {
          return;
        }
      }
  
      if (actionsToAbortDisconnection.includes(action.type)) {
        if (action.type === ExtensionTypes.RESTART_PENDING_DISCONNECTION_REQUESTED) {
          // To re-initialize pending disconnect request while running tests one by one (suite, multiple selected tests).
          logger.debug('Re-initializing pending disconnect request...');
          const nextAction = yield take([
            ExtensionTypes.ADD_TAB_SUCCEEDED,
            ExtensionTypes.CLOSE_WINDOWS_SUCCEEDED,
          ]);
  
          if (nextAction.type === ExtensionTypes.ADD_TAB_SUCCEEDED) {
            yield call(disconnectRequested, { reason: WEBSOCKET_CLOSED_REASON.WEBAPP_INACTIVE });
          }
        }
        return;
      }
    }
  
    yield put(CoreActions.stopHeartbeatRequested());
    yield call(websocketConnection.close, reason);
    yield put(ExtensionActions.sendSettingsToWebappRequested());
    yield put(WebsocketActions.disconnectSucceeded());
  }
  
  export function* sendWebsocketIdToWebappRequested() {
    const websocketId = yield select(selectWebsocketId);
    yield call(sendWebsocketId, websocketId);
    yield put(WebsocketActions.sendWebsocketIdToWebappSucceeded());
  }
  
  export function* sendRequested({ eventName, data }) {
    let counter = 0;
  
    // Reconnecting until websocket connection ready
    while (true) {
      const isConnected = yield select(selectWebsocketIsConnected);
      const isOpen = yield call(websocketConnection.isOpen);
  
      const hasActiveWebApp = yield select(selectHasActiveWebAppTabs);
      if (!isCloud() && !hasActiveWebApp) {
        logger.debug('Message ignored due to webapp tab absence', eventName, data, counter);
        return;
      }
  
      if (isConnected && isOpen) {
        const { finished } = yield race({
          finished: call(websocketConnection.sendMessage, eventName, data),
          disconnect: take(WebsocketTypes.DISCONNECT_SUCCEEDED),
        });
  
        if (finished) {
          yield put(WebsocketActions.sendUpdateStepRunResultSucceeded());
          return;
        }
  
        logger.debug('Error while sending message to websocket', eventName, data, counter);
      }
  
      logger.debug('Waiting for websocket connection to be ready...', eventName, data, counter);
      yield delay(DELAY_BETWEEN_RECONNECTION_MS);
      counter += 1;
  
      if (counter >= CHECK_WEBSOCKET_CONNECTION_LIMIT) {
        logger.debug('Problem sending a message via websocket. Connection limit exceeded.');
        return;
      }
    }
  }
  
  export default function* websocketSagas() {
    yield all([
      yield takeLeading(WebsocketTypes.CONNECT_REQUESTED, connectRequested),
      yield takeEvery(WebsocketTypes.ONOPEN_REQUESTED, onopenRequested),
      yield takeEvery(WebsocketTypes.ONCLOSE_REQUESTED, oncloseRequested),
      yield takeEvery(WebsocketTypes.SEND_REQUESTED, sendRequested),
      yield takeEvery(WebsocketTypes.DISCONNECT_REQUESTED, disconnectRequested),
      yield takeEvery(
        WebsocketTypes.SEND_WEBSOCKET_ID_TO_WEBAPP_REQUESTED,
        sendWebsocketIdToWebappRequested,
      ),
      yield throttle(500, WebsocketTypes.SEND_UPDATE_STEP_RUN_RESULT_REQUESTED, sendRequested),
    ]);
  }
  