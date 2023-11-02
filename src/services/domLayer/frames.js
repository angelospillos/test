import { nanoid } from 'nanoid';
import { path, pick } from 'ramda';

import { MAIN_FRAME_DATA } from '~/constants/test';
import { RuntimeError, FrameDoesNotExist } from '~/modules/runner/runner.exceptions';
import { calculateBoundingClientRectInsideIframe } from '~/utils/dom';
import {
  catchUnexpectedErrors,
  captureExceptionAsWarning,
  serializeError,
  deserializeError,
} from '~/utils/errors';
import { getElementsByXPath, getElementSelectors } from '~/utils/selectors';

import BaseService from '../baseService';

import { getFrameElement } from './helpers';

export const PARENT_LAYER_EVENTS = {
  ADD_ABSOLUTE_EVENT_LISTENER: 'ADD_ABSOLUTE_EVENT_LISTENER',
  REMOVE_ABSOLUTE_EVENT_LISTENER: 'REMOVE_ABSOLUTE_EVENT_LISTENER',
  RESOLVE_ABSOLUTE_EVENT_LISTENER: 'RESOLVE_ABSOLUTE_EVENT_LISTENER',
  GET_ELEMENT_DATA: 'GET_ELEMENT_DATA',
  GET_ELEMENT_DATA_RESULT: 'GET_ELEMENT_DATA_RESULT',
  GET_CURRENT_FRAME: 'GET_CURRENT_FRAME',
  GET_CURRENT_FRAME_RESULT: 'GET_CURRENT_FRAME_RESULT',
  GET_CURRENT_FRAME_SELECTOR: 'GET_CURRENT_FRAME_SELECTOR',
  GET_CURRENT_FRAME_SELECTOR_RESULT: 'GET_CURRENT_FRAME_SELECTOR_RESULT',
  GET_NESTED_FRAME_ID: 'GET_NESTED_FRAME_ID',
  GET_NESTED_FRAME_ID_RESULT: 'GET_NESTED_FRAME_ID_RESULT',
  NESTED_FRAME_INITIALIZED: 'NESTED_FRAME_INITIALIZED',
  SEND_MESSAGE_FAILED: 'SEND_MESSAGE_FAILED',
  UPDATE_NESTED_FRAME_SELECTOR: 'UPDATE_NESTED_FRAME_SELECTOR',
  UPDATE_NESTED_FRAME_SELECTOR_RESULT: 'UPDATE_NESTED_FRAME_SELECTOR_RESULT',
};

export default class Frames extends BaseService {
  eventListeners = {};

  listenersIds = new Map();

  frameSelector = null;

  currentFrameData = null;

  constructor(domLayer) {
    super('Frames');
    this.domLayer = domLayer;
  }

  init = async (tabId, frameId, projectSettings) => {
    this.logDebug('Frame initialization started', frameId);
    this.startListeningMessages();
    this.frameId = frameId;
    this.tabId = tabId;
    this.projectSettings = this.projectSettings || projectSettings;

    this.isRootFrame = !this.domLayer.isInIframe();
    this.frameSelector = await this.getCurrentFrameSelector(projectSettings);

    this.currentFrameData = this.isRootFrame
      ? MAIN_FRAME_DATA
      : {
          frameId: this.frameId,
          isRoot: this.isRootFrame,
          location: '',
          src: window.location.href,
        };

    this.logDebug('Frame initialization finished', frameId);
  };

  #messageListener = catchUnexpectedErrors(
    (event) => {
      switch (path(['data', 'type'], event)) {
        case PARENT_LAYER_EVENTS.ADD_ABSOLUTE_EVENT_LISTENER: {
          this.addAbsoluteEventListener(event);
          break;
        }
        case PARENT_LAYER_EVENTS.REMOVE_ABSOLUTE_EVENT_LISTENER: {
          this.removeAbsoluteEventListener(event);
          break;
        }
        case PARENT_LAYER_EVENTS.RESOLVE_ABSOLUTE_EVENT_LISTENER: {
          this.resolveAbsoluteEventListener(event);
          break;
        }
        case PARENT_LAYER_EVENTS.GET_ELEMENT_DATA: {
          this.handleGetElementDataRequest(event);
          break;
        }
        case PARENT_LAYER_EVENTS.GET_ELEMENT_DATA_RESULT: {
          this.handleGetElementDataResponse(event);
          break;
        }
        case PARENT_LAYER_EVENTS.GET_CURRENT_FRAME_SELECTOR: {
          this.#handleFrameSelectorResult(event);
          break;
        }
        case PARENT_LAYER_EVENTS.GET_CURRENT_FRAME: {
          this.handleGetCurrentFrameRequest(event);
          break;
        }
        case PARENT_LAYER_EVENTS.GET_CURRENT_FRAME_RESULT: {
          this.handleGetCurrentFrameResponse(event);
          break;
        }
        case PARENT_LAYER_EVENTS.UPDATE_NESTED_FRAME_SELECTOR: {
          this.handleUpdateNestedFrameSelectorRequest(event);
          break;
        }
        case PARENT_LAYER_EVENTS.GET_NESTED_FRAME_ID: {
          this.handleNestedFrameIdRequest(event);
          break;
        }
        default:
          break;
      }
    },
    { isBackgroundContext: false },
  );

  startListeningMessages = () => {
    this.domLayer.addEventListener('message', this.#messageListener);
  };

  stopListeningMessages = () => {
    this.domLayer.removeEventListener('message', this.#messageListener);
  };

  sendMessageToParentFrame = (type, message, framesPath = []) => {
    this.domLayer.postParentMessage(
      {
        type,
        framesPath: [this.frameSelector, ...framesPath],
        message,
      },
      '*',
    );
  };

  sendMessageToFrame = (type, message, framesPath = []) => {
    if (framesPath.length) {
      const [nextFrameLocation, ...restPath] = framesPath;

      try {
        if (!PARENT_LAYER_EVENTS[type]) {
          throw new Error('Not supported message type', type);
        }

        if (!nextFrameLocation) {
          throw new FrameDoesNotExist(nextFrameLocation);
        }

        const frameWindow = getElementsByXPath(nextFrameLocation)[0].contentWindow;
        // eslint-disable-next-line no-unused-expressions
        frameWindow?.postMessage(
          { type, framesPath: restPath ?? [], message, isangelosEvent: true },
          '*',
        );
      } catch (error) {
        this.logInfo('Failed attempt to send message to frame:', nextFrameLocation);
        this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.SEND_MESSAGE_FAILED, {
          type,
          frameSelector: nextFrameLocation,
          error: serializeError(error),
        });
      }
    }
  };

  /*
    Frame selector setup
  */
  getCurrentFrameSelector = (projectSettings) =>
    new Promise((resolve, reject) => {
      if (this.isRootFrame) {
        resolve(MAIN_FRAME_DATA.location);
        return;
      }

      const handleResult = (event) => {
        if (event?.data?.type === PARENT_LAYER_EVENTS.GET_CURRENT_FRAME_SELECTOR_RESULT) {
          this.logVerbose('[getCurrentFrameSelector] Frame selector resolved', event.data);
          this.domLayer.removeEventListener('message', handleResult);

          if (event.data.message.error) {
            reject(deserializeError(event.data.message.error));
          } else {
            resolve(event.data.message.selector);
          }
        }
      };

      this.domLayer.addEventListener('message', handleResult);
      this.logVerbose('[getCurrentFrameSelector] send to parent', this.frameId);
      this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.GET_CURRENT_FRAME_SELECTOR, {
        projectSettings,
        id: Math.random(),
      });
    });

  #handleFrameSelectorResult = (event) => {
    this.logVerbose('Frame selector requested', event.data);
    const message = {};

    try {
      const frameElement = getFrameElement(event);
      const selectors = getElementSelectors(frameElement, event.data.message.projectSettings);
      if (!selectors.length) {
        message.selector = null;
        this.logError('There is no proper selector for that iframe', frameElement, event);
      } else {
        message.selector = selectors[0].selector;
      }
    } catch (error) {
      message.error = serializeError(error);
      captureExceptionAsWarning(error, false);
    }

    // eslint-disable-next-line no-unused-expressions
    event.source?.postMessage(
      {
        type: PARENT_LAYER_EVENTS.GET_CURRENT_FRAME_SELECTOR_RESULT,
        message: { ...message, isangelosEvent: true },
      },
      '*',
    );
  };

  /*
    Absolute listeners

    Case: Listening for events emitted in upper context inside an iframe.

    *---------------------*  1. Call addParentFrameEventListener in iframe.
    | root   *---------*  |     It will init event listening in parent frames.
    |        | iframe  |  |  2. If event catched in parent frame, then message is sent to source (child) frame.
    |        *---------*  |  3. Child frame receives message from parent and in result calls event listener callback.
    *---------------------*
  */
  #getListenerId = (eventName) => `${eventName}-${nanoid()}`;

  addEventListener = (eventName, callback, options, preventDefault, stopPropagation) => {
    if (!this.isRootFrame) {
      this.logVerbose(`Start listening for ${eventName} event parent context`);
      const listenerId = this.#getListenerId(eventName);

      const handleEvent = (event) => {
        if (event?.data?.type === PARENT_LAYER_EVENTS.RESOLVE_ABSOLUTE_EVENT_LISTENER) {
          this.logVerbose(`${eventName} catched in frame:`, this.frameSelector);
          callback({ target: window.self, fromParentContext: true });
        }
      };

      this.listenersIds.set(callback, {
        handler: handleEvent,
        id: listenerId,
      });
      this.eventListeners[listenerId] = handleEvent;
      this.domLayer.addEventListener('message', handleEvent, options);

      this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.ADD_ABSOLUTE_EVENT_LISTENER, {
        eventName,
        listenerId,
        options,
        preventDefault,
        stopPropagation,
      });
    }
  };

  removeEventListener = (eventName, callback, options) => {
    if (!this.isRootFrame) {
      const listener = this.listenersIds.get(callback);

      if (listener) {
        this.domLayer.removeEventListener('message', listener.handler, options);

        this.logVerbose(`Stop listening for ${eventName} event in parent context`);
        this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.REMOVE_ABSOLUTE_EVENT_LISTENER, {
          eventName,
          listenerId: listener.id,
          options,
        });
      }
    }
  };

  addAbsoluteEventListener = (event) => {
    const { message } = event.data;

    const handleEvent = (destEvent) => {
      // eslint-disable-next-line no-unused-expressions
      message.preventDefault && destEvent.preventDefault();
      // eslint-disable-next-line no-unused-expressions
      message.stopPropagation && destEvent.stopPropagation();
      this.resolveAbsoluteEventListener({ data: { framesPath: event.data.framesPath } });
    };
    this.eventListeners[message.listenerId] = handleEvent;
    this.logVerbose('addEventListener', message.eventName, message.options);

    this.domLayer.addEventListener(message.eventName, handleEvent, message.options);

    if (!this.isRootFrame) {
      this.sendMessageToParentFrame(
        PARENT_LAYER_EVENTS.ADD_ABSOLUTE_EVENT_LISTENER,
        message,
        event.data.framesPath,
      );
    }

    this.logVerbose(`${message.eventName} event listener added in frame:`, this.frameSelector);
  };

  removeAbsoluteEventListener = (event) => {
    const { message } = event.data;
    this.domLayer.removeEventListener(
      message.eventName,
      this.eventListeners[message.listenerId],
      message.options,
    );

    if (!this.isRootFrame) {
      this.sendMessageToParentFrame(
        PARENT_LAYER_EVENTS.REMOVE_ABSOLUTE_EVENT_LISTENER,
        message,
        event.data.framesPath,
      );
    }

    this.logVerbose(`${message.eventName} event listener removed in frame:`, this.frameSelector);
  };

  resolveAbsoluteEventListener = (event) => {
    this.sendMessageToFrame(
      PARENT_LAYER_EVENTS.RESOLVE_ABSOLUTE_EVENT_LISTENER,
      null,
      event.data.framesPath,
    );
  };

  /*
   Get element data
  */
  getElementData = (initialElementData = {}, requestedData = {}) =>
    new Promise((resolve) => {
      const handleResult = (event) => {
        if (event?.data?.type === PARENT_LAYER_EVENTS.GET_ELEMENT_DATA_RESULT) {
          this.domLayer.removeEventListener('message', handleResult);
          resolve(event.data.message);
        }
      };

      this.domLayer.addEventListener('message', handleResult);
      this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.GET_ELEMENT_DATA, {
        rect: initialElementData.rect,
        interactionPosition: initialElementData.interactionPosition,
        isCovered: initialElementData.isCovered,
        isFocused: initialElementData.isFocused,
        isInViewport: initialElementData.isInViewport,
        isInteractionPointInViewport: initialElementData.isInteractionPointInViewport,
        requestedData,
      });
    });

  handleGetElementDataRequest = (event) => {
    this.logVerbose('Element data requested', event.data);
    const message = { ...event.data.message };
    const frameElement = getFrameElement(event);

    if (frameElement) {
      const frameRect = this.domLayer.getClientRect(frameElement);
      message.rect = calculateBoundingClientRectInsideIframe(message.rect, frameRect);

      if (message.interactionPosition) {
        message.interactionPosition.x += frameRect.x;
        message.interactionPosition.y += frameRect.y;
      }

      if (message.isFocused) {
        message.isFocused = this.domLayer.hasFocus(frameElement);
      }

      if (message.requestedData.isCovered && !message.isCovered) {
        if (!message.interactionPosition) {
          throw new RuntimeError(
            'You have to define interaction position to check if element is covered.',
          );
        }
        message.isCovered = message.isFocused
          ? false
          : !this.domLayer.hasElementOnPosition(message.interactionPosition, frameElement);
      }

      if (message.requestedData.isInViewport) {
        if (message.isInViewport) {
          message.isInViewport = this.domLayer.fitsWindowRect(message.rect);
        }
        if (message.isInteractionPointInViewport) {
          message.isInteractionPointInViewport = this.domLayer.fitsPointWindowRect(
            message.interactionPosition,
          );
        }
      }
    }

    if (!this.isRootFrame) {
      this.sendMessageToParentFrame(
        PARENT_LAYER_EVENTS.GET_ELEMENT_DATA,
        message,
        event.data.framesPath,
      );
    } else {
      this.handleGetElementDataResponse({
        data: {
          framesPath: event.data.framesPath,
          message: pick(
            [
              'rect',
              'isCovered',
              'isFocused',
              'interactionPosition',
              'requestedData',
              'isInViewport',
              'isInteractionPointInViewport',
            ],
            message,
          ),
        },
      });
    }
  };

  handleGetElementDataResponse = (event) => {
    this.sendMessageToFrame(
      PARENT_LAYER_EVENTS.GET_ELEMENT_DATA_RESULT,
      event.data.message,
      event.data.framesPath,
    );

    if (event.data.framesPath.length) {
      this.logVerbose(`Element data was sent to frame ${event.data.framesPath[0]}`, event.data);
    }
  };

  /*
    Update frame selector (also nested)
  */
  updateNestedFrameSelector = (selector) =>
    new Promise((resolve, reject) => {
      // Response from nested frame
      const handleResult = (event) => {
        if (event?.data?.type === PARENT_LAYER_EVENTS.UPDATE_NESTED_FRAME_SELECTOR_RESULT) {
          this.domLayer.removeEventListener('message', handleResult);
          resolve();
        }
        if (event?.data?.type === PARENT_LAYER_EVENTS.SEND_MESSAGE_FAILED) {
          this.domLayer.removeEventListener('message', handleResult);
          reject(deserializeError(event.data.message.error));
        }
      };
      this.domLayer.addEventListener('message', handleResult);

      // Request to nested frame
      try {
        this.logVerbose('[updateNestedFrameSelector] Send request to nested frame');
        this.sendMessageToFrame(
          PARENT_LAYER_EVENTS.UPDATE_NESTED_FRAME_SELECTOR,
          { newFrameSelector: selector },
          [selector],
        );
      } catch (error) {
        this.domLayer.removeEventListener('message', handleResult);
        reject(new FrameDoesNotExist(selector));
      }
    });

  handleUpdateNestedFrameSelectorRequest = async (event) => {
    const message = { ...event.data.message };
    this.logDebug('[handleUpdateNestedFrameSelectorRequest] Update nested frame selector', message);
    this.frameSelector = message.newFrameSelector;
    this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.UPDATE_NESTED_FRAME_SELECTOR_RESULT);
  };

  /*
    Find frame by location (also nested)
  */
  getNestedFrameId = (selector) =>
    new Promise((resolve, reject) => {
      const handleResult = (event) => {
        if (event?.data?.type === PARENT_LAYER_EVENTS.GET_NESTED_FRAME_ID_RESULT) {
          this.domLayer.removeEventListener('message', handleResult);
          resolve(event.data.message.frameId);
        }
        if (event?.data?.type === PARENT_LAYER_EVENTS.SEND_MESSAGE_FAILED) {
          this.domLayer.removeEventListener('message', handleResult);
          reject(deserializeError(event.data.message.error));
        }
      };
      this.domLayer.addEventListener('message', handleResult);

      try {
        this.logVerbose('[getNestedFrameId] Send request to nested frame');
        this.sendMessageToFrame(PARENT_LAYER_EVENTS.GET_NESTED_FRAME_ID, null, [selector]);
      } catch (error) {
        this.domLayer.removeEventListener('message', handleResult);
        reject(new FrameDoesNotExist(selector));
      }
    });

  handleNestedFrameIdRequest = async () => {
    const currentFrameData = await this.getCurrentFrame(this.projectSettings);
    this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.GET_NESTED_FRAME_ID_RESULT, {
      frameId: currentFrameData.frameId,
    });
  };

  /*
   Get current frame data
  */
  getCurrentFrame = (projectSettings) =>
    new Promise((resolve, reject) => {
      if (this.currentFrameData?.location) {
        this.logVerbose('Resolve cached frame data', this.currentFrameData);
        resolve(this.currentFrameData);
        return;
      }

      if (this.isRootFrame) {
        resolve(MAIN_FRAME_DATA);
        return;
      }

      const handleResult = (event) => {
        if (event?.data?.type === PARENT_LAYER_EVENTS.GET_CURRENT_FRAME_RESULT) {
          this.logVerbose('Resolve frame data', event.data.message.frame);
          this.domLayer.removeEventListener('message', handleResult);
          resolve(event.data.message.frame);
        }
        if (event?.data?.type === PARENT_LAYER_EVENTS.SEND_MESSAGE_FAILED) {
          this.domLayer.removeEventListener('message', handleResult);
          reject(deserializeError(event.data.message.error));
        }
      };

      this.domLayer.addEventListener('message', handleResult);
      this.logVerbose('Send frame data request to parent frame');

      this.sendMessageToParentFrame(PARENT_LAYER_EVENTS.GET_CURRENT_FRAME, {
        frame: {
          isRoot: this.isRootFrame,
          frameId: this.frameId,
          src: window.location.href,
          location: '',
        },
        projectSettings,
      });
    });

  handleGetCurrentFrameRequest = (event) => {
    this.logVerbose('Frame data was requested', event.data);
    const message = { ...event.data.message };

    if (!this.isRootFrame) {
      this.logVerbose('Frame data was sent to parent', event.data);

      this.sendMessageToParentFrame(
        PARENT_LAYER_EVENTS.GET_CURRENT_FRAME,
        message,
        event.data.framesPath,
      );
    } else {
      message.frame.location = event.data.framesPath.join(':');
      this.handleGetCurrentFrameResponse({
        data: {
          framesPath: event.data.framesPath,
          message: pick(['frame'], message),
        },
      });
    }
  };

  handleGetCurrentFrameResponse = (event) => {
    this.sendMessageToFrame(
      PARENT_LAYER_EVENTS.GET_CURRENT_FRAME_RESULT,
      event.data.message,
      event.data.framesPath,
    );

    if (event.data.framesPath.length) {
      this.logVerbose(
        `Frame data response was sent to frame ${event.data.framesPath[0]}`,
        event.data,
      );
    }
  };

  reset = () => {
    this.logVerbose('Reset', this.frameId);
    this.eventListeners = {};
    this.listenersIds.clear();
  };
}
