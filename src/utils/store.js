import { mapObjIndexed, omit, pick } from 'ramda';
import { DIFF_STATUS_UPDATED, DIFF_STATUS_REMOVED } from 'webext-redux/lib/strategies/constants';

// synchronize to content.js only needed storage KEYS, performance optimization
export const excludedStoreKeys = [];
export const excludedRecorderStoreKeys = ['cachedScreenshots', 'log', 'steps', 'stepsOrder'];
export const includedResultStoreKeys = [
  'conditionsState',
  'elementConditionsSuccess',
  'elementExists',
];

export const excludeStoreDataFromSync = (state) => ({
  ...omit(excludedStoreKeys, state),
  result: mapObjIndexed(
    (testRun) => mapObjIndexed((stepRun) => pick(includedResultStoreKeys, stepRun), testRun),
    state.result,
  ),
  recorder: omit(excludedRecorderStoreKeys, state.recorder),
});

/**
 * Returns a new Object containing only the fields in `new` that differ from `old`
 *
 * @param {Object} oldObj
 * @param {Object} newObj
 * @param {Array} exclusions
 * @return {Array} An array of changes. The changes have a `key`, `value`, and `change`.
 *   The change is either `updated`, which is if the value has changed or been added,
 *   or `removed`.
 */
export const shallowDiffWithExclusions = (oldObj, newObj) => {
  const difference = [];

  Object.keys(newObj).forEach((key) => {
    if (!excludedStoreKeys.includes(key)) {
      if (oldObj[key] !== newObj[key]) {
        difference.push({
          key,
          value: newObj[key],
          change: DIFF_STATUS_UPDATED,
        });
      }
    }
  });

  Object.keys(oldObj).forEach((key) => {
    if (!excludedStoreKeys.includes(key)) {
      if (!Object.prototype.hasOwnProperty.call(newObj, key)) {
        difference.push({
          key,
          change: DIFF_STATUS_REMOVED,
        });
      }
    }
  });
  return difference;
};
