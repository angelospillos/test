import debounce from 'lodash.debounce';
import { prop } from 'ramda';

import { WAITING_CONDITION_TYPE } from '~/constants/step';
import { STEP_TYPE } from '~/constants/test';
import animationsControl from '~/content/runner/animationsControl';
import { getElement } from '~/content/runner/wait';
import { ContentActions } from '~/modules/content/content.redux';
import { selectTabMousePosition } from '~/modules/extension/extension.selectors';
import * as exceptions from '~/modules/runner/runner.exceptions';
import StoreRegistry, { STORE_TYPES } from '~/modules/storeRegistry';
import BaseService from '~/services/baseService';
import domLayer from '~/services/domLayer';
import runtimeMessaging from '~/services/runtimeMessaging';
import { getRelatedRectsToMouseoverFromPointToElement } from '~/utils/browser';
import { captureExceptionAsWarning } from '~/utils/errors';

const getProxyState = () => StoreRegistry.get(STORE_TYPES.PROXY).getState();
const getCurrentMouseXY = (tabId) => selectTabMousePosition(tabId)(getProxyState());

const FALLBACK_SCHEDULE_INTERVAL = 1000;
const RESIZE_DEBOUNCE_INTERVAL = 50;
const WHEEL_DEBOUNCE_INTERVAL = 50;
const GET_ELEMENT_RECT_SCHEDULE_TIMEOUT = 50;

const failedWaitingConditions = new exceptions.FailedWaitingConditions();

class ElementFinder extends BaseService {
  constructor(config = {}) {
    super('ElementFinder');
    this.pendingStep = null;
    this.getElementRectCycleIsRunning = false;
    this.scheduleTimeout = null;
    this.stopRunning = false;
    this.fallbackSchedule = null;
    this.threshold = [];
    for (let n = 0.0; n < 1; n += 0.01) {
      this.threshold.push(n);
    }
    this.updateStepRunResult = config.updateStepRunResult;
    this.logPotentialTimeoutReason = config.logPotentialTimeoutReason;
  }

  start = async () => {
    await domLayer.waitForBody();
    animationsControl.start();
    this.startMutationObserver();
    this.bindEventListeners();
  };

  stop = () => {
    this.stopRunning = true;
    clearTimeout(this.scheduleTimeout);
    clearInterval(this.fallbackSchedule);
    animationsControl.stop();
  };

  bindEventListeners = () => {
    document.addEventListener('transitionend', this.scheduleGetElementRectCycle);
    document.addEventListener('transitioncancel', this.scheduleGetElementRectCycle);
    document.addEventListener('animationend', this.handleAnimationEnd);
    document.addEventListener('DOMContentLoaded', this.handleDOMContentLoaded);
    document.addEventListener('readystatechange', this.handleReadyStateChange);
    document.addEventListener('wheel', this.handleWheel);
    window.addEventListener('resize', this.handleResize);
    this.fallbackSchedule = setInterval(() => {
      // This can handle for example img lazy loading (img.onload alternative easier to maintain)
      // By conception very rare situations
      this.scheduleGetElementRectCycle();
    }, FALLBACK_SCHEDULE_INTERVAL);
  };

  removeEventListeners = () => {
    document.removeEventListener('transitionend', this.scheduleGetElementRectCycle);
    document.removeEventListener('transitioncancel', this.scheduleGetElementRectCycle);
    document.removeEventListener('animationend', this.handleAnimationEnd);
    document.removeEventListener('DOMContentLoaded', this.handleDOMContentLoaded);
    document.removeEventListener('readystatechange', this.handleReadyStateChange);
    document.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('resize', this.handleResize);
    clearInterval(this.fallbackSchedule);
  };

  startMutationObserver = () => {
    const config = {
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      childList: true,
    };
    this.observer = new MutationObserver(this.handleMutation);
    this.observer.observe(document.body, config);
  };

  setPendingStep = (testRunId, tabId, step) => {
    if (this.pendingStep) {
      this.logVerbose('pendingStep is already set!', this.pendingStep, 'new', step);
      return;
    }
    const intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      threshold: this.threshold,
    });
    this.pendingStep = {
      step,
      testRunId,
      tabId,
      isPending: true,
      intersectionObserver,
    };
  };

  setTimeoutGetElementRectSchedule = () => {
    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
    }
    this.scheduleTimeout = setTimeout(
      this.scheduleGetElementRectCycle,
      GET_ELEMENT_RECT_SCHEDULE_TIMEOUT,
    );
  };

  scheduleGetElementRectCycle = () => {
    this.runGetElementRectCycle = true;
    this.getElementRectCycle();
  };

  getElementRectCycle = async () => {
    if (this.stopRunning || this.getElementRectCycleIsRunning || !this.runGetElementRectCycle) {
      return;
    }
    this.getElementRectCycleIsRunning = true;
    this.runGetElementRectCycle = false;
    if (this.pendingStep) {
      await this.getElementRect(this.pendingStep);
    }
    this.getElementRectCycleIsRunning = false;
    if (this.runGetElementRectCycle && this.pendingStep) {
      this.getElementRectCycle();
    }
  };

  handleWheel = debounce(() => {
    this.scheduleGetElementRectCycle();
  }, WHEEL_DEBOUNCE_INTERVAL);

  handleResize = debounce(() => {
    this.scheduleGetElementRectCycle();
  }, RESIZE_DEBOUNCE_INTERVAL);

  handleMutation = () => {
    this.scheduleGetElementRectCycle();
  };

  handleIntersection = () => {
    this.scheduleGetElementRectCycle();
  };

  handleAnimationEnd = () => {
    this.scheduleGetElementRectCycle();
  };

  handleDOMContentLoaded = () => {
    this.scheduleGetElementRectCycle();
  };

  handleReadyStateChange = () => {
    this.scheduleGetElementRectCycle();
  };

  getElementRectSucceeded = (
    step,
    selector,
    rect,
    relatedRects,
    interactionPosition,
    isFocused,
  ) => {
    this.pendingStep = undefined;
    runtimeMessaging.dispatchActionInBackground(
      ContentActions.getElementRectSucceeded(
        step.id,
        selector,
        rect,
        relatedRects,
        interactionPosition,
        isFocused,
      ),
    );
  };

  hasUnfulfilledIsNotMovingWaitingCondition = (conditionsState) => {
    const elementIsNotMovingState = prop(
      WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_ANIMATING,
      conditionsState,
    );
    if (!elementIsNotMovingState) {
      return false;
    }

    return !elementIsNotMovingState.isSuccess && !elementIsNotMovingState.isSoftSuccess;
  };

  getElementRect = async ({ testRunId, tabId, step, isPending = false }) => {
    if (this.stopRunning) {
      this.logDebug('[getElementRect] Declined due to stopped test run');
      return;
    }

    try {
      this.logDebug('[getElementRect] start', step.type, isPending);
      const result = await getElement(step, true);

      const {
        element,
        isSuccess,
        conditionsState,
        elementExists,
        interactionPosition,
        rect,
        isFocused,
        computedSelector,
        selector,
      } = result;
      this.updateStepRunResult(testRunId, tabId, step.id, result);

      if (isSuccess) {
        const currentMousePosition = getCurrentMouseXY(tabId);
        const relatedRects = getRelatedRectsToMouseoverFromPointToElement(
          currentMousePosition,
          element,
        );

        this.logPotentialTimeoutReason(testRunId, null);
        this.getElementRectSucceeded(
          step,
          computedSelector || selector,
          rect,
          relatedRects,
          interactionPosition,
          isFocused,
        );
      } else {
        if (!elementExists) {
          this.logPotentialTimeoutReason(
            testRunId,
            step.type === STEP_TYPE.SWITCH_CONTEXT
              ? new exceptions.FrameDoesNotExist(step.frameLocation)
              : new exceptions.ElementDoesNotExist(),
          );
        }
        if (elementExists) {
          this.logPotentialTimeoutReason(testRunId, failedWaitingConditions);
        }
        if (!isPending) {
          this.setPendingStep(testRunId, tabId, step);
        }

        if (this.hasUnfulfilledIsNotMovingWaitingCondition(conditionsState)) {
          this.logDebug('[getElementRect] Scheduled recall due to unfullfilled moving condition');
          this.setTimeoutGetElementRectSchedule();
        }
      }
    } catch (error) {
      if (error instanceof exceptions.RunnerError) {
        this.logError('[getElementRect] exception!', error);
        throw error;
      }
      captureExceptionAsWarning(error, {}, false);
      if (!isPending) {
        this.setPendingStep(testRunId, tabId, step);
      }
      this.logDebug('[getElementRect] Scheduled recall due to expected error', error);
      this.setTimeoutGetElementRectSchedule();
    }
  };

  reset = () => {
    this.stop();
    this.removeEventListeners();
  };
}

export default ElementFinder;
