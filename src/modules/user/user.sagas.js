import { call, put, takeLatest, all } from 'redux-saga/effects';

import { WebsocketActions } from '~/modules/websocket/websocket.redux';
import api from '~/services/api';
import Logger from '~/services/logger';

import { UserTypes, UserActions } from './user.redux';

const logger = Logger.get('User Sagas');

export function* loginRequested({ username, password, setError }) {
  try {
    const { data: responseData } = yield call(api.auth.login, {
      username,
      password,
    });

    yield put(UserActions.loginSucceeded(responseData.key));
    yield put(WebsocketActions.connectRequested(responseData.key));
  } catch (error) {
    if (setError) {
      setError();
    }
    yield put(UserActions.loginFailed(error));
  }
}

export function* logoutRequested() {
  try {
    yield call(api.auth.logout);
    yield put(UserActions.logoutSucceeded());
  } catch (error) {
    logger.error(error);
  }
}

export function* updateExtensionSettingsRequested({ settings }) {
  try {
    yield call(api.user.updateExtensionSettings, settings);
    yield put(UserActions.updateExtensionSettingsSucceeded());
  } catch (error) {
    yield put(UserActions.updateExtensionSettingsFailed(error));
  }
}

export default function* userSagas() {
  yield all([
    yield takeLatest(UserTypes.LOGIN_REQUESTED, loginRequested),
    yield takeLatest(UserTypes.LOGOUT_REQUESTED, logoutRequested),
    yield takeLatest(
      UserTypes.UPDATE_EXTENSION_SETTINGS_REQUESTED,
      updateExtensionSettingsRequested,
    ),
  ]);
}
