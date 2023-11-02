import { produce } from 'immer';

import { createActions, createReducer } from 'reduxsauce';

export const { Types: UIStateTypes, Creators: UIStateActions } = createActions(
    {
        setState: ['componentName', 'data'],
        resetState: ['componentName'],
        showModal: ['modalType'],
        closeModal: [],
        resetRequested: [],
    },
    { prefix: 'UISTATE/' },
);

export const INITIAL_STATE = {};

const setUIState = (state, action) =>
    produce(state, (draftState) => {
        draftState[action.componentName] = {
            ...state[action.componentName],
            ...action.data,
        };
    });

const resetUIState = (state, action) =>
    produce(state, (draftState) => {
        delete draftState[action.componentName];
    });

const showModal = (state, action) =>
    setUIState(state, { componentName: 'Modals', data: { currentModal: action.modalType } });

const closeModal = (state) => resetUIState(state, { componentName: 'Modals' });

export const reducer = createReducer(INITIAL_STATE, {
    [UIStateTypes.SET_STATE]: setUIState,
    [UIStateTypes.RESET_STATE]: resetUIState,
    [UIStateTypes.SHOW_MODAL]: showModal,
    [UIStateTypes.CLOSE_MODAL]: closeModal,
});
