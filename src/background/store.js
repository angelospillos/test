// eslint-disable-next-line import/no-extraneous-dependencies
import { configureStore } from '@reduxjs/toolkit';
import { createLogger } from 'redux-logger';
import createSagaMiddleware from 'redux-saga';
import { wrapStore } from 'webext-redux';

import rootSaga from '~/background/sagas';
import { emitActionsToContent, reconnectWebsocket } from '~/background/utils/misc';
import StoreRegistry, { STORE_TYPES } from '~/modules/storeRegistry';
import logger, { loggerMiddleware } from '~/services/logger';
import { crashReporter } from '~/utils/errors';
import { shallowDiffWithExclusions, excludeStoreDataFromSync } from '~/utils/store';

import rootReducer from './reducers';

const sagaMiddleware = createSagaMiddleware();

const enhancers = [];

const reduxLogger = createLogger({
  logger,
  collapsed: (getState, action, logEntry) => !logEntry.error,
});

const middlewares = [loggerMiddleware, emitActionsToContent, sagaMiddleware, crashReporter];

if (['development', 'production'].includes(process.env.ENV)) {
  middlewares.unshift(reduxLogger);
}

export const store = configureStore({ reducer: rootReducer(), middleware: middlewares, enhancers });

StoreRegistry.set(STORE_TYPES.BACKGROUND, store);

const serializer = (state) => (Array.isArray(state) ? state : excludeStoreDataFromSync(state));
wrapStore(store, {
  diffStrategy: shallowDiffWithExclusions,
  serializer,
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'POPUP') {
    chrome.runtime.sendMessage({ type: 'STORE_INITIALIZED' });
  }
});

const runSagas = () => {
  sagaMiddleware
    .run(rootSaga)
    .toPromise()
    .catch(() => {
      runSagas();
      reconnectWebsocket();
    });
};
runSagas();

export const dispatch = (action) => store.dispatch(action);
global.bgStore = store;
export default store;
