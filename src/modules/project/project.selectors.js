import memoize from 'lodash.memoize';
import { prop } from 'ramda';
import { createSelector } from 'reselect';

export const selectProjectDomain = prop('project');

export const selectCurrentProject = createSelector(selectProjectDomain, prop('current'));
export const selectCurrentProjectId = createSelector(selectCurrentProject, prop('id'));

export const selectCurrentProjectSettings = createSelector(selectCurrentProject, prop('settings'));

export const selectFeatureFlags = createSelector(selectCurrentProject, prop('featureFlags'));

export const selectProjectWaitingCondition = memoize((type) =>
  createSelector(selectCurrentProjectSettings, (projectSettings) =>
    projectSettings.waitingConditions.find(
      (condition) => condition.isActive && condition.type === type,
    ),
  ),
);
