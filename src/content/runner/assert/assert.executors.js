import { propOr, cond, equals, T } from 'ramda';

import { WAITING_CONDITION_TYPE } from '~/constants/step';
import { ASSERTION_PROPERTY, ASSERTION_TYPE } from '~/constants/test';
import { checkCondition } from '~/content/runner/wait';
import * as exceptions from '~/modules/runner/runner.exceptions';
import { selectRunningTestRunStartTime } from '~/modules/runner/runner.selectors';
import storeRegistry from '~/modules/storeRegistry';
import Logger from '~/services/logger';
import runtimeMessaging, * as command from '~/services/runtimeMessaging';
import { cloneElementWithoutUselessChildren, getElementsBySelector } from '~/utils/browser';
import { catchUnexpectedErrors } from '~/utils/errors';
import { convertBoolToString, genRandomId } from '~/utils/misc';

import { getExpectedValue } from './assert.helpers';

const logger = Logger.get('Assert Executors');

const isVisibleAndNotCovered = async (step, element, isWindow = false) => {
  if (!element) {
    return false;
  }
  const waitingConditions = [
    {
      type: WAITING_CONDITION_TYPE.ELEMENT_IS_VISIBLE,
    },
    {
      type: WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED,
    },
  ];
  const result = await Promise.all(
    waitingConditions.map((condition) => checkCondition(step, condition, element, isWindow)),
  );
  return result.every((condition) => condition.isSuccess);
};

export const assertJavaScript = async (runner, step, element, selector, variables) => {
  let assertionCurrentValue;
  try {
    const tempId = genRandomId();
    const variablesString = JSON.stringify(variables);
    const code = `
      (async function(selector, variables) {
        const element = document.querySelector("[data-angelos-id='${tempId}']");
        if (!element) {
          return false;
        }
        ${step.assertionJavaScript}
    })('${selector}', ${variablesString})`;

    element.setAttribute('data-angelos-id', tempId);
    const result = await new Promise((resolve, reject) => {
      runtimeMessaging
        .sendMessageToBackground(
          { command: command.EXECUTE_CODE, code },
          catchUnexpectedErrors(resolve, { onError: reject, isBackgroundContext: false }),
        )
        .catch(reject);
    });
    element.removeAttribute('data-angelos-id');

    if (result.isError) {
      throw result;
    }
    assertionCurrentValue = convertBoolToString(result);
  } catch (error) {
    logger.error(error);
    throw new exceptions.CodeExecutionError({ error: error.message });
  }
  let success;

  if (assertionCurrentValue === convertBoolToString(true)) {
    success = true;
  }

  return { success, assertionCurrentValue };
};

const compareValues = (currentValue, expectedValue, operator) => {
  const equal = () => currentValue === expectedValue;
  const notEqual = () => currentValue !== expectedValue;
  const contain = () => currentValue.toLowerCase().indexOf(expectedValue.toLowerCase()) !== -1;
  const notContain = () => currentValue.toLowerCase().indexOf(expectedValue.toLowerCase()) === -1;
  const match = () => currentValue.match(new RegExp(expectedValue, 'g')) !== null;
  const notMatch = () => currentValue.match(new RegExp(expectedValue, 'g')) === null;
  const greaterThan = () => {
    const floatCurrentValue = parseFloat(currentValue);
    const floatExpectedValue = parseFloat(expectedValue);
    return floatCurrentValue > floatExpectedValue;
  };
  const lessThan = () => {
    const floatCurrentValue = parseFloat(currentValue);
    const floatExpectedValue = parseFloat(expectedValue);
    return floatCurrentValue < floatExpectedValue;
  };

  return cond([
    [equals(ASSERTION_TYPE.ANY), T],
    [equals(ASSERTION_TYPE.EQUAL), equal],
    [equals(ASSERTION_TYPE.NOT_EQUAL), notEqual],
    [equals(ASSERTION_TYPE.CONTAIN), contain],
    [equals(ASSERTION_TYPE.NOT_CONTAIN), notContain],
    [equals(ASSERTION_TYPE.MATCH), match],
    [equals(ASSERTION_TYPE.NOT_MATCH), notMatch],
    [equals(ASSERTION_TYPE.GREATER_THAN), greaterThan],
    [equals(ASSERTION_TYPE.LESS_THAN), lessThan],
  ])(operator);
};

export const assertContent = (runner, step, element) => {
  const clonedElement = cloneElementWithoutUselessChildren(element);
  let attrCurrentValue = propOr('', step.assertionProperty, clonedElement).trim();

  if (!attrCurrentValue && step.assertionProperty === ASSERTION_PROPERTY.VALUE) {
    attrCurrentValue = (clonedElement.src ?? '').trim();
  }

  const assertExpectedValue = getExpectedValue(step);
  const success = compareValues(attrCurrentValue, assertExpectedValue, step.assertionType);

  return { success, assertionCurrentValue: attrCurrentValue };
};

export const assertCount = (runner, step, element, selector) => {
  const assertionCurrentValue = getElementsBySelector(selector).length;
  const intExpectedValue = parseInt(getExpectedValue(step), 10);

  const equal = () => assertionCurrentValue === intExpectedValue;
  const notEqual = () => assertionCurrentValue !== intExpectedValue;
  const greaterThan = () => assertionCurrentValue > intExpectedValue;
  const lessThan = () => assertionCurrentValue < intExpectedValue;

  const success = cond([
    [equals(ASSERTION_TYPE.EQUAL), equal],
    [equals(ASSERTION_TYPE.NOT_EQUAL), notEqual],
    [equals(ASSERTION_TYPE.GREATER_THAN), greaterThan],
    [equals(ASSERTION_TYPE.LESS_THAN), lessThan],
  ])(step.assertionType);

  return { success, assertionCurrentValue };
};

export const assertVisible = async (runner, step, element) => {
  const success = await isVisibleAndNotCovered(step, element);
  const assertionCurrentValue = convertBoolToString(success);
  return { success, assertionCurrentValue };
};

export const assertNotVisible = async (runner, step, element) => {
  const isVisible = await isVisibleAndNotCovered(step, element);
  const assertionCurrentValue = convertBoolToString(isVisible);
  return { success: !isVisible, assertionCurrentValue };
};

const isChecked = (element) => ['checked', true, 'true'].includes(element.checked);

export const assertChecked = async (runner, step, element) => {
  const success = isChecked(element);
  const assertionCurrentValue = convertBoolToString(success);
  return { success, assertionCurrentValue };
};

export const assertNotChecked = async (runner, step, element) => {
  const success = !isChecked(element);
  const assertionCurrentValue = convertBoolToString(!success);
  return { success, assertionCurrentValue };
};

export const assertPageHasTitle = (runner, step) => {
  const expectedTitle = getExpectedValue(step);
  const currentTitle = document.title;
  const success = compareValues(currentTitle, expectedTitle, step.assertionType);
  return { success, assertionCurrentValue: currentTitle };
};

export const assertPageText = (runner, step) => {
  const expectedPageText = getExpectedValue(step);
  const doesContain = document.body.textContent?.includes(expectedPageText);

  const success = ASSERTION_TYPE.CONTAIN === step.assertionType ? doesContain : !doesContain;

  return {
    success,
    assertionCurrentValue: convertBoolToString(success),
    assertionExpectedValue: 'true',
  };
};

export const assertPageUrlIs = (runner, step) => {
  const expectedUrl = getExpectedValue(step);
  const currentUrl = window.location.href;
  const success = compareValues(currentUrl, expectedUrl, step.assertionType);
  return { success, assertionCurrentValue: currentUrl };
};

export const assertDownloadStarted = async (runner, step) => {
  const expectedFileName = getExpectedValue(step);
  const maxFilesToCheck = 1;
  const testRunStartTime = selectRunningTestRunStartTime(await storeRegistry.getState());

  const result = await new Promise((resolve, reject) => {
    runtimeMessaging
      .sendMessageToBackground(
        {
          command: command.GET_LATEST_DOWNLOADED_FILES,
          query: { limit: maxFilesToCheck, startedAfter: testRunStartTime?.toString() },
        },
        catchUnexpectedErrors(resolve, { onError: reject, isBackgroundContext: false }),
      )
      .catch(reject);
  });

  if (result.isError) {
    throw result;
  }

  const downloadedFile = result[0];
  if (!downloadedFile) {
    runner.logDebug('No downloaded files found since test run started', result);
    return { success: false, assertionCurrentValue: '' };
  }

  const currentFileName = downloadedFile.filename;
  runner.logDebug('Latest file from downloads list: ', currentFileName);

  const success = compareValues(currentFileName, expectedFileName, step.assertionType);
  return { success, assertionCurrentValue: currentFileName };
};
