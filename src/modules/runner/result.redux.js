import { produce } from 'immer';

import setWith from 'lodash.setwith';
import { indexBy, prop, propOr, isEmpty, mergeDeepRight, path } from 'ramda';
import { createReducer } from 'reduxsauce';

import { ExtensionTypes } from '~/modules/extension/extension.redux';
import { RunnerTypes } from '~/modules/runner/runner.redux';

const INITIAL_STATE = {};

const startSucceeded = (state, { testRunId }) =>
    produce(state, (draftState) => {
        draftState[testRunId] = {};
    });

const runStepRequested = (state, { testRunId, step }) =>
    produce(state, (draftState) => {
        const conditionsState = indexBy(
            prop('type'),
            propOr([], 'waitingConditions', step)
                .filter(prop('isActive'))
                .map((waitingCondition) => ({
                    type: waitingCondition.type,
                    expected: waitingCondition.expected,
                    current: undefined,
                    isSuccess: false,
                })),
        );
        setWith(
            draftState,
            `${testRunId}.${step.id}`,
            {
                elementExists: null,
                selector: null,
                executed: false,
                timeout: false,
                failed: false,
                warning: false,
                forceFailed: false,
                finished: false,
                status: undefined,
                elementConditionsSuccess: false,
                conditionsState,
            },
            Object,
        );
    });

const updateStepRunResultSucceeded = (state, { testRunId, stepId, result }) =>
    produce(state, (draftState) => {
        if (path([testRunId, stepId], draftState)) {
            draftState[testRunId][stepId] = mergeDeepRight(draftState[testRunId][stepId], result);
        }
    });

const updateStepRunStatusSucceeded = (state, { testRunId, stepId, status, result = {} }) =>
    produce(state, (draftState) => {
        if (path([testRunId, stepId], draftState)) {
            if (!isEmpty(result)) {
                draftState[testRunId][stepId] = mergeDeepRight(draftState[testRunId][stepId], result);
            }
            draftState[testRunId][stepId].status = status;
        }
    });

const removeWindowSucceeded = (state, { testRunId }) =>
    produce(state, (draftState) => {
        if (testRunId && path([testRunId], draftState)) {
            delete draftState[testRunId];
        }
    });

export const reducer = createReducer(INITIAL_STATE, {
    [RunnerTypes.START_SUCCEEDED]: startSucceeded,
    [RunnerTypes.RUN_STEP_REQUESTED]: runStepRequested,
    [RunnerTypes.UPDATE_STEP_RUN_RESULT_SUCCEEDED]: updateStepRunResultSucceeded,
    [RunnerTypes.UPDATE_STEP_RUN_STATUS_SUCCEEDED]: updateStepRunStatusSucceeded,
    [ExtensionTypes.REMOVE_WINDOW_SUCCEEDED]: removeWindowSucceeded,
});
