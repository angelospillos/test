/* eslint-disable max-classes-per-file */
import memoize from 'lodash.memoize';
import { head, sortBy, prop, either, indexBy, isEmpty } from 'ramda';

import { WAITING_CONDITION_TYPE } from '~/constants/step';
import BaseService from '~/services/baseService';
import domLayer from '~/services/domLayer';
import Logger from '~/services/logger';
import { getElementBySelector, getElementsListBySelectors } from '~/utils/browser';

import { RELATED_WAITING_CONDITIONS } from './wait.constants';
import { checkCondition, isSoftConditionLimitExceeded, isHardCondition } from './wait.helpers';

const logger = Logger.get('ElementResolver');

const initialResult = {
  elementExists: false,
  selector: null,
  conditionsState: {},
  isSuccess: false,
  isSoftSuccess: false,
  element: null,
  coveringElement: null,
};

export class ElementResolver extends BaseService {
  constructor(step, isWindow = false, shouldReturnDetails = false) {
    super('ElementResolver');
    this.isWindow = isWindow;
    this.shouldReturnDetails = shouldReturnDetails;

    const { waitingConditions = [], selectors = [] } = step;
    this.#initWaitingConditions(waitingConditions, step);
    this.#initSelector(selectors);
    this.step = step;
  }

  #selector = null;

  #computedSelector = null;

  #initWaitingConditions = (waitingConditions, step) => {
    const excluded = [WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION];

    this.activeConditions = waitingConditions.filter(
      (condition) => condition.isActive && !excluded.includes(condition.type),
    );
    this.hardConditions = this.activeConditions.filter((condition) =>
      isHardCondition(step, condition.type),
    );
  };

  #initSelector = (selectors) => {
    this.selectors = selectors;
    const activeSelectorData = head(selectors.filter(prop('isActive')));

    this.#selector = activeSelectorData?.selector;
    this.hasCustomSelector = prop('isCustom', activeSelectorData);

    if (this.hasCustomSelector) {
      this.#computedSelector = activeSelectorData?.computedSelector;
    }
  };

  get selector() {
    return this.#computedSelector || this.#selector;
  }

  isConditionActive = memoize(
    (stepId, conditionType) =>
      this.activeConditions.some((condition) => conditionType === condition.type),
    (stepId, conditionType) => `${stepId}.${conditionType}`,
  );

  checkIsSuccess = (conditionsState) =>
    Object.values(conditionsState).every(
      either(prop('isIgnored'), either(prop('isSuccess'), prop('isSoftSuccess'))),
    );

  checkWaitingConditions = async (step, conditions, element, isWindow) => {
    let detailsMatchRatio = 0;

    const customInteractionCoords = {
      x: step.clientX,
      y: step.clientY,
    };

    if (element) {
      if (!isSoftConditionLimitExceeded(Date.now())) {
        await domLayer.scrollIntoViewIfNeeded(element, {
          interactionPosition: step.interactionPosition,
          customInteractionCoords,
          ignoreVisibility: !this.isConditionActive(
            step.id,
            WAITING_CONDITION_TYPE.ELEMENT_IS_VISIBLE,
          ),
        });
      }
      await domLayer.focusIfNeeded(element, step, this.activeConditions);

      const rect = element.getBoundingClientRect();
      const widthCorrelation = parseInt(rect.width, 10) / parseInt(step.width, 10);
      const heightCorrelation = parseInt(rect.height, 10) / parseInt(step.height, 10);
      detailsMatchRatio = Math.abs(1 - widthCorrelation) + Math.abs(1 - heightCorrelation);
      logger.debug(
        '[checkWaitingConditions]',
        step.id,
        step.type,
        'correlation',
        widthCorrelation,
        heightCorrelation,
      );
    }

    const result = await Promise.all(
      conditions.map((condition) =>
        checkCondition(step, condition, element, isWindow, customInteractionCoords),
      ),
    );

    const conditionsState = indexBy(prop('type'), result);
    const conditionsResults = Object.values(conditionsState);

    return {
      detailsMatchRatio,
      conditionsState,
      isSuccess: this.checkIsSuccess(conditionsState),
      isSoftSuccess: conditionsResults.some(prop('isSoftSuccess')),
    };
  };

  #resolveElement = async () => {
    const result = { ...initialResult };

    if (this.selector) {
      const elementBySelector = getElementBySelector(this.selector);
      this.logVerbose('elementBySelector', elementBySelector);
      let element = null;

      if (elementBySelector) {
        element = domLayer.elementsRegistry.create(this.selector, elementBySelector);
      }

      this.logVerbose('element', element);

      const { conditionsState, isSuccess, isSoftSuccess } = await this.checkWaitingConditions(
        this.step,
        this.activeConditions,
        element,
      );
      if (element) {
        result.element = element;
        result.elementExists = true;
      }
      result.selector = this.#selector;
      result.computedSelector = this.#computedSelector;
      result.hasCustomSelector = this.hasCustomSelector;
      result.conditionsState = conditionsState;
      result.isSuccess = result.elementExists && isSuccess;
      result.isSoftSuccess = result.elementExists && isSoftSuccess;
    } else {
      /*
        This part runs always on the first test run after recording.
        It's happening because after recording none of selectors is set to active.
      */
      const elementsList = getElementsListBySelectors(this.step);
      if (elementsList.length) {
        for (let index = 0; index < elementsList.length; index += 1) {
          const item = elementsList[index];
          item.element = domLayer.elementsRegistry.create(item.selector, item.element);
        }
        const validElements = await Promise.all(
          elementsList.map((item) =>
            this.checkWaitingConditions(this.step, this.activeConditions, item.element),
          ),
        );
        for (let i = 0; i < elementsList.length; i += 1) {
          Object.assign(validElements[i], elementsList[i]);
        }
        const bestMatch = head(sortBy(prop('detailsMatchRatio'))(validElements));

        if (bestMatch) {
          if (bestMatch.element) {
            result.element = bestMatch.element;
            result.elementExists = !!bestMatch.element;
          }
          result.selector = bestMatch.selector;
          result.computedSelector = bestMatch.computedSelector;
          result.hasCustomSelector = false;
          result.conditionsState = bestMatch.conditionsState;
          result.isSuccess = result.elementExists && bestMatch.isSuccess;
          result.isSoftSuccess = result.elementExists && bestMatch.isSoftSuccess;
        }
      }
    }

    if (this.shouldReturnDetails && result.element) {
      const customInteractionCoords = { x: this.step.clientX, y: this.step.clientY };
      const { rect, interactionPosition, isFocused } = await domLayer.getElementData(
        result.element,
        this.step.interactionPosition,
        customInteractionCoords,
      );
      result.rect = rect;
      result.interactionPosition = interactionPosition;
      result.isFocused = isFocused;
    }
    this.logVerbose('result', result);
    return result;
  };

  #resolveWindow = async () => {
    const result = { ...initialResult };

    const { conditionsState, isSuccess, isSoftSuccess } = await this.checkWaitingConditions(
      this.step,
      this.activeConditions,
      null,
      true,
    );
    result.elementExists = true;
    result.conditionsState = conditionsState;
    result.isSuccess = isSuccess;
    result.isSoftSuccess = isSoftSuccess;
    return result;
  };

  cleanUpCoveringElement = (result) => {
    const transformedResult = { ...result };
    const { conditionsState } = transformedResult;

    transformedResult.coveringElement =
      conditionsState[WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED].coveringElement;
    delete conditionsState[WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED].coveringElement;

    return transformedResult;
  };

  setIgnoredConditions = (result) => {
    const transformedResult = { ...result };
    const leadingConditionTypes = Object.keys(RELATED_WAITING_CONDITIONS);

    for (let index = 0; index < leadingConditionTypes.length; index += 1) {
      const conditionType = leadingConditionTypes[index];
      const leadingCondition = transformedResult.conditionsState[conditionType];

      if (leadingCondition && !leadingCondition.isSuccess) {
        const relatedConditions = RELATED_WAITING_CONDITIONS[conditionType];

        for (let j = 0; j < relatedConditions.length; j += 1) {
          const relatedCondition = transformedResult.conditionsState[relatedConditions[j]];

          if (relatedCondition) {
            relatedCondition.isIgnored = true;
          }
        }
      }
    }

    return transformedResult;
  };

  setSoftConditions = (result) => {
    const transformedResult = { ...result };

    const hasUnresolvedHardConditions = this.hardConditions.some(
      ({ type }) => !transformedResult.conditionsState[type].isSuccess,
    );

    if (!hasUnresolvedHardConditions) {
      for (let index = 0; index < this.activeConditions.length; index += 1) {
        const condition = this.activeConditions[index];
        const conditionState = transformedResult.conditionsState[condition.type];

        if (
          conditionState &&
          !conditionState.isSuccess &&
          !isHardCondition(this.step, condition.type)
        ) {
          conditionState.isSoftSuccess = true;
        }
      }
      transformedResult.isSoftSuccess = true;
    }

    return transformedResult;
  };

  transformResult = (result) => {
    let transformedResult = { ...result };
    const hasConditions = !isEmpty(transformedResult.conditionsState);

    if (hasConditions) {
      const elementIsCovered =
        transformedResult.conditionsState[WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED];
      // Covering element cleanup
      if (elementIsCovered && !elementIsCovered.isSuccess) {
        transformedResult = this.cleanUpCoveringElement(transformedResult);
      }

      // Ignored conditions
      if (!transformedResult.isSuccess) {
        this.logVerbose('Looking for conditions which could be ignored...');
        transformedResult = this.setIgnoredConditions(transformedResult);
      }

      // Soft conditions
      if (!transformedResult.isSuccess && isSoftConditionLimitExceeded(Date.now())) {
        this.logVerbose('Soft conditions time limit exceeded. Resolving conditions softly...');
        transformedResult = this.setSoftConditions(transformedResult);
      }
    }

    transformedResult.isSuccess =
      transformedResult.elementExists && this.checkIsSuccess(transformedResult.conditionsState);
    return transformedResult;
  };

  run = async () => {
    const result = await Promise.race([
      this.isWindow ? this.#resolveWindow() : this.#resolveElement(),
    ]);
    return this.transformResult(result);
  };
}

export const getElement = async (step, shouldReturnDetails) => {
  logger.verbose('getElement', step);
  const elementResolver = new ElementResolver(step, false, shouldReturnDetails);
  return elementResolver.run();
};

export const getWindow = async (step) => {
  logger.verbose('getWindow', step);
  const elementResolver = new ElementResolver(step, true);
  return elementResolver.run();
};
