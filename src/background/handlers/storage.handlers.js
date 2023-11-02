import { store } from '~/background/store';
import { RunnerActions } from '~/modules/runner/runner.redux';
import { selectLastRunningStep, selectRunningTestRun } from '~/modules/runner/runner.selectors';
import { STORAGE_DATA_TYPE } from '~/services/browser/storage/storage.constants';

const StorageHandlers = {
  onChanged: (changes) => {
    const state = store.getState();
    const testRun = selectRunningTestRun(state);
    const step = selectLastRunningStep(state);

    // eslint-disable-next-line no-restricted-syntax
    const changedKeys = Object.keys(changes);
    for (let index = 0; index < changedKeys.length; index += 1) {
      const key = changedKeys[index];
      const { newValue } = changes[key];

      if (testRun && step && key === `${step.id}.executed`) {
        store.dispatch(
          RunnerActions.updateStepRunResultRequested(testRun.testRunId, step.id, {
            executed: newValue,
          }),
        );
      }
      if (key === STORAGE_DATA_TYPE.ACTION && newValue) {
        store.dispatch(newValue);
      }
    }
  },
};

export default StorageHandlers;
