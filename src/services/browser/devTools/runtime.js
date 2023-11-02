import BaseService from '~/services/baseService';

export default class Runtime extends BaseService {
  constructor(client) {
    super('Runtime');
    this.client = client;
  }

  evaluate = async (tabId, code) => {
    const params = {
      awaitPromise: true,
      expression: code,
    };

    const data = await this.client.sendCommand({ tabId }, 'Runtime.evaluate', params);

    if (!data) {
      // It usually happens when a "detached debugger" error occurs.
      this.logDebug('[evaluate] Empty response', code);
      return { value: undefined };
    }

    if (data.exceptionDetails) {
      const errorMessage = data?.result?.description ?? data.exceptionDetails.text;
      this.logDebug('[evaluate] Code execution error', errorMessage, code);
      throw new Error(errorMessage);
    }

    this.logDebug('[evaluate] Result', data);
    return data.result;
  };

  execute = async (tabId, code) => {
    const result = await this.evaluate(tabId, code);

    if (result.unserializableValue) {
      this.logDebug('[execute] Unserializable value as result of code', code);
      throw new Error('Code execution result is unserializable');
    }

    // https://chromedevtools.github.io/devtools-protocol/1-3/Runtime/#type-RemoteObject
    return result.value ?? result.description;
  };

  #getAsyncFnTemplate = (code, variables) => `
    (async function(variables){
      var value = await (async function(){ ${code} })();
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        return JSON.stringify(value);
      }
      return value;
    })(${JSON.stringify(variables)})
  `;

  executeFunction = async (tabId, code, variables = {}) => {
    const codeWrappedWithFn = this.#getAsyncFnTemplate(code, variables);
    if (!tabId) {
      this.logInfo('Missing tabId. Trying to evaluate function in current context.');
      // eslint-disable-next-line no-new-func
      return Function(`"use strict"; return ( ${codeWrappedWithFn} )`)();
    }

    return this.execute(tabId, codeWrappedWithFn);
  };
}
