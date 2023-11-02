import { STATUS } from '~/constants/test';
import memoize from 'lodash.memoize';
import {
  pathOr,
  prop,
  propOr,
  any,
  propEq,
  pipe,
  pathEq,
  find,
  props,
  equals,
  values,
} from 'ramda';
import { createSelector } from 'reselect';

import { WAITING_CONDITION_TYPE } from '~/constants/step';
import { STEP_TYPE } from '~/constants/test';
import { selectProjectDomain, selectProjectWaitingCondition } from '~/modules/project';

const selectRunnerDomain = prop('runner');

export const selectIsStopping = createSelector(selectRunnerDomain, prop('isStopping'));

export const selectPreviousTestRunEndTime = createSelector(
  selectRunnerDomain,
  prop('lastTestRunEndTime'),
);

export const selectTestRuns = createSelector(selectRunnerDomain, prop('testRuns'));

export const selectTestRun = (testRunId) => createSelector(selectTestRuns, pathOr({}, [testRunId]));

export const selectRunningTestStatus = (testRunId) =>
  createSelector(selectTestRun(testRunId), prop('status'));

export const selectRunningTestError = (testRunId) =>
  createSelector(selectTestRun(testRunId), prop('error'));

export const selectIsRunningTestRun = (testRunId) =>
  createSelector(selectTestRun(testRunId), pathEq(['status'], STATUS.RUNNING));

export const selectCurrentTabContext = memoize((testRunId) =>
  createSelector(selectTestRun(testRunId), prop('tabContext')),
);
export const selectExecutionUrlForTestRunId = (testRunId) =>
  createSelector(selectCurrentTabContext(testRunId), prop('executionUrl'));

export const selectCurrentTabIdForTestRunId = (testRunId) =>
  createSelector(selectCurrentTabContext(testRunId), prop('currentTabId'));

export const selectHasRunningTestRun = createSelector(selectTestRuns, (testRuns = {}) =>
  values(testRuns).some(pathEq(['status'], STATUS.RUNNING)),
);

// result selectors
const selectResultDomain = prop('result');

export const selectResultForTestRunId = (testRunId) =>
  createSelector(selectResultDomain, pathOr(false, [testRunId]));

export const selectStepRunningResult = (testRunId, stepId) =>
  createSelector(selectResultForTestRunId(testRunId), prop(stepId));

export const selectStepRunningStatus = (testRunId, stepId) =>
  createSelector(selectStepRunningResult(testRunId, stepId), prop('status'));

export const selectStepRunningConditionsState = (testRunId, stepId) =>
  createSelector(selectStepRunningResult(testRunId, stepId), prop('conditionsState'));

export const selectHasStepPageNavigationCommitted = (testRunId, stepId) =>
  createSelector(
    selectStepRunningResult(testRunId, stepId),
    pipe(
      pathOr({}, ['conditionsState', WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION]),
      props(['isSuccess', 'isSoftSuccess']),
      any(equals(true)),
    ),
  );

export const selectHasStepFailedWaitingConditions = (testRunId, stepId) =>
  createSelector(selectStepRunningResult(testRunId, stepId), (result) => {
    const conditions = pipe(propOr({}, 'conditionsState'), Object.values)(result);
    return conditions.some(
      ({ isSuccess, isSoftSuccess, isIgnored }) => !isIgnored && !isSuccess && !isSoftSuccess,
    );
  });

export const selectHasStepConditionsResolvedSoftly = (testRunId, stepId) =>
  createSelector(
    selectStepRunningResult(testRunId, stepId),
    pipe(propOr({}, 'conditionsState'), Object.values, any(propEq('isSoftSuccess', true))),
  );

export const selectTestRunIds = createSelector(selectTestRuns, (testRuns) => Object.keys(testRuns));

export const selectTestRunsList = createSelector(selectTestRuns, (testRuns = {}) =>
  Object.values(testRuns),
);

export const selectRunningTestRun = createSelector(
  selectTestRunsList,
  find(propEq('status', STATUS.RUNNING)),
);

export const selectRunningTestRunStartTime = createSelector(
  selectRunningTestRun,
  prop('startTime'),
);

export const selectLastRunningStep = createSelector(selectRunningTestRun, prop('lastRunningStep'));

export const selectLastRunningStepType = createSelector(selectLastRunningStep, prop('type'));

export const selectLastRunningStepTimer = createSelector(
  selectRunningTestRun,
  prop('lastRunningStepTimer'),
);

export const selectPreviousStep = createSelector(selectRunningTestRun, prop('prevRunningStep'));

export const selectIsFirstStep = createSelector(selectRunningTestRun, prop('isFirstStep'));

export const selectTestRunByTestId = memoize((testId) =>
  createSelector(selectTestRunsList, find(propEq('testId', testId))),
);

export const selectLastRunningStepResult = createSelector(
  selectResultDomain,
  selectRunningTestRun,
  selectLastRunningStep,
  (result, testRun, lastStep) => {
    if (!testRun || !lastStep) {
      return null;
    }
    return selectStepRunningResult(testRun.testRunId, lastStep.id)({ result });
  },
);

export const selectLastRunningStepStatus = createSelector(
  selectResultDomain,
  selectRunningTestRun,
  selectLastRunningStep,
  (result, testRun, lastStep) => {
    if (!testRun || !lastStep) {
      return null;
    }
    return selectStepRunningStatus(testRun.testRunId, lastStep.id)({ result });
  },
);

export const selectLastStepWaitingCondition = memoize((type) =>
  createSelector(selectLastRunningStep, (step) => {
    if (step.type === STEP_TYPE.GOTO) {
      return null;
    }

    return (
      step.waitingConditions.find((condition) => condition.isActive && condition.type === type) ||
      null
    );
  }),
);

export const selectNetworkConditionExpectedValue = createSelector(
  selectProjectDomain,
  selectRunningTestRun,
  selectLastStepWaitingCondition(WAITING_CONDITION_TYPE.NETWORK_IDLE),
  (projectsState, testRun, stepNewtorkCondition) => {
    const defaultNetworkCondition = selectProjectWaitingCondition(
      WAITING_CONDITION_TYPE.NETWORK_IDLE,
    )({ project: projectsState });

    const getExpected = prop('expected');
    const expectedValue =
      getExpected(stepNewtorkCondition) ?? getExpected(defaultNetworkCondition) ?? '';
    return expectedValue;
  },
);

export const selectRunningTestRunTabContext = createSelector(
  selectRunningTestRun,
  prop('tabContext'),
);
