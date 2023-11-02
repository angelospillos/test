import memoize from 'lodash.memoize';
import { propOr } from 'ramda';
import { createSelector } from 'reselect';

const selectUIState = (state) => state.uistate;

export const selectUIStateForComponent = memoize((componentName) =>
  createSelector(selectUIState, propOr({}, componentName)),
);
