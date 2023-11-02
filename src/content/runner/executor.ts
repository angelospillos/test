import type { Runner } from './runner';
import type { ExecutorContext, ExecutorParams } from './runner.types';

import BaseService from '~/services/baseService';

interface BaseExecutorMethods {
  setup: () => void;
  execute: () => void;
  cleanUp: () => void;
}

export default class BaseExecutor extends BaseService implements BaseExecutorMethods {
  runner: Runner;

  context: ExecutorContext;

  params: ExecutorParams = {};

  setup;

  execute;

  cleanUp;

  constructor(
    executorName: string,
    runner: Runner,
    { testRunId, step, tabId, eventName, eventParams }: ExecutorContext & ExecutorParams,
  ) {
    super(executorName);
    this.runner = runner;
    this.context = { testRunId, step, tabId };
    this.params = { eventName, eventParams };
  }
}
