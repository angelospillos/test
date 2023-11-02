import { prop } from 'ramda';
import { createSelector } from 'reselect';

const selectUser = (state) => state.user;

export const selectUserToken = createSelector(selectUser, prop('token'));

export const selectUserSettings = createSelector(selectUser, prop('settings'));

export const selectUserId = createSelector(selectUser, prop('userId'));

export const selectIsUserLoggedIn = (state) => !!selectUserToken(state);
