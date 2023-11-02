import { always, cond, equals, indexBy, pipe, prop } from 'ramda';

import { HTMLTags } from '~/constants/browser';
import { SELECT_TYPE } from '~/constants/step';
import {
  UnchangableElement,
  ElementDoesNotExist,
  InvalidOptionIndex,
  MissingOptionText,
  MissingOptionValue,
  MissingOptionIndex,
} from '~/modules/runner/runner.exceptions';
import storage from '~/services/browser/storage';
import { removeExtraWhiteSpace, sleep } from '~/utils/misc';

import { CHANGE_REPEAT_INTERVAL_TIME } from './runner.constants';
import { getElement } from './wait';

const getOptionSelectorResolver = cond([
  [equals(SELECT_TYPE.TEXT), always(pipe(prop('textContent'), removeExtraWhiteSpace))],
  [equals(SELECT_TYPE.VALUE), always(pipe(prop('value'), removeExtraWhiteSpace))],
  [equals(SELECT_TYPE.INDEX), always(prop('index'))],
]);

const getMissingOptionError = cond([
  [equals(SELECT_TYPE.TEXT), (type, text) => new MissingOptionText(text)],
  [equals(SELECT_TYPE.VALUE), (type, value) => new MissingOptionValue(value)],
  [equals(SELECT_TYPE.INDEX), (type, index) => new MissingOptionIndex(index)],
]);

export default async function select({ testRunId, step, tabId }) {
  const runner = this;
  const resolveOptionSelector = getOptionSelectorResolver(step.selectType);
  runner.logDebug('[Select] Start');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (runner.stopRunning) {
      break;
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await getElement(step);
    runner.updateStepRunResult(testRunId, tabId, step.id, result);

    if (!result.elementExists) {
      runner.logPotentialTimeoutReason(testRunId, new ElementDoesNotExist());
    } else if (result.isSuccess) {
      runner.logDebug('[Select] Successfully resolved element');

      if (result.element.tagName !== HTMLTags.SELECT) {
        runner.logPotentialTimeoutReason(testRunId, new UnchangableElement());
      } else {
        // Reset select at the beginning
        [...result.element.options].forEach((option) => {
          // eslint-disable-next-line no-param-reassign
          option.removeAttribute('selected');
        });

        const optionsMap = indexBy(resolveOptionSelector, result.element.options || []);
        let optionsSelectors = (step.computedValue || step.value).split('\n');
        if (!step.selectIsMultiple) {
          optionsSelectors = optionsSelectors.slice(0, 1);
        }

        for (let index = 0; index < optionsSelectors.length; index += 1) {
          const optionSelector = optionsSelectors[index];

          if (step.selectType === SELECT_TYPE.INDEX && /\D/.test(optionSelector)) {
            runner.logPotentialTimeoutReason(testRunId, new InvalidOptionIndex(optionSelector));
          } else {
            const optionToSelect = optionsMap[optionsSelectors[index]];
            runner.logDebug('[Select] Options to select', optionToSelect);
            if (optionToSelect) {
              optionToSelect.setAttribute('selected', 'selected');

              // DIRTY HACK, for some clients frameworks
              // Issue: (DEV-2784) https://www.photobook.com.my/, created using boxx.ai, react
              if (!step.selectIsMultiple) {
                result.element.value = optionToSelect.value;
              }
            } else {
              runner.logPotentialTimeoutReason(
                testRunId,
                getMissingOptionError(step.selectType, optionSelector),
              );
            }
          }
        }

        result.element.dispatchEvent(new Event('input'));
        result.element.dispatchEvent(new Event('change', { bubbles: true }));

        runner.logDebug(
          '[Select] Checking if all options are selected',
          result.element.selectedOptions.length,
          optionsSelectors.length,
        );
        if (result.element.selectedOptions.length === optionsSelectors.length) {
          const selectedOptionsSelectors = indexBy(
            resolveOptionSelector,
            result.element.selectedOptions,
          );
          const areRequestedOptionsSelected = optionsSelectors.every((optionSelector) =>
            Boolean(selectedOptionsSelectors[optionSelector]),
          );

          if (areRequestedOptionsSelected) {
            storage.setStepExecuted(step.id);
            break;
          }
        }
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(CHANGE_REPEAT_INTERVAL_TIME);
  }
}
