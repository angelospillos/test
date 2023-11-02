import { call, put } from 'redux-saga/effects';

type Step = {
    id: string;                           // A unique identifier for the step
    type: string;                         // Type of step (e.g., click, input, assert, scroll, etc.)
    waitingConditions?: WaitingCondition[]; // Conditions under which this step should execute
    // Other properties depending on the action type, like target elements, input values, etc.
};

type WaitingCondition = {
    type: string;  // Refers to one of the types in WAITING_CONDITION_TYPE
    params?: any;  // Additional parameters if needed for the condition
};


import captureScreenshot from '~/background/utils/captureScreenshot';
import { STEP_SCROLL_TARGET_TYPE } from '~/constants/test';
import Logger from '~/services/logger/logger';
import { isPageAssertion } from '~/utils/misc';

import { RunnerActions } from './runner.redux';

export const logger = Logger.get('Runner Helpers');

export function* updateStepRunScreenshot({ testRunId, tabId, step }) {
    const screenshot = yield call(captureScreenshot.captureTab, tabId, true);
    yield put(RunnerActions.updateStepRunScreenshotRequested(testRunId, tabId, step.id, screenshot));
}

export function* updateStepScreenshot({ testRunId, tabId, step, rect }) {
    const elementScreenshot = yield call(captureScreenshot.captureElement, tabId, rect);
    yield put(RunnerActions.updateStepScreenshotRequested(testRunId, step.id, elementScreenshot));
}

export function* takeScreenshots({ testRunId, tabId, step, rect }) {
    yield call(updateStepRunScreenshot, { testRunId, tabId, step });
    logger.debug('[getElementWithScreenshots] Window screenshot taken.');

    yield call(updateStepScreenshot, { testRunId, tabId, step, rect });
    logger.debug('[getElementWithScreenshots] Element screenshot taken.');
    logger.debug('[getElementWithScreenshots] Taking screenshots finished.');
}

export function isElementNotRequired(step: Step) {
    if (step.type === 'assert') {
        return (
            step.assertionProperty === 'notExist' ||
            step.assertionProperty === 'exist' ||
            isPageAssertion(step)
        );
    }

    return step.type === 'scroll' && step.scrollInside === STEP_SCROLL_TARGET_TYPE.WINDOW;
}

export function isElementRequired(step: Step) {
    return !isElementNotRequired(step);
}
