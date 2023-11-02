import * as Sentry from '@sentry/browser';
import { all, spawn, call } from 'redux-saga/effects';

import contentSagas from '~/modules/content/content.sagas';
import Logger from '~/services/logger';
import { captureException } from '~/utils/errors';
// <-- IMPORT MODULE SAGA -->

const logger = Logger.get('Content Root Saga');

export default function* rootSaga() {
  const sagas = [
    contentSagas,
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
            logger.debug('Content sagas will reload...');
            Sentry.captureMessage('Content sagas reloaded', { level: 'debug' });
            captureException(error, false);
          }
        }
      }),
    ),
  );
}
