import { produce } from 'immer';

import { nanoid } from 'nanoid';
import { createActions, createReducer } from 'reduxsauce';

export const websocketPrefix = 'WEBSOCKET/';

export const { Types: WebsocketTypes, Creators: WebsocketActions } = createActions(
    {
        connectRequested: ['seleniumKey'],
        onopenRequested: [],
        onopenSucceeded: [],
        oncloseRequested: [],
        oncloseSucceeded: [],
        disconnectRequested: ['reason'],
        disconnectSucceeded: [],
        sendRequested: ['eventName', 'data'],
        setChannelName: ['channelName'],
        sendWebsocketIdToWebappRequested: [],
        sendWebsocketIdToWebappSucceeded: [],
        sendUpdateStepRunResultRequested: ['eventName', 'data'],
        sendUpdateStepRunResultSucceeded: [],
    },
    { prefix: websocketPrefix },
);

export const INITIAL_STATE = {
    connected: false,
    websocketId: null,
};

const onopenSucceeded = (state) =>
    produce(state, (draftState) => {
        draftState.connected = true;
        draftState.websocketId = nanoid();
    });

const oncloseSucceeded = (state) =>
    produce(state, (draftState) => {
        draftState.connected = false;
        draftState.websocketId = null;
    });

export const reducer = createReducer(INITIAL_STATE, {
    [WebsocketTypes.ONOPEN_SUCCEEDED]: onopenSucceeded,
    [WebsocketTypes.ONCLOSE_SUCCEEDED]: oncloseSucceeded,
    [WebsocketTypes.DISCONNECT_SUCCEEDED]: oncloseSucceeded,
});
