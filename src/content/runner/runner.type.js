import { EVENT_TYPE } from '~/constants/test';
import { ContentActions } from '~/modules/content/content.redux';
import {
  EventDispatchedOnInvalidElement,
  TypedTextDifferentThanExpected,
  RunnerError,
} from '~/modules/runner/runner.exceptions';
import storage from '~/services/browser/storage';
import domLayer from '~/services/domLayer';
import runtimeMessaging from '~/services/runtimeMessaging';
import * as keyboardLayout from '~/utils/keyboardLayout';
import { sleep } from '~/utils/misc';
import { getElementFullXPath } from '~/utils/selectors';

import { EVENT_CHECK_REPEAT_INTERVAL_TIME } from './runner.constants';

export default async function type({ testRunId, step, tabId, eventParams }) {
  const runner = this;
  const [requiredTextValue] = eventParams;
  runner.logVerbose(`[Type] Waiting for an element`);

  const result = await runner.waitForElement({ testRunId, tabId, step });
  if (runner.stopRunning) {
    return;
  }

  const registeredHandlers = [];
  let eventResult;

  const cleanUp = () => {
    runner.logVerbose(`[Type] Listeners clean up`);

    registeredHandlers.forEach(({ name, handler, options }) => {
      window.removeEventListener(name, handler, options);
      domLayer.frames.removeEventListener(name, handler, options);
    });
  };

  const waitForEvent = (listenEventName) => {
    let collectedText = '';
    // TODO: Switch to replaceAll after migration to Node 14-LTS
    const transformedRequiredValue = requiredTextValue
      .split('\n')
      .join(keyboardLayout.KEY_TO_SEQUENCE_MAP[keyboardLayout.KEYS.Enter.key]);

    const handleEvent = async (event) => {
      const isValidElement = event.target === result.element;

      if (!isValidElement) {
        runner.logInfo(
          '[Type] Failed. Invalid element. Probably the correct element lost focus.',
          result.element,
          event.target,
        );
        const invalidElementSelector = getElementFullXPath(event.target);
        eventResult = eventResult || new EventDispatchedOnInvalidElement(invalidElementSelector);
        cleanUp();
        return;
      }

      collectedText += keyboardLayout.getSequenceByKey(event.key);

      const isPartiallyValidText = transformedRequiredValue.startsWith(collectedText);
      const isValidText = transformedRequiredValue === collectedText;

      if (!isPartiallyValidText) {
        runner.logVerbose('[Type] Failed. Invalid value.', collectedText, result.element);
        eventResult = eventResult || new TypedTextDifferentThanExpected();
        return;
      }

      if (isValidText) {
        runner.logVerbose(`[Type] Related step was set as executed in storage.`);
        domLayer.elementsRegistry.reset();

        /*
          We need to set step to executed asap because some form fields are removed
          from DOM tree e.g after clicking tab or enter button.
          In this scenario ELEMENT_REMOVED event will force test runner to repeat this step.
        */
        storage.setStepExecuted(step.id);
        eventResult = eventResult || event;
        cleanUp();
      }
    };

    const eventListener = {
      name: listenEventName,
      handler: handleEvent,
      options: { capture: true },
    };

    window.addEventListener(eventListener.name, eventListener.handler, eventListener.options);
    domLayer.frames.addEventListener(
      eventListener.name,
      eventListener.handler,
      eventListener.options,
      true,
      true,
    );
    registeredHandlers.push(eventListener);
  };

  waitForEvent(EVENT_TYPE.KEYDOWN);
  waitForEvent(EVENT_TYPE.KEYUP);

  runner.logVerbose(
    `[Type] Waiting for proper value in element: ${requiredTextValue}`,
    result.element,
  );
  runtimeMessaging.dispatchActionInBackground(
    ContentActions.listenEventInitialized(step.id, step.type),
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (runner.stopRunning) {
      cleanUp();
      break;
    }

    if (!eventResult) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(EVENT_CHECK_REPEAT_INTERVAL_TIME);
    } else if (eventResult instanceof RunnerError) {
      cleanUp();
      throw eventResult;
    } else {
      cleanUp();
      runner.logPotentialTimeoutReason(testRunId, null);
      runner.logVerbose(`[Type] Success!`);
      break;
    }
  }
}
