import { init, path } from 'ramda';

import { MAIN_FRAME_LOCATION } from '~/constants/test';
import { ContentTypes } from '~/modules/content/content.redux';
import { selectFrameById } from '~/modules/extension/extension.selectors';
import storeRegistry from '~/modules/storeRegistry';
import BaseService from '~/services/baseService';
import { catchUnexpectedErrors } from '~/utils/errors';
import { getCentroid, transformRectToPolygon } from '~/utils/math';
import { genRandomId, sleep } from '~/utils/misc';

import runtimeMessaging, * as command from '../runtimeMessaging';

import {
  DEFAULT_CSS_ZOOM,
  DOCUMENT_READY_CHECK_INTERVAL,
  EMPTY_RECT,
  EVENTS_LISTENERS_DATA_TTL,
} from './domLayer.constants';
import Elements from './elements';
import ElementsRegistry from './elementsRegistry';
import focusIfNeeded from './focusIfNeeded';
import Frames from './frames';
import { isElementVisible } from './helpers';
import Interactions from './interactions';
import scrollIntoViewIfNeeded from './scrollIntoViewIfNeeded';

const REQUESTED_ELEMENT_DATA_DEFAULT = { isCovered: false, isInViewport: false };

export class DOMLayer extends BaseService {
  constructor() {
    super('DOMLayer');
    this.frames = new Frames(this);
    this.elements = new Elements(this);
    this.interactions = new Interactions(this);
    this.elementsRegistry = new ElementsRegistry(this);
    this.elementsListenersCache = new Map();
    this.elementsListenersCacheTTL = new Map();
  }

  init = async (tabId, frameId, projectSettings) => {
    await this.frames.init(tabId, frameId, projectSettings);
  };

  getComputedStyle = (element) => {
    try {
      return window.getComputedStyle(element);
    } catch (error) {
      // eslint-disable-next-line no-console
      this.logDebug('[domLayer] getComputedStyle was invoked on wrong element', element);
      throw error;
    }
  };

  getElementListeners = async (element) => {
    const cachedValue = this.elementsListenersCache.get(element);
    if (cachedValue) {
      return cachedValue;
    }

    if (!element || element === document) {
      // eslint-disable-next-line no-console
      this.logDebug('[domLayer] getElementListeners was invoked on wrong element', element);
      return {};
    }

    // TODO: Performance fix needed. Currently it take between 40 and 120ms to resolve this promise.
    // Probably because of communication time. (content <=> background)
    const tempId = genRandomId();
    element.setAttribute('data-angelos-id', tempId);
    const listeners = await new Promise((resolve, reject) => {
      runtimeMessaging.sendMessageToBackground(
        { command: command.GET_EVENT_LISTENERS, selector: `[data-angelos-id="${tempId}"]` },
        catchUnexpectedErrors(resolve, { onError: reject, isBackgroundContext: false }),
      );
    });
    element.removeAttribute('data-angelos-id');

    // Cache
    this.elementsListenersCache.set(element, listeners);
    this.elementsListenersCacheTTL.set(
      element,
      setTimeout(() => {
        clearTimeout(this.elementsListenersCacheTTL.get(element));
        this.elementsListenersCacheTTL.delete(element);
        this.elementsListenersCache.delete(element);
      }, EVENTS_LISTENERS_DATA_TTL),
    );

    return listeners;
  };

  getClientRect = (element) => {
    if (!element || element === document) {
      // eslint-disable-next-line no-console
      this.logDebug('[domLayer] getClientRect was invoked on wrong element', element);
      return EMPTY_RECT;
    }

    let rect = element.getBoundingClientRect();
    if (!rect) {
      return EMPTY_RECT;
    }

    const hasValidSize = Boolean(rect.width && rect.height);

    /*
      Sometimes elements has weird sizes e.g link contains text and its height equals 0.
      In that case, parent sizes should be used.
    */
    if (!hasValidSize && element.parentElement) {
      rect = element.parentElement.getBoundingClientRect();
    }

    /*
      Some pages (eg. callpage.pl) use `zoom` property (CSS),
      which is not included in .getBoundingClientRect() result
    */
    const zoom = this.getLayoutZoomLevel(element);

    const result = {
      x: rect.left * zoom,
      y: rect.top * zoom,
      left: rect.left * zoom,
      right: rect.right * zoom,
      top: rect.top * zoom,
      bottom: rect.bottom * zoom,
      width: rect.width * zoom,
      height: rect.height * zoom,
      zoom,
      windowDevicePixelRatio: window.devicePixelRatio,
    };

    const centroid = getCentroid(transformRectToPolygon(result));
    result.centroid = [centroid.x, centroid.y];

    return result;
  };

  getLayoutZoomLevel = (element) => {
    /*
      Value of HTML element `zoom` propperty is already included in getBoundingClientRect calculations,
      so omitting HTML element in zoom calculation is required.
    */
    const elementPath = init(this.getPath(element));
    return elementPath.reduce(
      (total, el) => total * parseFloat(this.getComputedStyle(el).zoom || DEFAULT_CSS_ZOOM),
      DEFAULT_CSS_ZOOM,
    );
  };

  getParents = (element) => {
    let node = element.parentElement;
    const parents = [];

    while (node) {
      parents.push(node);
      node = node.parentElement;
    }
    return parents;
  };

  getPath = (element) => {
    if (!element) {
      return [];
    }
    return [element, ...this.getParents(element)];
  };

  hasFocus = (element) => document.activeElement === element;

  isDisabled = (element) =>
    this.getPath(element).some((node) => [true, 'disabled'].includes(node.disabled));

  isClickable = (element) => this.interactions.isClickable(element);

  isCovered = async (element, interactionPositionType, customInteractionCoords) => {
    const { isCovered } = await this.getElementData(
      element,
      interactionPositionType,
      customInteractionCoords,
      {
        isCovered: true,
      },
    );
    return isCovered;
  };

  isInViewport = async (element, interactionPositionType, customInteractionCoords) => {
    const { isInViewport } = await this.getElementData(
      element,
      interactionPositionType,
      customInteractionCoords,
      {
        isInViewport: true,
      },
    );
    return isInViewport;
  };

  isInIframe = () => window.self !== window.top;

  getFrameSelector = () => (this.isInIframe() ? this.frames.frameSelector : MAIN_FRAME_LOCATION);

  getElementOnPosition = (interactionPosition) =>
    document.elementFromPoint(interactionPosition.x, interactionPosition.y);

  hasElementOnPosition = (interactionPosition, element) => {
    const elementAtInteractionPosition = this.getElementOnPosition(interactionPosition);

    if (!elementAtInteractionPosition) {
      return false;
    }

    /*
      On Linux document.elementFromPoint returns sometimes parent element instead of the deepest child
    */
    if (elementAtInteractionPosition.contains(element)) {
      return true;
    }

    for (let current = elementAtInteractionPosition; current; current = current.parentNode) {
      if (current === element) {
        return true;
      }
    }

    return false;
  };

  fitsWindowRect = (elementRect, elementStyles = {}) => {
    // eslint-disable-next-line prefer-const
    let { left, top, height, width, bottom, right } = elementRect;
    if (elementStyles.hasBorderBoxSizing) {
      /*
        If boxSizing is set to "border-box", border size is included in width and height
        so this function will return false after scrollIntoView(nearest) call
        because scrollIntoView omits the border.
      */
      const { borders } = elementStyles;
      const hBorderSize = borders.top + borders.bottom;
      const vBorderSize = borders.left + borders.right;
      bottom -= borders.bottom;
      right -= borders.right;
      left += borders.left;
      top += borders.top;
      width -= hBorderSize;
      height -= vBorderSize;
    }

    const hasBiggerHeightThanViewport = height > window.innerHeight;
    const hasBiggerWidthThanViewport = width > window.innerWidth;

    const fitsYAxis = hasBiggerHeightThanViewport
      ? top <= 0 && bottom >= window.innerHeight
      : top >= 0 && bottom <= window.innerHeight;

    const fitsXAxis = hasBiggerWidthThanViewport
      ? left <= 0 && right >= window.innerWidth
      : left >= 0 && right <= window.innerWidth;

    return fitsYAxis && fitsXAxis;
  };

  fitsPointWindowRect = (point) => {
    const pointRect = {
      left: point.x,
      right: point.x,
      top: point.y,
      bottom: point.y,
      width: 1,
      height: 1,
    };

    return this.fitsWindowRect(pointRect);
  };

  getBoundingClientRect = async (element) => {
    this.logVerbose('Absolute bounding client rect requested in frame:', this.getFrameSelector());

    const { rect } = await this.getElementData(element, null);

    this.logVerbose('Absolute bounding client rect resolved in frame:', this.getFrameSelector());
    return rect;
  };

  getElementData = async (
    element,
    interactionPositionType,
    customInteractionCoords,
    requestedData = REQUESTED_ELEMENT_DATA_DEFAULT,
  ) => {
    this.logVerbose('Absolute element data requested in frame:', this.getFrameSelector());

    this.elements.takeStylesSnapshot([element]);

    const data = {
      rect: this.getClientRect(element),
      interactionPosition: null,
      isCovered: false,
      isFocused: this.hasFocus(element),
      isInViewport: true,
      isInteractionPointInViewport: true,
      coveringElement: null,
      styles: this.elements.getBasicStylesSnapshot(element),
    };

    if (interactionPositionType) {
      data.interactionPosition = await this.interactions.getMousePosition(
        element,
        data.rect,
        interactionPositionType,
        customInteractionCoords,
      );

      data.isCovered = data.isFocused
        ? false
        : requestedData.isCovered && !this.hasElementOnPosition(data.interactionPosition, element);

      if (data.isCovered) {
        data.coveringElement = this.getElementOnPosition(data.interactionPosition);
      }
    }

    if (requestedData.isInViewport) {
      data.isInViewport = this.fitsWindowRect(data.rect, data.styles);
      if (interactionPositionType) {
        data.isInteractionPointInViewport = this.fitsPointWindowRect(
          data.interactionPosition,
          data.styles,
        );
      }
    }

    if (this.isInIframe()) {
      return this.frames.getElementData(data, requestedData);
    }

    return data;
  };

  scrollIntoViewIfNeeded = scrollIntoViewIfNeeded.bind(this);

  focusIfNeeded = focusIfNeeded.bind(this);

  getCurrentFrame = async (projectSettings) => {
    if (this.isInIframe()) {
      return this.frames.getCurrentFrame(projectSettings);
    }

    return {
      location: MAIN_FRAME_LOCATION,
      oldLocation: '0',
      isRoot: true,
      frameId: 0,
      src: window.location.href,
    };
  };

  waitForBody = () => {
    let interval;
    return new Promise((resolve) => {
      interval = setInterval(() => {
        if (document.body) {
          clearInterval(interval);
          resolve(true);
        }
      }, 50);
    });
  };

  isDocumentReady = async (source, timeout = null) => {
    if (document.readyState === 'complete') {
      return Promise.resolve();
    }

    this.logVerbose(`[${source} > isDocumentReady] Waiting for DOM content loaded...`);
    let waitingTimeout;
    let isFinished = false;
    let isTimeouted = false;

    // Waiting for timeout if required
    if (timeout !== null) {
      waitingTimeout = setTimeout(() => {
        this.logVerbose(`[${source} > isDocumentReady] Waiting resolved because of timeout`);
        isFinished = true;
        isTimeouted = true;
      }, timeout);
    }

    // Waiting until document is read or test stop
    const onStopRunning = (event) => {
      const { type, frameId, tabId } = path(['data'], event) ?? {};
      if (this.frames.tabId === tabId && this.frames.frameId === frameId) {
        switch (type) {
          case ContentTypes.STOP_RUNNING_REQUESTED: {
            this.logVerbose(
              `[${source} > isDocumentReady] Waiting resolved because test was stopped`,
            );
            isFinished = true;
            break;
          }
          case ContentTypes.DOM_CONTENT_LOADED: {
            this.logVerbose(
              `[${source} > isDocumentReady] Waiting resolved because document is ready`,
            );
            isFinished = true;
            break;
          }
          default:
            break;
        }
      }
    };
    this.addEventListener('message', onStopRunning);

    // Waiting until document is ready
    while (!isFinished) {
      // eslint-disable-next-line no-await-in-loop
      const state = await storeRegistry.getState();
      const frame = selectFrameById(this.frames.tabId, this.frames.frameId)(state);
      if (frame) {
        this.logVerbose(`[${source} > isDocumentReady] Waiting resolved because DOM was loaded`);
        isFinished = true;
      } else {
        // eslint-disable-next-line no-await-in-loop
        await sleep(DOCUMENT_READY_CHECK_INTERVAL);
      }
    }

    clearTimeout(waitingTimeout);
    this.removeEventListener('message', onStopRunning);
    return Promise.resolve(isTimeouted);
  };

  addEventListener = (type, handler, params) => {
    window.addEventListener(type, handler, params, false);
  };

  removeEventListener = (type, handler, params) => {
    window.removeEventListener(type, handler, params);
  };

  #postMessage = (domElement, message, targetOrigin) => {
    // eslint-disable-next-line no-unused-expressions
    domElement?.postMessage({ ...message, isangelosEvent: true }, targetOrigin);
  };

  postMessage = (...args) => {
    this.#postMessage(window, ...args);
  };

  postParentMessage = (...args) => {
    this.#postMessage(window.parent, ...args);
  };

  isTextHighlighted = () =>
    // detects mouse is highlighting a text
    window.getSelection && window.getSelection().type === 'Range';

  findClosestVisible = (initialElement) => {
    let visibleTarget = initialElement;
    while (!this.isVisible(visibleTarget, true)) {
      visibleTarget = visibleTarget?.parentElement;

      if (!visibleTarget || visibleTarget === document) {
        return null;
      }
    }
    return visibleTarget;
  };

  isVisible = isElementVisible.bind(this);

  /*
    Reset
  */
  reset = () => {
    this.elementsRegistry.reset();
    this.elements.reset();
    this.frames.reset();
    this.elementsListenersCacheTTL.forEach((timeout) => clearTimeout(timeout));
    this.elementsListenersCacheTTL.clear();
    this.elementsListenersCache.clear();
    this.logVerbose('Reset');
  };
}

export default new DOMLayer();
