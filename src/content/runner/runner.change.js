import { HTMLTags } from '~/constants/browser';
import { UnchangableElement, InvalidFieldValue } from '~/modules/runner/runner.exceptions';
import { sleep } from '~/utils/misc';

import { CHANGE_REPEAT_INTERVAL_TIME } from './runner.constants';

export default async function change({ testRunId, step, tabId }) {
  const runner = this;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (runner.stopRunning) {
      break;
    }

    /* eslint-disable-next-line no-await-in-loop */
    const result = await runner.waitForElement({
      testRunId,
      tabId,
      step,
      timeout: CHANGE_REPEAT_INTERVAL_TIME,
    });

    const htmlElementByTagName = {
      [HTMLTags.INPUT]: HTMLInputElement,
      [HTMLTags.TEXTAREA]: HTMLTextAreaElement,
      [HTMLTags.SELECT]: HTMLSelectElement,
    };

    const HTMLElement = htmlElementByTagName[result.element?.tagName];

    if (!HTMLElement) {
      runner.logPotentialTimeoutReason(testRunId, new UnchangableElement());
    } else {
      // Fucking React, i've spend 7 hours looking for this
      // ~ Paweł
      const setValue = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'value').set;
      setValue.call(result.element, step.computedValue || step.value);

      result.element.dispatchEvent(new Event('input'));
      result.element.dispatchEvent(new Event('change', { bubbles: true }));

      if (result.element.value === (step.computedValue || step.value)) {
        break;
      }

      runner.logPotentialTimeoutReason(
        testRunId,
        new InvalidFieldValue({ error: result.element.value }),
      );
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(CHANGE_REPEAT_INTERVAL_TIME);
  }
}
