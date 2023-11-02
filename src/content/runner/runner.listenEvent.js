import debounce from 'lodash.debounce';

import { CURSOR_ANIMATION_TIME_MS } from '~/constants/animations';
import { EVENT_TYPE, INTERACTION_POSITION_TYPE } from '~/constants/test';
import { ContentActions } from '~/modules/content/content.redux';
import * as exceptions from '~/modules/runner/runner.exceptions';
import storage from '~/services/browser/storage';
import domLayer from '~/services/domLayer';
import runtimeMessaging from '~/services/runtimeMessaging';
import { getElementFullXPath } from '~/utils/selectors';

import BaseExecutor from './executor';

export default class ListenEventExecutor extends BaseExecutor {
  constructor(runner, ...params) {
    super('ListenEventExecutor', runner, ...params);
  }

  setup = async () => {
    const [eventPositionX, eventPositionY] = this.params.eventParams;
    const { eventName } = this.params;
    this.registeredHandlers = [];

    this.logDebug(
      `[${eventName}] Waiting for an element on position (${eventPositionX}, ${eventPositionY})`,
    );
    const result = await this.runner.waitForElement(this.context);
    this.element = result?.element;
  };

  execute = () => {
    const [eventPositionX, eventPositionY] = this.params.eventParams;
    const { step, testRunId } = this.context;
    const { eventName } = this.params;

    return new Promise((resolve, reject) => {
      const throwError = (event) => {
        const invalidElementSelector = getElementFullXPath(event.target);
        reject(new exceptions.EventDispatchedOnInvalidElement(invalidElementSelector));
      };
      const finish = (listenEventName) => {
        this.logDebug(`[${listenEventName}] Related step was set as executed in storage.`);
        storage.setStepExecuted(step.id);
        domLayer.elementsRegistry.reset();
        this.runner.logPotentialTimeoutReason(testRunId, null);
        resolve();
      };

      const sharedParams = {
        element: this.element,
        interactionPosition: step.interactionPosition,
        onSuccess: finish,
        onFailure: throwError,
      };

      this.#waitForEvent({
        eventName,
        waitTime: EVENT_TYPE.MOUSEMOVE ? CURSOR_ANIMATION_TIME_MS : 0,
        ...sharedParams,
      });

      if (EVENT_TYPE.CLICK === eventName) {
        // In case when click is handled by mouseDown
        this.#waitForEvent({ eventName: EVENT_TYPE.MOUSEDOWN, ...sharedParams });
        // In case when click is blocked by preventDefault
        this.#waitForEvent({ eventName: EVENT_TYPE.MOUSEUP, ...sharedParams });
      }

      this.logDebug(
        `[${eventName}] Waiting for event emitted on (${eventPositionX}, ${eventPositionY}):`,
        this.element,
      );
      runtimeMessaging.dispatchActionInBackground(
        ContentActions.listenEventInitialized(step.id, step.type),
      );
    });
  };

  cleanUp = () => {
    this.logVerbose(`[${this.params.eventName}] Listeners clean up`);
    this.registeredHandlers.forEach(({ name, handler, options }) => {
      window.removeEventListener(name, handler, options);
      domLayer.frames.removeEventListener(name, handler, options);
    });
    this.registeredHandlers = [];
  };

  #waitForEvent = ({
    element,
    eventName,
    interactionPosition,
    onSuccess,
    onFailure,
    waitTime = 0,
  }) => {
    const isValidTarget = domLayer.interactions.getTargetValidator(element);

    const handleEvent = async (event) => {
      if (event.fromParentContext) {
        this.logInfo(`[${eventName}] Failed. Invalid execution context.`);
        onFailure(event);
        return;
      }

      const styles = domLayer.getComputedStyle(event.target);
      const target = styles.display !== 'contents' ? event.target : event.target.parentNode;
      this.logVerbose(`[${eventName}] Event catched! Target:`, target);

      const isSmartInteraction = interactionPosition === INTERACTION_POSITION_TYPE.SMART;
      const isOverValidElement = isSmartInteraction
        ? await isValidTarget(target)
        : // Required element or all nested elements
          element.contains(target);

      if (!isOverValidElement) {
        event.preventDefault();
        event.stopPropagation();
        this.logDebug(`[${eventName}] Failed. Invalid target`, element, target);
        onFailure(event);
      } else {
        onSuccess(eventName);
        this.logVerbose(`[${eventName}] Success!`);
      }
    };

    const eventListener = {
      name: eventName,
      handler: waitTime ? debounce(handleEvent, waitTime) : handleEvent,
      options: { once: true, capture: true },
    };

    window.addEventListener(eventListener.name, eventListener.handler, eventListener.options);
    domLayer.frames.addEventListener(
      eventListener.name,
      eventListener.handler,
      eventListener.options,
      true,
      true,
    );
    this.registeredHandlers.push(eventListener);
  };
}
