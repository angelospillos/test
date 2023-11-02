import { propOr } from 'ramda';
import { createSelector } from 'reselect';

import { getBaseActionName, defaultState } from '~/modules/actionState/actionState.redux';

const selectActionStateDomain = (state) => state.actionState;

export default (actionFunc, meta = {}) =>
  createSelector(selectActionStateDomain, (actionState) => {
    const baseActionName = getBaseActionName(actionFunc().type, meta);
    const singleActionState = propOr(defaultState, baseActionName, actionState);

    return singleActionState;
  });
