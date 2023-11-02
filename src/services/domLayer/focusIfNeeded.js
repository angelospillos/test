import { WAITING_CONDITION_TYPE } from '~/constants/step';
import { STEP_TYPE } from '~/constants/test';
import { RunnerActions } from '~/modules/runner/runner.redux';

import runtimeMessaging from '../runtimeMessaging';

export default async function focusIfNeeded(element, step, activeConditions) {
  const domLayer = this;
  const hasActiveFocusCondition = activeConditions.some(
    ({ type }) => type === WAITING_CONDITION_TYPE.ELEMENT_HAS_FOCUS,
  );

  if (!hasActiveFocusCondition) {
    return true;
  }

  const { isFocused } = await domLayer.getElementData(element);
  if (isFocused) {
    return true;
  }

  return new Promise((resolve, reject) => {
    try {
      const eventParams = { once: true, capture: true };
      const eventsToListen = ['click', 'mousedown', 'mouseup'];
      const handleClick = () => {
        eventsToListen.forEach((eventName) => {
          window.removeEventListener(eventName, handleClick, eventParams);
        });

        const hasFocusAfterClick = domLayer.hasFocus(element);
        if (hasFocusAfterClick) {
          domLayer.logVerbose('[focusIfNeeded]', 'Focus set to proper element');
        } else {
          domLayer.logVerbose('[focusIfNeeded]', 'Focus set to invalid element!');
        }

        resolve(hasFocusAfterClick);
      };

      eventsToListen.forEach((eventName) => {
        window.addEventListener(eventName, handleClick, eventParams);
      });

      domLayer.logVerbose('[focusIfNeeded]', 'Click execution requested');
      runtimeMessaging.dispatchActionInBackground(
        RunnerActions.runPlainExecutorRequested({
          ...step,
          type: STEP_TYPE.CLICK,
          waitingConditions: [],
        }),
      );
    } catch (error) {
      reject(error);
    }
  });
}
