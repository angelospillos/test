import { is } from 'ramda';

import storage from '~/services/browser/storage';

const ANONYMOUS_USER_ID = 'anonymous';

class LocalStorage {
  #userId = ANONYMOUS_USER_ID;

  setUser = (id) => {
    this.#userId = id;
  };

  reset = () => {
    this.#userId = ANONYMOUS_USER_ID;
  };

  #setItem = async (namespace, key, value) => {
    const preparedValue = is(String, value) ? value : JSON.stringify(value);
    const name = namespace ? `${namespace}:${key}` : key;
    await storage.setPersistentValue(name, preparedValue);
  };

  #getItem = async (namespace, key, transform = JSON.parse) => {
    const name = namespace ? `${namespace}:${key}` : key;
    const value = await storage.getPersistentValue(name);
    try {
      return transform(value);
    } catch (error) {
      return value;
    }
  };

  #removeItem = async (namespace, key) => {
    const name = namespace ? `${namespace}:${key}` : key;
    await storage.removePersistentValue(name);
  };

  setUserItem = (key, value) => this.#setItem(this.#userId, key, value);

  getUserItem = (key, transform) => this.#getItem(this.#userId, key, transform);

  removeUserItem = (key) => this.#removeItem(this.#userId, key);

  setItem = (key, value) => this.#setItem(undefined, key, value);

  getItem = (key, transform) => this.#getItem(undefined, key, transform);

  removeItem = (key) => this.#removeItem(undefined, key);
}

export default new LocalStorage();
