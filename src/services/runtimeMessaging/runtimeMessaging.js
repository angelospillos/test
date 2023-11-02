/* eslint-disable no-param-reassign */
import * as supportedCommands from './runtimeMessaging.constants';

class RuntimeMessaging {
  #runtimeApi = chrome.runtime;

  #listeners = {};

  onMessage = (eventType, callback) => {
    const listener = (message, sender, sendResponse) => {
      if (message.command === eventType) {
        sendResponse(callback ? callback(message, sender) || {} : {});
      }
    };
    this.#listeners[eventType] = listener;
    this.#runtimeApi.onMessage.addListener(listener);
  };

  removeMessageListener = (eventName) => {
    delete this.#listeners[eventName];
  };

  onAsyncMessage = (eventType, callback) => {
    // eslint-disable-next-line consistent-return
    const listener = (message, sender, sendResponse) => {
      if (message.command === eventType) {
        callback(message, sender)
          .then(sendResponse)
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('[RuntimeMessaging] Error while handling async message', error);
            const { message: errorMessage, stack, name } = error;
            sendResponse({
              isError: true,
              message: errorMessage,
              stack,
              name,
            });
          });
        return true;
      }
    };
    this.#listeners[eventType] = listener;
    this.#runtimeApi.onMessage.addListener(listener);
  };

  sendMessageToBackground = (message, callback) => {
    let result;
    // We need to check that because extension API will not return Promise if callback is defined
    if (callback) {
      result = new Promise((resolve, reject) => {
        this.#runtimeApi.sendMessage(message, (response) => {
          try {
            callback(response);

            if (this.#runtimeApi.lastError) {
              throw this.#runtimeApi.lastError;
            }
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });
    } else {
      result = this.#runtimeApi.sendMessage(message);
    }

    return result?.catch((error) => {
      // eslint-disable-next-line no-console
      console.error(
        '[RuntimeMessaging] Error while sending message to background',
        message,
        !!callback,
        error.message,
      );
      throw error;
    });
  };

  dispatchActionInBackground = (action) => {
    // eslint-disable-next-line no-unused-expressions
    this.#runtimeApi
      .sendMessage({
        command: supportedCommands.DISPATCH_IN_BACKGROUND,
        action,
      })
      ?.catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[RuntimeMessaging] Error while dispatching action in background', action);
        throw e;
      });
  };
}

export default new RuntimeMessaging();
