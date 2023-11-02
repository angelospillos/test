import * as Sentry from '@sentry/browser';
import { all, spawn, call } from 'redux-saga/effects';

import backgroundSagas from '~/modules/background/background.sagas';
import coreSagas from '~/modules/core/core.sagas';
import extensionSagas from '~/modules/extension/extension.sagas';
import recorderSagas from '~/modules/recorder/recorder.sagas';
import runnerSagas from '~/modules/runner/runner.sagas';
import userSagas from '~/modules/user/user.sagas';
import websocketSagas from '~/modules/websocket/websocket.sagas';
import Logger from '~/services/logger';
import { captureException } from '~/utils/errors';
// <-- IMPORT MODULE SAGA -->

const logger = Logger.get('Background Root Saga');

export default function* rootSaga() {
  const sagas = [
    runnerSagas,
    recorderSagas,
    userSagas,
    websocketSagas,
    extensionSagas,
    backgroundSagas,
    coreSagas,
    // <-- INJECT MODULE SAGA -->
  ];

  yield all(
    sagas.map((saga) =>
      // eslint-disable-next-line func-names
      spawn(function* () {
        while (true) {
          try {
            yield call(saga);
            break;
          } catch (error) {
            logger.debug('Background sagas will reload...');

            Sentry.captureMessage('Background sagas reloaded', { level: 'debug' });
            if (!error.isHandled) {
              captureException(error);
            }
          }
        }
      }),
    ),
  );
}
