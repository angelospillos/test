import { always, cond, equals, mergeDeepRight } from 'ramda';

import { ASSERTION_PROPERTY } from '~/constants/test';
import { AssertFailedError, ElementDoesNotExist } from '~/modules/runner/runner.exceptions';
import Logger from '~/services/logger';
import { isPageAssertion, sleep } from '~/utils/misc';

import { ASSERT_REPEAT_INTERVAL_TIME } from '../runner.constants';
import { getElement, getWindow } from '../wait';

import * as assertExecutors from './assert.executors';

const logger = Logger.get('Assert');

const assertFailedError = new AssertFailedError();
const elementDoesNotExistError = new ElementDoesNotExist();

const getExecutor = cond([
  [equals(ASSERTION_PROPERTY.TEXT_CONTENT), always(assertExecutors.assertContent)],
  [equals(ASSERTION_PROPERTY.VALUE), always(assertExecutors.assertContent)],
  [equals(ASSERTION_PROPERTY.COUNT), always(assertExecutors.assertCount)],
  [equals(ASSERTION_PROPERTY.VISIBLE), always(assertExecutors.assertVisible)],
  [equals(ASSERTION_PROPERTY.NOT_VISIBLE), always(assertExecutors.assertNotVisible)],
  [equals(ASSERTION_PROPERTY.CHECKED), always(assertExecutors.assertChecked)],
  [equals(ASSERTION_PROPERTY.NOT_CHECKED), always(assertExecutors.assertNotChecked)],
  [
    equals(ASSERTION_PROPERTY.NOT_EXIST),
    always((runner, stepData, element) => ({ success: !element })),
  ],
  [
    equals(ASSERTION_PROPERTY.EXIST),
    always((runner, stepData, element) => ({ success: !!element })),
  ],
  [equals(ASSERTION_PROPERTY.CUSTOM_JAVASCRIPT), always(assertExecutors.assertJavaScript)],
  [equals(ASSERTION_PROPERTY.PAGE_HAS_TITLE), always(assertExecutors.assertPageHasTitle)],
  [equals(ASSERTION_PROPERTY.PAGE_SHOWS_TEXT), always(assertExecutors.assertPageText)],
  [equals(ASSERTION_PROPERTY.PAGE_DOES_NOT_SHOW_TEXT), always(assertExecutors.assertPageText)],
  [equals(ASSERTION_PROPERTY.PAGE_URL_IS), always(assertExecutors.assertPageUrlIs)],
  [equals(ASSERTION_PROPERTY.DOWNLOAD_STARTED), always(assertExecutors.assertDownloadStarted)],
]);

export default async function assert({ step, tabId, testRunId, variables }) {
  logger.debug('start', step.assertionProperty);

  const runner = this;
  let assertionResult = {
    assertionExpectedValue: step.assertionExpectedValue,
    computedAssertionExpectedValue: step.computedAssertionExpectedValue,
    assertionProperty: step.assertionProperty,
    assertionType: step.assertionType,
    assertionJavaScript: step.assertionJavaScript,
    assertionCurrentValue: null,
    success: false,
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (runner.stopRunning) {
      logger.debug('terminated by timeout', step.assertionProperty);
      break;
    }
    const isPageAssert = isPageAssertion(step);
    // eslint-disable-next-line no-await-in-loop
    const elementResult = await (isPageAssert ? getWindow(step) : getElement(step));
    runner.updateStepRunResult(testRunId, tabId, step.id, {
      ...elementResult,
      ...assertionResult,
    });

    const { element, selector, computedSelector, isSuccess, elementExists } = elementResult;

    assertionResult.selector = selector;
    assertionResult.computedSelector = computedSelector;

    const notRequireElementAtStart = [
      ASSERTION_PROPERTY.NOT_EXIST,
      ASSERTION_PROPERTY.EXIST,
    ].includes(step.assertionProperty);

    const execute = getExecutor(step.assertionProperty);

    if (notRequireElementAtStart) {
      runner.logPotentialTimeoutReason(testRunId, assertFailedError);
      assertionResult = mergeDeepRight(
        assertionResult,
        // eslint-disable-next-line no-await-in-loop
        await execute(runner, step, element, null),
      );
    } else if (!elementExists) {
      runner.logPotentialTimeoutReason(testRunId, elementDoesNotExistError);
    } else if (isSuccess) {
      runner.logPotentialTimeoutReason(testRunId, assertFailedError);
      assertionResult = mergeDeepRight(
        assertionResult,
        // eslint-disable-next-line no-await-in-loop
        await execute(runner, step, element, computedSelector || selector, variables),
      );
    }

    if (assertionResult.success) {
      logger.debug('finished', step.assertionProperty);
      runner.logPotentialTimeoutReason(testRunId, null);
      break;
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(ASSERT_REPEAT_INTERVAL_TIME);
  }

  return assertionResult;
}
