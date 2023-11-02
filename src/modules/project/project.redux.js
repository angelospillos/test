import { produce } from 'immer';

import { prop } from 'ramda';
import { createActions, createReducer } from 'reduxsauce';

import { RecorderTypes } from '~/modules/recorder/recorder.redux';
import { RunnerTypes } from '~/modules/runner/runner.redux';

export const { Types: ProjectTypes, Creators: ProjectActions } = createActions(
    {
        resetRequested: [],
    },
    { prefix: 'PROJECT/' },
);

export const INITIAL_STATE = {
    current: null,
};

const startSucceeded = (state, { project }) =>
    produce(state, (draftState) => {
        const projectId = prop('id', project);
        if (projectId) {
            draftState.current = project;
        }
    });

export const reducer = createReducer(INITIAL_STATE, {
    [RecorderTypes.START_SUCCEEDED]: startSucceeded,
    [RunnerTypes.START_SUCCEEDED]: startSucceeded,
});
