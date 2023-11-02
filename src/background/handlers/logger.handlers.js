import { store } from '~/background/store';
import { RunnerActions } from '~/modules/runner/runner.redux';
import { selectRunningTestRun } from '~/modules/runner/runner.selectors';

const LoggerHandlers = {
  onBatch: () => {
    const state = store.getState();
    const testRun = selectRunningTestRun(state);
    if (testRun?.testRunId) {
      store.dispatch(RunnerActions.uploadTestRunLogsRequested(testRun.testRunId));
    }
  },
};

export default LoggerHandlers;
