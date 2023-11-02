import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';
import { nanoid } from 'nanoid';
import { always, cond, equals, partial } from 'ramda';

import { HTMLInputTypes, HTMLTags } from '~/constants/browser';
import {
  EVENT_TYPE,
  INTERACTION_POSITION_TYPE,
  MOUSE_EVENT_TYPES,
  RECORDING_MODE,
  MUTATION_SCREENSHOT_THROTTLE_TIME_MS,
} from '~/constants/test';
import ElementInspector from '~/content/recorder/elementInspector';
import { captureScreenshot, getScrollValues } from '~/content/recorder/recorder.helpers';
import { KEYDOWN_EXCLUDED_KEY_CODES } from '~/modules/recorder/recorder.constants';
import { RecorderActions, RecorderTypes } from '~/modules/recorder/recorder.redux';
import {
  selectHasInitialState,
  selectIsMulitpleModeEnabled,
  selectIsRecording,
  selectPendingLocalVariableEvent,
  selectRecordingMode,
  selectRecordingProjectSettings,
} from '~/modules/recorder/recorder.selectors';
import storeRegistry from '~/modules/storeRegistry';
import BaseService from '~/services/baseService';
import domLayer from '~/services/domLayer';
import { getFrameElement } from '~/services/domLayer/helpers';
import Logger from '~/services/logger';
import { showInvalidElementTypeMessage } from '~/services/messages';
import runtimeMessaging from '~/services/runtimeMessaging';
import {
  getElementAttributes,
  keyCodes,
  isScrollInteraction,
  isSecretField,
  isIgnoredInputInteraction,
} from '~/utils/browser';
import { calculateBoundingClientRectInsideIframe } from '~/utils/dom';
import { KEYS } from '~/utils/keyboardLayout';
import { extractTextContent, genFrontId, hasLabelTag } from '~/utils/misc';
import { getElementSelectors, getElementFullXPath } from '~/utils/selectors';

import EventsCatcherLayer from '../services/eventsCatcher';

import assert from './recorder.assert';
import change from './recorder.change';
import dragAndDrop from './recorder.dnd';
import hover from './recorder.hover';

const RESIZE_DEBOUNCE_WAIT = 50;

// Chrome API constant
// https://developer.chrome.com/docs/extensions/reference/tabs/#property-MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
const MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND = 2;

const logger = Logger.get('Recorder');
export class Recorder extends BaseService {
  constructor() {
    super('Recorder');
    this.eventsCatcherLayer = new EventsCatcherLayer();
    this.init();
    this.eventToFuncMap = {
      [EVENT_TYPE.CLICK]: this.click,
      [EVENT_TYPE.RIGHT_CLICK]: this.rightClick,
      [EVENT_TYPE.CHANGE]: this.change,
      [EVENT_TYPE.INPUT]: this.change,
      [EVENT_TYPE.KEYDOWN]: this.keydown,
      [EVENT_TYPE.KEYUP]: this.keyup,
      [EVENT_TYPE.MOUSEDOWN]: this.mousedown,
      [EVENT_TYPE.MOUSEUP]: this.mouseup,
      [EVENT_TYPE.MOUSEOVER]: this.mouseover,
      [EVENT_TYPE.MOUSEOUT]: this.mouseout,
      [EVENT_TYPE.MOUSEMOVE]: this.mousemove,
      [EVENT_TYPE.SELECT]: this.select,
      [EVENT_TYPE.SCROLL]: this.scroll,
      [EVENT_TYPE.WHEEL]: this.wheel,
      [EVENT_TYPE.PASTE]: this.paste,
      [EVENT_TYPE.FOCUS]: this.focus,
    };
    this.eventToOptionsMap = {
      [EVENT_TYPE.SCROLL]: { passive: true, capture: true },
      [EVENT_TYPE.WHEEL]: { passive: true, capture: true },
    };
    const eventNames = Object.keys(this.eventToFuncMap);
    eventNames.forEach((eventName) => {
      const func = this.eventToFuncMap[eventName];
      this.eventToFuncMap[eventName] = {
        handler: partial(this.eventListenerWrapper, [func]),
        options: this.eventToOptionsMap[eventName] || true,
      };
    });
  }

  get projectSettings() {
    if (!this.settings) {
      this.settings = selectRecordingProjectSettings(this.getState());
    }
    return this.settings;
  }

  getState = () => storeRegistry.getProxyState();

  isMultipleModeEnabled = () => selectIsMulitpleModeEnabled(this.getState());

  isRecording = () => selectIsRecording(this.getState()) && !selectHasInitialState(this.getState());

  init = () => {
    this.initialScroll = false;
    this.clientX = -1;
    this.clientY = -1;
    this.isMouseDownActive = false;
    this.isSelectActive = false;
    this.lastRawMouseDownEvent = {};
    this.lastEvent = {};
    this.lastEvents = {};
    this.lastFocusElement = null;
    this.lastEventTargetValue = null;
    this.lastMouseoverDetails = {};
    this.frameworks = {};
    this.isScreenshotCapturing = false;
    this.screenshotCaptureTriggered = false;
    this.targetsMap = new Map();
    this.sessionId = nanoid(8);

    this.keyDownCaptureScreenshot = (event) => {
      if ((!event.shiftKey && KEYS.Enter.key === event.key) || KEYS.Tab.key === event.key) {
        requestAnimationFrame(this.captureScreenshot);
      }
    };

    /*
      We have to throttle screenshot capturing due to Chrome Extension API limits,
      which were introduced since Chrome v92.

      https://groups.google.com/a/chromium.org/g/chromium-extensions/c/sQUlaHXjlhY
    */
    this.throttledCaptureScreenshot = throttle(
      this.captureScreenshot,
      1000 / MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND,
    );
    this.throttledCaptureScreenshotOnMutation = throttle(
      this.captureScreenshot,
      MUTATION_SCREENSHOT_THROTTLE_TIME_MS,
    );
  };

  reset = () => {
    this.removeListeners();
    this.resetScreenshotRecorder();
    this.init();
  };

  initScreenshotRecorder = async () => {
    document.addEventListener('transitionend', this.throttledCaptureScreenshot);
    document.addEventListener('transitioncancel', this.throttledCaptureScreenshot);
    document.addEventListener('animationend', this.throttledCaptureScreenshot);
    document.addEventListener('DOMContentLoaded', this.throttledCaptureScreenshot);
    document.addEventListener('readystatechange', this.throttledCaptureScreenshot);
    window.addEventListener('keydown', this.keyDownCaptureScreenshot);
    window.addEventListener('mouseup', this.throttledCaptureScreenshot);
    window.addEventListener('resize', this.resizeCaptureScreenshot);

    const config = {
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      childList: true,
    };
    this.observer = new MutationObserver(this.throttledCaptureScreenshotOnMutation);
    await domLayer.waitForBody();
    this.observer.observe(document.body, config);
  };

  resetScreenshotRecorder = () => {
    document.removeEventListener('transitionend', this.throttledCaptureScreenshot);
    document.removeEventListener('transitioncancel', this.throttledCaptureScreenshot);
    document.removeEventListener('animationend', this.throttledCaptureScreenshot);
    document.removeEventListener('DOMContentLoaded', this.throttledCaptureScreenshot);
    document.removeEventListener('readystatechange', this.throttledCaptureScreenshot);
    window.removeEventListener('keydown', this.keyDownCaptureScreenshot);
    window.removeEventListener('mouseup', this.throttledCaptureScreenshot);
    window.removeEventListener('resize', this.resizeCaptureScreenshot);
    if (this.observer) {
      this.observer.disconnect();
    }
  };

  resizeCaptureScreenshot = () => debounce(this.captureScreenshot, RESIZE_DEBOUNCE_WAIT);

  setLastEvent = (type, eventData) => {
    this.lastEvents[type] = eventData;
  };

  getLastEvent = (type) => this.lastEvents[type];

  setIsSelectActive = (state) => {
    this.isSelectActive = state;
  };

  setIsMouseDownActive = (state) => {
    this.isMouseDownActive = state;
  };

  getTargetId = (target) => {
    if (!this.targetsMap.has(target)) {
      this.targetsMap.set(target, nanoid(8));
    }
    return this.targetsMap.get(target);
  };

  switchToRegularEventsRecording = () => {
    runtimeMessaging.dispatchActionInBackground(RecorderActions.modeSwitched(RECORDING_MODE.EVENT));
    this.eventsCatcherLayer.enableMouseEventsWithPropagation();
    ElementInspector.remove();
  };

  dumpEventDetails = async (event, overrideDetails = {}) => {
    const isTargetDocument = event.target === document;
    let target = isTargetDocument ? document.documentElement : event.target;
    const rect = domLayer.getClientRect(target);
    const styles = domLayer.getComputedStyle(target);
    target = styles.display !== 'contents' ? target : target.parentNode;
    const timestamp = new Date().getTime();

    const attributes = !isTargetDocument ? getElementAttributes(target) : {};
    const frame = await domLayer.getCurrentFrame(this.projectSettings);

    const eventData = {
      timestamp,
      frontId: genFrontId(),
      targetId: this.getTargetId(target),
      isTargetCreatedRecently: domLayer.elements.isCreatedRecently(target),
      hasChangedVisibilityRecently: domLayer.elements.hasChangedVisibility(target),
      isTargetDocument,
      isSelectActive: this.isSelectActive,
      isDisabled: !isTargetDocument ? domLayer.isDisabled(target) : false,
      xpath: getElementFullXPath(target, document),
      parentXPath: getElementFullXPath(target.parentElement, document),
      selectors: getElementSelectors(target, this.projectSettings),
      hostname: window.location.hostname,
      positionLeft: event.x,
      positionTop: event.y,
      tagName: target.tagName,
      tagAttributes: attributes,
      params: {},
      isVisible: !isTargetDocument ? domLayer.isVisible(target, true) : true,
      isCovered: await domLayer.isCovered(target, INTERACTION_POSITION_TYPE.CENTER),
      isFocused: document.activeElement === target,
      hasSecretValue: isSecretField(target),
      clientX: event.clientX,
      clientY: event.clientY,
      hasLabelTag: hasLabelTag(event),
      isTrusted: event.isTrusted,
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight,
      windowDevicePixelRatio: window.devicePixelRatio,
      textContent: extractTextContent(target),
      frameworks: this.frameworks,
      frameLocation: frame.location,
      frameNo: frame.no,
      frameSrc: frame.src,
      frameIsRoot: frame.isRoot,
      frameSessionId: this.sessionId,
      ...rect,
      ...getScrollValues(event, isTargetDocument),
    };

    const extraProps = ['key', 'keyCode', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey'];

    for (let i = 0; i < extraProps.length; i += 1) {
      const extraProp = extraProps[i];
      if (event[extraProp]) {
        eventData[extraProp] = event[extraProp];
      }
    }

    if (MOUSE_EVENT_TYPES.includes(event.type)) {
      eventData.interactionPosition = this.lastMouseoverDetails.interactionPosition;
    }

    return { ...eventData, ...overrideDetails };
  };

  addEventRequested = async (type, eventDetails, withScreenshot = true) => {
    if (!eventDetails.isTrusted) {
      logger.verbose(`Event ${type} is not trusted. Omitting...`, eventDetails);
    } else {
      const newEvent = {
        ...eventDetails,
        type,
        withScreenshot,
      };
      this.lastEvent = newEvent;
      this.setLastEvent(type, newEvent);

      domLayer.frames.sendMessageToParentFrame(RecorderTypes.ADD_EVENT_REQUESTED, {
        newEvent,
      });
    }
  };

  handleAddEventRequested = (event) => {
    const { message } = event.data;
    const { newEvent } = message;
    const frame = getFrameElement(event);
    if (frame) {
      Object.assign(
        newEvent,
        calculateBoundingClientRectInsideIframe(newEvent, domLayer.getClientRect(frame)),
      );
    }

    if (domLayer.isInIframe()) {
      domLayer.frames.sendMessageToParentFrame(RecorderTypes.ADD_EVENT_REQUESTED, {
        newEvent,
      });
    } else {
      newEvent.windowInnerHeight = window.innerHeight;
      newEvent.windowInnerWidth = window.innerWidth;
      runtimeMessaging.dispatchActionInBackground(RecorderActions.addEventRequested(newEvent));
    }
  };

  isInternalShortcut = ({ keyCode, target }) =>
    target === EVENT_TYPE.KEYDOWN && [keyCodes.ESC].includes(keyCode);

  recordOnEvent = async (mode, event, handleEventFn) => {
    const { type } = event;
    const excludeLogging = [EVENT_TYPE.MOUSEMOVE, EVENT_TYPE.MOUSEOVER, EVENT_TYPE.MOUSEOUT];

    if (!excludeLogging.includes(type)) {
      logger.verbose('event', type, event.target, event);
    }

    if (type === EVENT_TYPE.MOUSEOVER) {
      ElementInspector.update(event, mode);
    }

    if (type === EVENT_TYPE.SCROLL) {
      ElementInspector.remove();
    }

    await handleEventFn(event);
  };

  recordOnAssertOrHover = async (mode, event, handleEventFn) => {
    const { type } = event;

    if ([EVENT_TYPE.CLICK, EVENT_TYPE.MOUSEUP, EVENT_TYPE.MOUSEDOWN].includes(type)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    switch (type) {
      case EVENT_TYPE.MOUSEDOWN: {
        if (!this.eventsCatcherLayer.areMouseEventsEnabled()) {
          Object.defineProperty(event, 'target', {
            value: this.eventsCatcherLayer.getClosestToTargetNonBlockingElement(event),
          });
        }
        if (mode === RECORDING_MODE.ASSERT) {
          this.addAssertion(event);
        }
        if (mode === RECORDING_MODE.HOVER) {
          this.hover(event);
        }
        break;
      }
      case EVENT_TYPE.MOUSEOVER: {
        if (this.eventsCatcherLayer.areMouseEventsEnabled()) {
          ElementInspector.update(event, mode);
        }
        break;
      }
      case EVENT_TYPE.MOUSEMOVE: {
        if (!this.eventsCatcherLayer.areMouseEventsEnabled()) {
          const closestTarget = this.eventsCatcherLayer.getClosestToTargetNonBlockingElement(event);
          if (closestTarget instanceof HTMLIFrameElement) {
            this.eventsCatcherLayer.enableMouseEventAfterIFrameHover();
          }

          Object.defineProperty(event, 'target', {
            value: closestTarget,
          });

          ElementInspector.update(event, mode, true);
        }
        break;
      }
      case EVENT_TYPE.MOUSEOUT: {
        if (domLayer.isInIframe() && this.eventsCatcherLayer.isLayerEvent(event)) {
          this.eventsCatcherLayer.disableMouseEventsWithPropagation();
        }
        break;
      }
      case EVENT_TYPE.MOUSEUP:
      case EVENT_TYPE.CLICK: {
        if (!this.isMultipleModeEnabled()) {
          this.switchToRegularEventsRecording();
        }
        break;
      }
      case EVENT_TYPE.WHEEL: {
        await handleEventFn(event);
        break;
      }
      case EVENT_TYPE.SCROLL: {
        ElementInspector.remove();
        await handleEventFn(event);
        break;
      }
      default:
        break;
    }
  };

  recordOnLocalVariableSetOrInsert = async (mode, event, handleEventFn) => {
    const { type } = event;

    if ([EVENT_TYPE.CLICK, EVENT_TYPE.MOUSEUP, EVENT_TYPE.MOUSEDOWN].includes(type)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    switch (type) {
      case EVENT_TYPE.MOUSEDOWN: {
        if (mode === RECORDING_MODE.SET_LOCAL_VARIABLE) {
          await this.setLocalVariable(event);
        }
        if (mode === RECORDING_MODE.INSERT_LOCAL_VARIABLE) {
          await this.insertLocalVariable(event);
        }
        break;
      }
      case EVENT_TYPE.MOUSEOVER: {
        ElementInspector.update(event, mode);
        break;
      }
      case EVENT_TYPE.WHEEL: {
        await handleEventFn(event);
        break;
      }
      case EVENT_TYPE.SCROLL: {
        ElementInspector.remove();
        await handleEventFn(event);
        break;
      }
      default:
        break;
    }
  };

  record = async (mode, ...args) =>
    cond([
      [equals(RECORDING_MODE.EVENT), always(this.recordOnEvent)],
      [equals(RECORDING_MODE.ASSERT), always(this.recordOnAssertOrHover)],
      [equals(RECORDING_MODE.HOVER), always(this.recordOnAssertOrHover)],
      [equals(RECORDING_MODE.SET_LOCAL_VARIABLE), always(this.recordOnLocalVariableSetOrInsert)],
      [equals(RECORDING_MODE.INSERT_LOCAL_VARIABLE), always(this.recordOnLocalVariableSetOrInsert)],
    ])(mode)(mode, ...args);

  isEventInvokedOnangelosElement = (event) => {
    const angelosContainer = document.querySelector('.angelos-app');
    return event.target && angelosContainer && angelosContainer.contains(event.target);
  };

  eventListenerWrapper = async (func, event) => {
    const mode = selectRecordingMode(this.getState());
    if (!this.isRecording()) {
      return;
    }

    if (this.isEventInvokedOnangelosElement(event)) {
      ElementInspector.remove();
      return;
    }

    await this.record(mode, event, func);
  };

  bindListeners() {
    const eventNames = Object.keys(this.eventToFuncMap);
    eventNames.forEach((eventName) => {
      document.addEventListener(
        eventName,
        this.eventToFuncMap[eventName].handler,
        this.eventToFuncMap[eventName].options,
      );
    });
  }

  removeListeners() {
    // Used in tests
    const eventNames = Object.keys(this.eventToFuncMap);
    eventNames.forEach((eventName) => {
      document.removeEventListener(
        eventName,
        this.eventToFuncMap[eventName].handler,
        this.eventToFuncMap[eventName].options,
      );
    });
  }

  isInvalidTarget = (element) => [document.querySelector('HTML'), document].includes(element);

  captureScreenshot = () => {
    if (!this.isRecording()) {
      return;
    }
    captureScreenshot();
  };

  mousemove = (event) => {
    this.clientX = event.clientX;
    this.clientY = event.clientY;
  };

  mouseover = (event) => {
    this.lastMouseoverDetails = {
      target: event.target,
      fromElement: event.fromElement,
      isVisible: domLayer.isVisible(event.target),
      interactionPosition: INTERACTION_POSITION_TYPE.SMART,
    };
  };

  setLocalVariable = async (event) => {
    const eventDetails = await this.dumpEventDetails(event);
    eventDetails.value = event.target.textContent || event.target.value;

    runtimeMessaging.dispatchActionInBackground(
      RecorderActions.setPendingLocalVariableEventSucceeded(eventDetails),
    );
    this.lastEventTargetValue = eventDetails.value;
  };

  insertLocalVariable = async (event) => {
    if (
      this.isInvalidTarget(event.target) ||
      !(
        event.target.tagName === HTMLTags.TEXTAREA ||
        (event.target.tagName === HTMLTags.INPUT &&
          [
            HTMLInputTypes.TEXT,
            HTMLInputTypes.PASSWORD,
            HTMLInputTypes.NUMBER,
            HTMLInputTypes.SEARCH,
            HTMLInputTypes.EMAIL,
          ].includes(event.target.type)) ||
        event.target?.getAttribute?.('contenteditable') === 'true'
      ) ||
      isScrollInteraction(event)
    ) {
      showInvalidElementTypeMessage();
      return;
    }
    const eventDetails = await this.dumpEventDetails(event);
    const variable = selectPendingLocalVariableEvent(this.getState())?.variable ?? {};
    eventDetails.oldValue = this.getTargetValue(event);
    eventDetails.value = variable.computed;
    eventDetails.usedVariableName = variable.name;

    this.updateTargetValue(event, `${event.target.value}${variable.computed}`);
    event.target.focus();

    runtimeMessaging.dispatchActionInBackground(
      RecorderActions.setPendingLocalVariableEventSucceeded(null),
    );

    this.addEventRequested(EVENT_TYPE.INSERT_LOCAL_VARIABLE, eventDetails, true);
    this.lastEventTargetValue = [eventDetails.oldValue, eventDetails.value].join('');
    this.switchToRegularEventsRecording();
  };

  mouseout = () => {};

  mousedown = async (event) => {
    this.setIsMouseDownActive(true);
    this.setIsSelectActive(false);
    if (
      this.isInvalidTarget(event.target) ||
      isScrollInteraction(event) ||
      isIgnoredInputInteraction(event)
    ) {
      return;
    }

    domLayer.elements.stopWatchingElements();
    this.lastRawMouseDownEvent = event;

    const overrideDetails = {};
    if (event.target === this.lastMouseoverDetails.target) {
      overrideDetails.isVisible = this.lastMouseoverDetails.isVisible;
    }
    const eventDetails = await this.dumpEventDetails(event, overrideDetails);
    eventDetails.isOptionClick = this.isOptionElement(eventDetails);

    switch (event.button) {
      case 0: // left
        this.addEventRequested(EVENT_TYPE.MOUSEDOWN, eventDetails);
        break;
      case 2: // right
        this.addEventRequested(EVENT_TYPE.RIGHT_CLICK, eventDetails);
        break;
      default:
        break;
    }
    domLayer.elements.clearCreatedElements();
  };

  mouseup = async (event) => {
    this.setIsMouseDownActive(false);
    if (this.isInvalidTarget(event.target) || isScrollInteraction(event)) {
      return;
    }
    domLayer.elements.stopWatchingElements();

    const eventDetails = await this.dumpEventDetails(event);
    this.addEventRequested(EVENT_TYPE.MOUSEUP, eventDetails);

    await this.dragAndDrop(event);
    this.lastRawMouseDownEvent = {};
    domLayer.elements.clearCreatedElements();
  };

  getTargetValue = (event) => {
    const isContenteditable = event.target.getAttribute?.('contenteditable') || false;
    return isContenteditable ? event.target.textContent : event.target.value;
  };

  updateTargetValue = (event, value) => {
    const isContenteditable = event.target.getAttribute('contenteditable') || false;

    const prototype = Object.getPrototypeOf(event.target);
    const setValue = Object.getOwnPropertyDescriptor(
      prototype,
      isContenteditable ? 'textContent' : 'value',
    ).set;
    setValue.call(event.target, value);

    event.target.dispatchEvent(new Event('input', { bubbles: true }));
    event.target.dispatchEvent(new Event('change', { bubbles: true }));
  };

  keyup = (event) => {
    if (this.hasShortcutPressed(event) || KEYDOWN_EXCLUDED_KEY_CODES.includes(event.keyCode)) {
      return;
    }
    this.lastEventTargetValue = this.getTargetValue(event);
  };

  hasShortcutPressed = (event) => {
    if (event.altKey && /^\d+$/.test(event.key)) {
      return true;
    }

    return event.ctrlKey || event.metaKey;
  };

  keydown = async (event) => {
    if (this.hasShortcutPressed(event) || KEYDOWN_EXCLUDED_KEY_CODES.includes(event.keyCode)) {
      return;
    }
    domLayer.elements.stopWatchingElements();

    const eventDetails = await this.dumpEventDetails(event);
    eventDetails.oldValue = this.getTargetValue(event) || '';
    eventDetails.enterOrTab = [KEYS.Enter.keyCode, KEYS.Tab.keyCode].includes(event.keyCode);

    this.setIsSelectActive(false);
    let withScreenshot = false;

    if (
      this.lastEvent.type !== EVENT_TYPE.KEYDOWN ||
      this.lastEvent.targetId !== eventDetails.targetId ||
      !eventDetails.oldValue ||
      this.lastEvent.keyCode === KEYS.Enter.keyCode
      // Enter on input means that we should generate new screenshot (cause field may handle this
      // enter key and focus will be still in field but value will be empty)
    ) {
      withScreenshot = true;
    }

    if (
      this.lastEvent.type === EVENT_TYPE.KEYDOWN &&
      this.lastEvent.targetId === eventDetails.targetId &&
      (this.hasShortcutPressed(this.lastEvent) || this.lastEvent.altKey || this.lastEvent.shiftKey)
    ) {
      withScreenshot = true;
    }

    if (withScreenshot) {
      this.captureScreenshot();
    }

    this.addEventRequested(EVENT_TYPE.KEYDOWN, eventDetails, withScreenshot);
    this.lastEventTargetValue = this.getTargetValue(event);
    domLayer.elements.clearCreatedElements();
  };

  isOptionElement = (eventDetails, rect = {}) =>
    eventDetails.tagName === HTMLTags.OPTION ||
    (eventDetails.clientX === 0 &&
      eventDetails.clientY === 0 &&
      (eventDetails.clientX < rect.left || eventDetails.clientX > rect.right) &&
      (eventDetails.clientY < rect.top || eventDetails.clientY > rect.bottom));

  click = async (event) => {
    this.setIsSelectActive(false);

    if (
      event.target === document.querySelector('HTML') ||
      isScrollInteraction(event) ||
      isIgnoredInputInteraction(event, this.lastEvent)
    ) {
      return;
    }
    const rect = domLayer.getClientRect(event.target);
    if (!rect) {
      return;
    }

    domLayer.elements.stopWatchingElements();
    const eventDetails = await this.dumpEventDetails(event);

    // mouse over clicked element
    eventDetails.mouseOverClickedElement =
      this.clientX >= rect.left &&
      this.clientX <= rect.right &&
      this.clientY >= rect.top &&
      this.clientY <= rect.bottom;

    // event emitted on option click
    eventDetails.isOptionClick = this.isOptionElement(eventDetails, rect);

    this.addEventRequested(
      event.detail === 2 ? EVENT_TYPE.DOUBLE_CLICK : EVENT_TYPE.CLICK,
      eventDetails,
    );
    domLayer.elements.clearCreatedElements();
  };

  select = () => {
    this.setIsSelectActive(!!window.getSelection()?.toString()?.length);
  };

  paste = async (event) => {
    const paste = (
      event.clipboardData ||
      window.clipboardData ||
      event.originalEvent?.clipboardData
    )?.getData('text');

    const eventDetails = await this.dumpEventDetails(event);
    this.setIsSelectActive(false);
    eventDetails.value = paste;
    eventDetails.oldValue = this.getTargetValue(event);
    this.addEventRequested(EVENT_TYPE.PASTE, eventDetails, true);
    this.lastEventTargetValue = eventDetails.isSelectActive
      ? paste
      : [eventDetails.oldValue, paste].join('');
  };

  wheel = () => {
    const eventData = { timestamp: new Date().getTime() };
    this.setLastEvent(EVENT_TYPE.WHEEL, eventData);
  };

  #isScrollInvokedByUser = (eventDetails) => {
    const lastWheelEvent = this.lastEvents[EVENT_TYPE.WHEEL];
    return (
      (eventDetails.isTargetDocument &&
        lastWheelEvent &&
        this.initialScroll.timestamp - lastWheelEvent.timestamp < 100) ||
      (lastWheelEvent && !eventDetails.isTargetDocument) ||
      this.initialScroll.isMouseDownActive
    );
  };

  scroll = async (event) => {
    const shouldInitScroll = !this.initialScroll;

    if (shouldInitScroll) {
      this.initialScroll = {
        timestamp: new Date().getTime(),
        isMouseDownActive: this.isMouseDownActive,
        ...getScrollValues(event),
      };

      const eventDetails = await this.dumpEventDetails(event);
      if (this.#isScrollInvokedByUser(eventDetails)) {
        domLayer.elements.startWatchingElements();
      }
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(async () => {
      const eventDetails = await this.dumpEventDetails(event);

      this.captureScreenshot();

      if (this.#isScrollInvokedByUser(eventDetails)) {
        if (this.initialScroll) {
          eventDetails.timestamp = this.initialScroll.timestamp;
          eventDetails.windowScrollX = this.initialScroll.scrollX;
          eventDetails.windowScrollY = this.initialScroll.scrollY;
        }

        this.addEventRequested(EVENT_TYPE.SCROLL, eventDetails, false);
      }
      this.initialScroll = null;
      this.setLastEvent(EVENT_TYPE.WHEEL, null);
    }, 100);
  };

  change = change.bind(this);

  rightClick = async (event) => {
    if (isScrollInteraction(event)) {
      return;
    }
    const rect = domLayer.getClientRect(event.target);
    if (!rect) {
      return;
    }

    domLayer.elements.stopWatchingElements();
    const eventDetails = await this.dumpEventDetails(event);

    this.addEventRequested(EVENT_TYPE.RIGHT_CLICK, eventDetails);
    domLayer.elements.clearCreatedElements();
  };

  addAssertion = (event) => {
    domLayer.elements.stopWatchingElements();
    assert.call(this, event);
    domLayer.elements.clearCreatedElements();
  };

  hover = (event) => {
    domLayer.elements.stopWatchingElements();
    hover.call(this, event);
    domLayer.elements.clearCreatedElements();
  };

  focus = (event) => {
    if (this.lastFocusElement !== event.target) {
      this.captureScreenshot();
    }
    this.lastFocusElement = event.target;
  };

  dragAndDrop = dragAndDrop.bind(this);

  answerPrompt = (result) => {
    this.addEventRequested(
      EVENT_TYPE.ANSWER_PROMPT,
      {
        timestamp: new Date().getTime(),
        isTrusted: true,
        isTargetDocument: true,
        frontId: genFrontId(),
        value: result,
      },
      false,
    );
  };
}

export default new Recorder();
