import { createActions } from 'reduxsauce';

/*
  Each content action call (from background context) requires tabId and frameId.
  Action without tabId will not be dispatched on content side.
  See also: emitActionsToContent
*/
export const { Types: ContentTypes, Creators: ContentActions } = createActions(
  {
    getElementRectRequested: ['testRunId', 'tabId', 'frameId', 'step'],
    getElementRectSucceeded: [
      'stepId',
      'selector',
      'rect',
      'relatedRects',
      'interactionPosition',
      'isFocused',
    ],
    getElementRectFailed: ['stepId', 'error'],
    getFrameIdRequested: ['testRunId', 'tabId', 'step', 'requiredFrameId'],
    getFrameIdSucceeded: ['tabId', 'stepId', 'frame'],
    getFrameIdFailed: ['stepId', 'error'],
    getWindowRequested: ['testRunId', 'tabId', 'frameId', 'step'],
    getWindowSucceeded: ['stepId'],
    changeRequested: ['testRunId', 'tabId', 'frameId', 'step'],
    changeSucceeded: ['stepId'],
    changeFailed: ['stepId', 'error'],
    selectOptionRequested: ['testRunId', 'tabId', 'frameId', 'step'],
    selectOptionSucceeded: ['stepId'],
    selectOptionFailed: ['stepId', 'error'],
    uploadFileRequested: ['testRunId', 'tabId', 'frameId', 'step'],
    uploadFileSucceeded: ['stepId'],
    uploadFileFailed: ['stepId', 'error'],
    focusRequested: ['testRunId', 'tabId', 'frameId', 'step', 'shouldSelect'],
    focusSucceeded: ['stepId'],
    focusFailed: ['stepId', 'error'],
    assertRequested: ['testRunId', 'tabId', 'frameId', 'step', 'variables'],
    assertSucceeded: ['stepId'],
    assertFailed: ['stepId', 'error'],
    listenEventRequested: ['testRunId', 'tabId', 'frameId', 'step', 'eventName', 'eventParams'],
    listenEventSucceeded: ['stepId', 'eventName'],
    listenEventInitialized: ['stepId', 'eventName'],
    listenEventFailed: ['stepId', 'error'],
    listenEventExecuted: ['result'],
    scrollRequested: ['testRunId', 'tabId', 'frameId', 'step'],
    scrollSucceeded: ['stepId'],
    scrollFailed: ['stepId', 'error'],
    dragRequested: ['testRunId', 'tabId', 'frameId', 'step', 'interactionCoords'],
    dragSucceeded: ['stepId'],
    dragFailed: ['stepId', 'error'],
    dropRequested: ['testRunId', 'tabId', 'frameId', 'step', 'interactionCoords'],
    dropSucceeded: ['stepId'],
    dropFailed: ['stepId', 'error'],
    sendWebsocketIdToWebapp: ['websocketId'],
    getSettingsRequested: ['viewport'],
    getSettingsSucceeded: ['tabId', 'frameId', 'settings'],
    initialized: ['frameObj'],
    startRecordingRequested: ['tabId'],
    stopRunningRequested: ['tabId'],
    resizeViewportRequested: ['viewport'],
    resizeViewportSucceeded: ['windowId'],
    setPotentialTimeoutReasonRequested: ['testRunId', 'reason'],
    elementRemoved: ['testRunId'],
    closePromptExecuted: [],
    resetRequested: [],
    domContentLoaded: ['tabId', 'frameId'],
    lockNativeMouseInteractionsRequested: ['tabId', 'frameId'],
    unlockNativeMouseInteractionsRequested: ['tabId', 'frameId'],
    getElementValueRequested: ['testRunId', 'tabId', 'frameId', 'step'],
    getElementValueSucceeded: ['stepId', 'value'],
    getElementValueFailed: ['stepId', 'error'],
  },
  { prefix: 'CONTENT/' },
);
