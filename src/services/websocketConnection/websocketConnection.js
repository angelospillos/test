import * as Sentry from '@sentry/browser';
import { nanoid } from 'nanoid';
import { io } from 'socket.io-client';

import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import { selectRunningTestRun } from '~/modules/runner/runner.selectors';
import StoreRegistry from '~/modules/storeRegistry';

import api from '../api';
import BaseService from '../baseService';

export const WEBSOCKET_CLOSED_REASON = {
  INVALID_TOKEN: 'INVALID_TOKEN',
  UNKNOWN: 'UNKNOWN',
  CHANNEL_CLOSED: 'CHANNEL_CLOSED',
  SELENIUM_DISCONNECTED: 'SELENIUM_DISCONNECTED',
  OFFLINE: 'OFFLINE',
  WEBAPP_INACTIVE: 'WEBAPP_INACTIVE',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
};

class WebsocketConnection extends BaseService {
  connection = null;

  constructor() {
    super('Websocket Connection');
  }

  createConnection = async (url, token, version, seleniumKey) => {
    let websocketUrl = `${url}?token=${token}&version=${version}&cid=${nanoid(8)}`;
    if (seleniumKey) {
      websocketUrl = `${websocketUrl}&selenium_key=${seleniumKey}`;
    }

    let apiVersion = '4.20.0';
    try {
      const { data } = await api.getVersion();
      apiVersion = data;
    } catch (error) {
      this.logError('Error while requesting api version. Version', apiVersion, 'will be used');
    }

    this.connection = io(websocketUrl, {
      path: '/ws/extension/',
      transports: ['websocket'],
    });

    this.closeReason = null;
    return this.connection;
  };

  _deprecatedSendMessage = (message) => {
    if (this.connection) {
      // eslint-disable-next-line no-param-reassign
      message.reqId = nanoid(8);
      this.connection.send(JSON.stringify(message));
    }
  };

  sendMessage = (eventName, data = {}) =>
    new Promise((resolve) => {
      if (this.connection) {
        this.connection.on('connect_error', () => {
          this.logError('Connection error while sending message');
          resolve(false);
        });
        this.connection.emit(
          eventName,
          {
            reqId: nanoid(8),
            data,
          },
          // We need to wait for the server to confirm the message was received
          () => resolve(true),
        );
      } else {
        resolve(false);
      }
    });

  close = (reason = WEBSOCKET_CLOSED_REASON.UNKNOWN) => {
    if (this.connection) {
      this.closeReason = reason;

      if (
        [
          WEBSOCKET_CLOSED_REASON.CHANNEL_CLOSED,
          WEBSOCKET_CLOSED_REASON.SELENIUM_DISCONNECTED,
          WEBSOCKET_CLOSED_REASON.UNKNOWN,
        ].includes(reason)
      ) {
        const state = StoreRegistry.getBackgroundState();
        const isRunning = Boolean(selectRunningTestRun(state));
        const isRecording = selectIsRecording(state);

        if (isRecording || isRunning) {
          Sentry.captureMessage(`Websocket connection closed. Reason: ${reason}`, {
            level: 'warning',
          });
        }
      }

      this.connection.close();
    }
  };

  _isOpen = () => this.connection?.readyState === WebSocket.OPEN;

  isOpen = () => this.connection?.connected ?? false;
}

export default new WebsocketConnection();
