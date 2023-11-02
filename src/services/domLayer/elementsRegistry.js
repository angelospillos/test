/* eslint-disable max-classes-per-file */
import { selectRunningTestRun } from '~/modules/runner/runner.selectors';
import storeRegistry from '~/modules/storeRegistry';

import BaseService from '../baseService';

import ElementRecord from './elementRecord';

export default class ElementsRegistry extends BaseService {
  registry = new Map();

  constructor() {
    super('ElementsRegistry');
  }

  create = (key, domElement) => {
    if (this.get(key) !== domElement) {
      if (this.includes(key)) {
        this.remove(key);
      }
      this.logVerbose('Creating new smart element', key, domElement);
      const runningTestRun = selectRunningTestRun(storeRegistry.getContentState());
      const meta = { testRunId: runningTestRun?.testRunId, key };

      const record = new ElementRecord(this, domElement, meta);
      this.registry.set(key, record);
    }

    return this.get(key);
  };

  get = (key) => {
    this.logVerbose('Cached smart element returned', key);
    return this.registry.get(key)?.element || null;
  };

  includes = (key) => this.registry.has(key);

  remove = (key) => {
    if (this.includes(key)) {
      const record = this.registry.get(key);
      record.remove();
      this.registry.delete(key);
      this.logVerbose('Element removed from cache', key);
    }
  };

  reset = () => {
    [...this.registry.keys()].forEach(this.remove);
    this.logVerbose('Reset!');
  };
}
