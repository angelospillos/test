import { createStore, applyMiddleware, compose } from 'redux';
import { createLogger } from 'redux-logger';
import createSagaMiddleware from 'redux-saga';
import { Store } from 'webext-redux';

import StoreRegistry, { STORE_TYPES } from '~/modules/storeRegistry';
import logger, { loggerMiddleware } from '~/services/logger';

import rootSaga from './sagas';

const sagaMiddleware = createSagaMiddleware({});

const reduxLogger = createLogger({
  logger,
  collapsed: (getState, action, logEntry) => !logEntry.error,
});

const middlewares = [loggerMiddleware, sagaMiddleware];

if (['development'].includes(process.env.ENV)) {
  middlewares.unshift(reduxLogger);
}

const localStore = createStore(() => {}, compose(applyMiddleware(...middlewares)));

export const proxyStore = new Store();

StoreRegistry.isContentContext = true;
StoreRegistry.set(STORE_TYPES.PROXY, proxyStore);
StoreRegistry.set(STORE_TYPES.CONTENT, localStore);

export const dispatch = (action) => localStore.dispatch(action);

const runSagas = () => {
  sagaMiddleware
    .run(rootSaga)
    .toPromise()
    .catch(() => {
      runSagas();
    });
};

runSagas();

export default localStore;
