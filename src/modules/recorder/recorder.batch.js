import api from '~/services/api';
import BaseService from '~/services/baseService';

import { BATCH_UPDATES_INTERVAL } from './recorder.constants';
import { filterChangesList } from './recorder.helpers';

export class ChangesBatcher extends BaseService {
  #totalChanges = null;

  #totalArtifacts = null;

  #interval = null;

  hasPendingChanges = false;

  constructor() {
    super('ChangesBatcher');
  }

  get changes() {
    return this.#totalChanges;
  }

  get artifacts() {
    return this.#totalArtifacts;
  }

  clear = () => {
    this.#totalChanges = {
      deltaId: null,
      testId: null,
      added: [],
      modified: [],
      removed: [],
    };
    this.#totalArtifacts = {};
    this.logVerbose('Clear');
  };

  reset = () => {
    clearInterval(this.#interval);
    this.#totalChanges = null;
    this.#totalArtifacts = null;
    this.hasPendingChanges = false;
    this.hasPendingArtifacts = false;
    this.logVerbose('Reset');
  };

  waitUntilRequestResolve = async () =>
    new Promise((resolve) => {
      this.logVerbose('Waiting until all requests will be resolved...');
      const checkInterval = setInterval(() => {
        if (!this.hasPendingChanges && !this.hasPendingArtifacts) {
          this.logVerbose('All pending step request resolved');
          clearInterval(checkInterval);
          resolve();
        }
      }, BATCH_UPDATES_INTERVAL);
    });

  mergeChanges = (changes, artifacts) => {
    this.#totalChanges.deltaId = changes.deltaId;
    this.#totalChanges.testId = changes.testId;
    this.#totalChanges.removed = this.#totalChanges.removed.concat(changes.removed);
    this.#totalChanges.added = this.#totalChanges.added
      .concat(changes.added)
      .filter((step) => !changes.removed.includes(step.frontId));
    this.#totalChanges.modified = filterChangesList(
      this.#totalChanges.modified
        .concat(changes.modified)
        .filter((step) => !changes.removed.includes(step.frontId)),
    );

    this.#totalArtifacts = {
      ...this.#totalArtifacts,
      ...artifacts,
    };
  };

  addSyncChangeRequest = (changes, artifacts, projectId) => {
    const artifactsList = Object.values(artifacts);
    return api.recorder.updateSteps(changes, true).then(async () => {
      const createRequests = [];
      for (let i = 0; i < artifactsList.length; i += 1) {
        const { frontId, ...file } = artifactsList[i];
        createRequests.push(api.artifacts.create(projectId, file, frontId));
      }
      await Promise.all(createRequests);
    });
  };

  addChangeRequest = (changes, artifacts, projectId) => {
    if (!this.#totalChanges) {
      this.#interval = setInterval(async () => {
        if (this.#totalChanges.deltaId) {
          const artifactsList = Object.values(this.#totalArtifacts);
          this.logVerbose('Sending steps', this.#totalChanges);
          api.recorder
            .updateSteps(this.#totalChanges)
            .then(async () => {
              const createRequests = [];
              for (let i = 0; i < artifactsList.length; i += 1) {
                const { frontId, ...file } = artifactsList[i];
                createRequests.push(api.artifacts.create(projectId, file, frontId));
              }
              await Promise.all(createRequests);
              this.hasPendingChanges = false;
            })
            // eslint-disable-next-line no-console
            .catch((error) => console.error(error));
          this.hasPendingChanges = true;
          this.clear();
        }
      }, BATCH_UPDATES_INTERVAL);

      this.hasPendingChanges = true;
      this.clear();
    }
    this.mergeChanges(changes, artifacts);
  };
}

export default new ChangesBatcher();
