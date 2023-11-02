import { sleep } from '~/utils/misc';

import { FOCUS_REPEAT_INTERVAL_TIME } from './runner.constants';

export default async function focus({ testRunId, tabId, step, shouldSelect }) {
  const runner = this;

  const result = await runner.waitForElement({
    testRunId,
    tabId,
    step,
    timeout: FOCUS_REPEAT_INTERVAL_TIME,
  });

  if (result.isSuccess) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (runner.stopRunning) {
        break;
      }

      result.element.focus();
      if (shouldSelect) {
        if (result.element.select) {
          result.element.select();
        } else {
          window.getSelection().removeAllRanges();
          window.getSelection().selectAllChildren(result.element);
        }
      }

      if (document.activeElement === result.element) {
        break;
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(FOCUS_REPEAT_INTERVAL_TIME);
    }
  }
}
