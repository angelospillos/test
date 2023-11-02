import { v4 as uuid } from 'uuid';

import { catchUnexpectedErrors } from '~/utils/errors';

import BaseService from '../baseService';

class Alarms extends BaseService {
  constructor() {
    super('Alarms');
    this.#api = chrome;
    this.listeners = new Map();
  }

  #api;

  create = (name, details) => {
    this.#api.alarms.create(name, details);
    return name;
  };

  delete = (name) =>
    new Promise((resolve, reject) => {
      this.#api.alarms.clear(name, catchUnexpectedErrors(resolve, { onError: reject }));
    });

  clearAll = () =>
    new Promise((resolve, reject) => {
      this.#api.alarms.clearAll(catchUnexpectedErrors(resolve, { onError: reject }));
    });

  setMinuteInterval = (callback, periodInMinutes = 1, initialDelayInMinutes = 0) => {
    const name = `interval-${uuid()}`;
    const listener = async (alarm) => {
      if (alarm.name === name) {
        await callback(name);
      }
    };
    this.#api.alarms.onAlarm.addListener(listener);

    this.create(name, {
      delayInMinutes: initialDelayInMinutes,
      periodInMinutes,
    });

    this.listeners.set(name, listener);

    return name;
  };

  clearMinuteInterval = (name) => {
    const listener = this.listeners.get(name);
    this.listeners.delete(name);
    this.#api.alarms.onAlarm.removeListener(listener);
    return this.delete(name);
  };

  reset = () => {
    this.clearAll();
  };
}

export default new Alarms();
