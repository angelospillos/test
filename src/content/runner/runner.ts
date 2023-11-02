import { equals, omit } from 'ramda';

import type { ElementResolverResult } from './runner.types';

import { ElementDoesNotExist, FailedWaitingConditions } from '~/modules/runner/runner.exceptions';
import { RunnerActions } from '~/modules/runner/runner.redux';
import BaseService from '~/services/baseService';
import domLayer from '~/services/domLayer';
import runtimeMessaging from '~/services/runtimeMessaging';
import { sleep } from '~/utils/misc';

import assert from './assert';
import ElementFinder from './elementFinder';
import change from './runner.change';
import './runner.debug';
import { EVENT_CHECK_REPEAT_INTERVAL_TIME } from './runner.constants';
import focus from './runner.focus';
import ListenMouseExecutor from './runner.listenEvent';
import scroll from './runner.scroll';
import select from './runner.select';
import listenTypeEvent from './runner.type';
import uploadFile from './runner.uploadFile';
import { getElement, getWindow } from './wait';

const elementDoesNotExistError = new ElementDoesNotExist();
const failedWaitingConditions = new FailedWaitingConditions();

export class Runner extends BaseService {
  #timeoutReason = null;

  elementFinder: ElementFinder;

  stopRunning: boolean;

  stepRunResult: ElementResolverResult | Record<string, unknown>;

  abortController: AbortController;

  constructor() {
    super('Runner');
    this.elementFinder = new ElementFinder({
      updateStepRunResult: this.updateStepRunResult.bind(this),
      logPotentialTimeoutReason: this.logPotentialTimeoutReason.bind(this),
    });
    this.stopRunning = false;
    this.stepRunResult = {};
    this.abortController = new AbortController();
  }

  start = async () => {
    await this.elementFinder.start();
  };

  stop = () => {
    this.stopRunning = true;
    this.#timeoutReason = null;
    this.elementFinder.stop();
    this.abortController.abort();
  };

  reset = () => {
    this.stop();
    this.elementFinder.reset();
    this.abortController = new AbortController();
  };

  logPotentialTimeoutReason = (testRunId, reason) => {
    if (!equals(this.#timeoutReason, reason)) {
      this.#timeoutReason = reason;
      runtimeMessaging.dispatchActionInBackground(
        RunnerActions.setPotentialTimeoutReasonRequested(testRunId, reason),
      );
    }
  };

  updateStepRunResult = (testRunId, tabId, stepId, result) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { element, coveringElement, ...newRunResult } = result;
    const prevResult = this.stepRunResult;
    if (prevResult && equals(omit(['element', 'coveringElement'], prevResult), newRunResult)) {
      return;
    }

    if (coveringElement && coveringElement !== prevResult.coveringElement) {
      const rect = domLayer.getClientRect(coveringElement);
      runtimeMessaging.dispatchActionInBackground(
        RunnerActions.updateCoveringElementScreenshotRequested(testRunId, tabId, stepId, rect),
      );
    }
    runtimeMessaging.dispatchActionInBackground(
      RunnerActions.updateStepRunResultRequested(testRunId, stepId, {
        warning: false,
        ...newRunResult,
        elementConditionsSuccess: newRunResult.isSuccess,
      }),
    );
    this.stepRunResult = result;
  };

  waitForRunTimeout = (): Promise<void> => {
    const { signal } = this.abortController;

    if (signal.aborted) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      signal.addEventListener('abort', () => {
        resolve();
      });
    });
  };

  waitForElement = async ({
    testRunId,
    tabId,
    step,
    timeout = EVENT_CHECK_REPEAT_INTERVAL_TIME,
    doesNotExistError = elementDoesNotExistError,
    waitingConditionsError = failedWaitingConditions,
    disabledResultUpdates = false,
    windowElementRequired = false,
  }) => {
    let result: ElementResolverResult | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.stopRunning) {
        this.logDebug('[waitForElement] Declined due to stopped test run');
        break;
      }

      this.logPotentialTimeoutReason(testRunId, waitingConditionsError);
      // eslint-disable-next-line no-await-in-loop
      result = (await (windowElementRequired
        ? getWindow(step)
        : getElement(step))) as ElementResolverResult;

      if (!disabledResultUpdates) {
        this.updateStepRunResult(testRunId, tabId, step.id, result);
      }

      if (result.isSuccess) {
        this.logPotentialTimeoutReason(testRunId, null);
        break;
      }

      if (!result.elementExists) {
        this.logPotentialTimeoutReason(testRunId, doesNotExistError);
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(timeout);
    }

    return result;
  };

  getElementValue = async (testRunId, tabId, step) => {
    const result = await this.waitForElement({ testRunId, tabId, step });
    return result ? result.element?.textContent || result.element?.value : '';
  };

  #runExecutorWithTimeout = async (Executor, ...args) => {
    const executor = new Executor(this, ...args);

    const callExecutor = async () => {
      this.logDebug('Initializing executor...');
      await executor.setup();
      this.logDebug('Executing...');
      await executor.execute();
    };

    return Promise.race([this.waitForRunTimeout(), callExecutor()]).finally(() => {
      this.logDebug('Cleaning up...');
      return executor.cleanUp();
    });
  };

  change = change.bind(this);

  select = select.bind(this);

  focus = focus.bind(this);

  assert = assert.bind(this);

  scroll = scroll.bind(this);

  uploadFile = uploadFile.bind(this);

  listenMouseEvent = this.#runExecutorWithTimeout.bind(this, ListenMouseExecutor);

  listenTypeEvent = listenTypeEvent.bind(this);
}

const runner = new Runner();
export default runner;
