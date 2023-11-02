import { produce } from 'immer';

import { createActions, createReducer } from 'reduxsauce';

import { RecorderTypes } from '~/modules/recorder/recorder.redux';
import { RunnerTypes } from '~/modules/runner/runner.redux';

export const { Types: UserTypes, Creators: UserActions } = createActions(
    {
        loginRequested: ['username', 'password', 'setError'],
        loginSucceeded: ['token'],
        loginFailed: ['error'],
        logoutRequested: [],
        logoutSucceeded: [],
        updateExtensionSettingsRequested: ['settings'],
        updateExtensionSettingsSucceeded: [],
        updateExtensionSettingsFailed: [],
    },
    { prefix: 'USER/' },
);

export const INITIAL_STATE = {
    token: '',
    loginError: false,
    settings: {},
    userId: null,
};

const loginSucceeded = (state, action) => ({
    ...state,
    token: action.token,
    loginError: false,
});
const loginFailed = (state) => ({ ...state, loginError: true });
const logoutSucceeded = (state) => ({
    ...state,
    token: '',
    loginError: false,
});

const startSucceeded = (state, { userSettings, userId }) =>
    produce(state, (draftState) => {
        draftState.settings = userSettings;
        draftState.userId = userId;
    });

export const reducer = createReducer(INITIAL_STATE, {
    [UserTypes.LOGIN_SUCCEEDED]: loginSucceeded,
    [UserTypes.LOGOUT_SUCCEEDED]: logoutSucceeded,
    [UserTypes.LOGIN_FAILED]: loginFailed,
    [RecorderTypes.START_SUCCEEDED]: startSucceeded,
    [RunnerTypes.START_SUCCEEDED]: startSucceeded,
});
