import { STATUS } from '~/constants/test';
import * as Sentry from '@sentry/browser';
import { END, eventChannel } from 'redux-saga';
import { call, put, take } from 'redux-saga/effects';

import { MODAL_TYPE } from '~/constants/modal';
import { CoreTypes } from '~/modules/core/core.redux';
import { ExtensionTypes } from '~/modules/extension/extension.redux';
import { RecorderTypes, RecorderActions } from '~/modules/recorder/recorder.redux';
import { WebSocketSetupError } from '~/modules/runner/runner.exceptions';
import { RunnerActions, RunnerTypes } from '~/modules/runner/runner.redux';
import { UIStateActions } from '~/modules/uistate/uistate.redux';
import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import Logger from '~/services/logger';
import websocketConnection, {
  WEBSOCKET_CLOSED_REASON,
  // eslint-disable-next-line object-curly-newline
} from '~/services/websocketConnection/websocketConnection';
import * as webapp from '~/utils/webapp';
// eslint-disable-next-line object-curly-newline

const logger = Logger.get('Websocket Helpers');

export const sendWebsocketId = (websocketId) =>
  webapp.sendMessageToWebapp({ type: 'WEBSOCKET_ID', websocketId });

export const isSupportedAction = (type) => {
  const allowedCommands = [
    RunnerTypes.START_REQUESTED,
    RunnerTypes.STOP_REQUESTED,
    RunnerTypes.RUN_STEP_REQUESTED,
    RecorderTypes.START_REQUESTED,
    RecorderTypes.STOP_REQUESTED,
    RecorderTypes.CHANGE_STEPS_PROCESSED,
    ExtensionTypes.CLOSE_WINDOWS_REQUESTED,
    ExtensionTypes.SETTINGS_UPDATED,
    CoreTypes.ERROR,
    CoreTypes.PONG,
    CoreTypes.DUMP_EXTENSION_STATE,
  ];
  return allowedCommands.includes(type);
};

export function createEventChannel(mySocket) {
  return eventChannel((emit) => {
    const onOpen = () => emit(WebsocketActions.onopenRequested());
    const onClose = (reason) => {
      websocketConnection.logDebug('Closed!', reason, websocketConnection.closeReason);
      emit(WebsocketActions.oncloseRequested());
      emit(RunnerActions.stopAllRequested(STATUS.ERROR, false));
      emit(RecorderActions.stopRequested());
      emit(UIStateActions.showModal(MODAL_TYPE.CONNECTION_ERROR));
      emit(END);
    };
    const onError = (errorEvent) => {
      websocketConnection.logDebug('Error', errorEvent?.message);
    };
    const onMessage = (eventName, eventData) => {
      const { data = {} } = eventData;
      try {
        websocketConnection.logVerbose('on eventChannel message', eventName, data);
        if (isSupportedAction(eventName)) {
          emit({ type: eventName, ...data });
        } else {
          websocketConnection.logDebug('Unsupported message', eventName);
        }
      } catch (error) {
        websocketConnection.logDebug('Error catched while processing websocket message');
        logger.error(error);
      }
    };

    mySocket.on('connect', onOpen);
    mySocket.on('disconnect', onClose);
    mySocket.on('connect_error', onError);
    mySocket.onAny(onMessage);

    const unsubscribe = () => {
      try {
        websocketConnection.close(WEBSOCKET_CLOSED_REASON.CHANNEL_CLOSED);
      } catch (error) {
        websocketConnection.logError(error);
      }
    };

    return unsubscribe;
  });
}

export function* initializeWebSocketChannel(token, seleniumKey) {
  let channel;
  try {
    if (!(yield call(websocketConnection.isOpen))) {
      yield call(
        websocketConnection.createConnection,
        process.env.API_WS_URL,
        token,
        process.env.VERSION,
        seleniumKey,
      );
    }

    channel = yield call(createEventChannel, websocketConnection.connection);
  } catch (error) {
    websocketConnection.closeReason = WEBSOCKET_CLOSED_REASON.RUNTIME_ERROR;
    yield call(Sentry.captureException, new WebSocketSetupError(error));
  }

  while (true) {
    try {
      const message = yield take(channel);
      logger.verbose('New message from WebSocket', message);
      yield put(message);
    } catch (error) {
      logger.debug('WebSocket action error omitted in event channel listener\n', error);
    }
  }
}
