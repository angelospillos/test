/* eslint-disable no-param-reassign */

import { RECORDED_WEBSITE } from '~/constants/events';
import { getCircularReplacer } from '~/services/logger/logger';

import BaseService from '../baseService';
import domLayer from '../domLayer';

class Overrides extends BaseService {
  constructor() {
    super('Overrides');
  }

  setupBeforePageLoadOverrides = async () => {
    this.#overrideListenersPrototypes();
  };

  setupAfterPageLoadOverrides = async () => {
    await domLayer.waitForBody();
    this.#disableBeforeUnload();
  };

  setupNativeDialogBoxesOverrides = async () => {
    const nativeDialogBoxToOverride = ['alert', 'confirm', 'prompt'];
    const getOverridenNativeDialogBoxMethod = (baseMethod) =>
      // eslint-disable-next-line func-names
      function (...args) {
        const result = baseMethod.apply(this, args);
        domLayer.postMessage({ type: RECORDED_WEBSITE.PROMPT_RESOLVED, result });
        return result;
      };

    nativeDialogBoxToOverride.forEach((dialogBoxType) => {
      window[dialogBoxType] = getOverridenNativeDialogBoxMethod(window[dialogBoxType]);
    });
  };

  setupLogsCatching = async () => {
    // eslint-disable-next-line no-underscore-dangle
    if (!window._angelosFeatureFlags?.runLogs) {
      console.debug('Logs overrides are disabled by feature flag');
      return;
    }

    const nativeLogOverride = ['log', 'warn', 'error', 'debug', 'info', 'trace', 'dir'];

    const getOverridenLogMethod = (baseMethod, loggingType) =>
      // eslint-disable-next-line func-names
      function (...args) {
        const result = baseMethod.apply(this, args);
        domLayer.postMessage({
          type: RECORDED_WEBSITE.LOG,
          args: JSON.stringify(args, getCircularReplacer()),
          loggingType,
        });
        return result;
      };

    nativeLogOverride.forEach((logType) => {
      window.console[logType] = getOverridenLogMethod(window.console[logType], logType);
    });
  };

  #disableBeforeUnload = () => {
    window.onbeforeunload = null;
    window.addEventListener('beforeunload', (e) => {
      // the absence of a returnValue property on the event will guarantee the browser unload happens
      delete e.returnValue;
    });
  };

  #overrideListenersPrototypes = () => {
    const listeners = new Map();
    const setupAddEventListener = (DomObject) => {
      const originalAddEventListener = DomObject.prototype.addEventListener;
      const originalRemoveEventListener = DomObject.prototype.removeEventListener;
      // eslint-disable-next-line func-names
      DomObject.prototype.addEventListener = function (
        type,
        listener,
        useCapture,
        ignoreangelosEvents = true,
      ) {
        if (type !== 'message') {
          return originalAddEventListener.call(this, type, listener, useCapture);
        }

        const extendedListener = (...args) => {
          const [event] = args;
          if (ignoreangelosEvents && event?.data?.isangelosEvent) {
            return null;
          }
          return listener(...args);
          // eslint-disable-next-line no-extra-bind
        };

        listeners.set(listener, extendedListener);
        return originalAddEventListener.call(this, type, extendedListener, useCapture);
      };

      // eslint-disable-next-line func-names
      DomObject.prototype.removeEventListener = function (type, listener, useCapture) {
        if (type !== 'message') {
          return originalRemoveEventListener.call(this, type, listener, useCapture);
        }

        const cachedListener = listeners.get(listener);
        listeners.delete(listener);
        return originalRemoveEventListener.call(this, type, cachedListener || listener, useCapture);
      };
    };

    setupAddEventListener(Window);
    setupAddEventListener(Document);
  };

  setupBrowserData = () => {
    // eslint-disable-next-line no-underscore-dangle
    const overridenData = window._angelosSettings;
    if (overridenData.browserLanguage) {
      Object.defineProperty(window.navigator, 'language', {
        value: `${overridenData.browserLanguage}`,
        writable: false,
      });
      Object.defineProperty(window.navigator, 'userLanguage', {
        value: `${overridenData.browserLanguage}`,
        writable: false,
      });
    }

    if (overridenData.userAgent) {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: `${overridenData.userAgent} angelos/${process.env.VERSION}`,
        writable: false,
      });
    }
  };
}

export default new Overrides();
