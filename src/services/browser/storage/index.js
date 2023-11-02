import { CoreActions } from '~/modules/core';
import storeRegistry from '~/modules/storeRegistry';
import BaseService from '~/services/baseService';
import runtimeMessaging from '~/services/runtimeMessaging';
import { catchUnexpectedErrors, CHROME_ERROR } from '~/utils/errors';

import { STORAGE_DATA_TYPE, STORAGE_EVENT_TYPE } from './storage.constants';

export class Storage extends BaseService {
  #localApi;

  #storage = new Map();

  #changesListeners = [];

  constructor() {
    super('Storage');
    this.#localApi = chrome.storage.local;

    this.logVerbose('Getting cached data started.');
    this.getPersistentValue(STORAGE_DATA_TYPE.LOCAL_STORAGE).then(() => {
      this.logVerbose('Getting cached data finished.');
      this.startListeningForEvents();
    });
  }

  #setToStorage = ({ key, value }) => {
    const prevValue = this.#storage.get(key);
    this.#storage.set(key, value);
    this.#changesListeners.forEach((callback) =>
      callback({ [key]: { prevValue, newValue: value } }),
    );
    this.logVerbose(`${key} was set to ${value}`);
    this.setPersistentValue(STORAGE_DATA_TYPE.LOCAL_STORAGE, Object.fromEntries(this.#storage));
  };

  #removeFromStorage = ({ key }) => {
    const prevValue = this.#storage.get(key);
    this.#storage.delete(key);
    this.#changesListeners.forEach((callback) =>
      callback({ [key]: { prevValue, newValue: undefined } }),
    );
    this.setPersistentValue(STORAGE_DATA_TYPE.LOCAL_STORAGE, Object.fromEntries(this.#storage));
  };

  #getFromStorage = ({ key }) => this.#storage.get(key);

  #handleSetEvent = (message) => this.#setToStorage(message.data);

  #handleGetEvent = (message) => this.#getFromStorage(message.data);

  #handleRemoveEvent = (message) => this.#removeFromStorage(message.data);

  startListeningForEvents = () => {
    if (this.isBackgroundContext) {
      runtimeMessaging.onMessage(STORAGE_EVENT_TYPE.GET, this.#handleGetEvent);
      runtimeMessaging.onMessage(STORAGE_EVENT_TYPE.SET, this.#handleSetEvent);
      runtimeMessaging.onMessage(STORAGE_EVENT_TYPE.REMOVE, this.#handleRemoveEvent);
    }
  };

  onChanged = (callback) => {
    if (this.isBackgroundContext) {
      this.#changesListeners.push(callback);
    } else {
      throw new Error('Not implemented');
    }
  };

  setPersistentValue = async (key, value) => {
    try {
      await this.#localApi.set({ [key]: value });
      return value;
    } catch (error) {
      if (error?.message?.startsWith(CHROME_ERROR.QUOTA_BYTES_EXCEEDED)) {
        const currentData = await this.#localApi.get();
        this.logDebug('Current storage keys number', Object.keys(currentData).length);
        const localStorageKeys = Object.keys(currentData[STORAGE_DATA_TYPE.LOCAL_STORAGE] ?? {});
        this.logDebug('Current local storage keys number', localStorageKeys.length);

        if (localStorageKeys.length > 5) {
          this.logDebug('Last 10 records in local storage', localStorageKeys.splice(-10));
        }

        storeRegistry.dispatchInBackground(
          CoreActions.dumpExtensionState(CHROME_ERROR.QUOTA_BYTES_EXCEEDED),
        );
        this.reset();
        return null;
      }

      throw error;
    }
  };

  getPersistentValue = async (key) => {
    const result = (await this.#localApi.get(key)) ?? {};
    return result[key];
  };

  removePersistentValue = async (key) => this.#localApi.remove(key);

  set = async (key, value) =>
    new Promise((resolve, reject) => {
      if (this.isBackgroundContext) {
        this.#setToStorage({ key, value });
        resolve(value);
      } else {
        runtimeMessaging
          .sendMessageToBackground(
            { command: STORAGE_EVENT_TYPE.SET, data: { key, value } },
            catchUnexpectedErrors(() => resolve(value), {
              isBackgroundContext: false,
              onError: reject,
            }),
          )
          .catch(reject);
      }
    });

  setStepExecuted = (stepId) => this.set(`${stepId}.executed`, true);

  get = (key) =>
    new Promise((resolve, reject) => {
      if (this.isBackgroundContext) {
        this.logVerbose(`${key} was return with value: ${this.#getFromStorage({ key })}`);
        resolve(this.#getFromStorage({ key }));
      } else {
        runtimeMessaging
          .sendMessageToBackground(
            { command: STORAGE_EVENT_TYPE.GET, data: { key } },
            catchUnexpectedErrors(
              (value) => {
                this.logVerbose('Get result on content', key, value);
                resolve(value);
              },
              { isBackgroundContext: false, onError: reject },
            ),
          )
          .catch(reject);
      }
    });

  remove = (key) =>
    new Promise((resolve, reject) => {
      if (this.isBackgroundContext) {
        this.#removeFromStorage({ key });
        resolve();
      } else {
        runtimeMessaging
          .sendMessageToBackground(
            { command: STORAGE_EVENT_TYPE.REMOVE, data: { key } },
            catchUnexpectedErrors(resolve, { isBackgroundContext: false, onError: reject }),
          )
          .catch(reject);
      }
    });

  // Only for testing purposes
  _stopListeningForEvents = () => {
    if (this.isBackgroundContext) {
      runtimeMessaging.removeMessageListener(STORAGE_EVENT_TYPE.REMOVE, this.#handleRemoveEvent);
      runtimeMessaging.removeMessageListener(STORAGE_EVENT_TYPE.GET, this.#handleGetEvent);
      runtimeMessaging.removeMessageListener(STORAGE_EVENT_TYPE.SET, this.#handleSetEvent);
      this.#changesListeners = [];
    }
  };

  reset = async () => {
    this.#storage.clear();
    await this.removePersistentValue(STORAGE_DATA_TYPE.LOCAL_STORAGE);
    this.logVerbose('Reset');
  };
}

export default new Storage();
