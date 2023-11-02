import { groupBy, prop } from 'ramda';

import { dispatch } from '~/background/utils/misc';
import { RunnerActions } from '~/modules/runner/runner.redux';
import BaseService from '~/services/baseService';
import { CHROME_ERROR } from '~/utils/errors';

export const PAGE_SCREENSHOT_EVENT = 'Page.captureScreenshot';
export const PAGE_HANDLE_DIALOG_EVENT = 'Page.handleJavaScriptDialog';
export const PAGE_DIALOG_OPENING_EVENT = 'Page.javascriptDialogOpening';
export const PAGE_DIALOG_CLOSED_EVENT = 'Page.javascriptDialogClosed';
export const DOM_GET_EVENT_LISTENERS = 'DOMDebugger.getEventListeners';

export default class Page extends BaseService {
  constructor(client) {
    super('Page');
    this.client = client;
    this.dialogListeners = {};
  }

  captureTabScreenshot = async (tabId, params = { format: 'jpeg' }) => {
    const screenshot = await this.client.sendCommand({ tabId }, PAGE_SCREENSHOT_EVENT, params);
    if (!screenshot) {
      this.logVerbose('Screenshot not captured', tabId);
      return null;
    }

    this.logVerbose('Screenshot captured');

    const screenshotData = `data:image/${params.format};base64,${screenshot.data}`;
    return screenshotData;
  };

  getElementObjectId = async (tabId, selector) => {
    const result = await this.client.runtime.evaluate(
      tabId,
      `document.querySelector('${selector}')`,
    );

    if (result?.subtype !== 'node') {
      this.logVerbose('There is no element which meets provided query selector:', selector);
      return null;
    }

    return result.objectId;
  };

  getEventListeners = async (tabId, selector) => {
    const objectId = await this.getElementObjectId(tabId, selector);
    if (!objectId) {
      this.logDebug('[getEventListeners] There is no object described by selector', selector);
      return {};
    }

    const result = await this.client.sendCommand({ tabId }, DOM_GET_EVENT_LISTENERS, {
      objectId,
    });
    const eventListeners = groupBy(prop('type'), result?.listeners || []);
    this.logVerbose("Element's event listeners:", eventListeners);
    return eventListeners;
  };

  enableDialogEvents = async (tabId) => {
    await this.client.sendCommand({ tabId }, 'Page.enable');
  };

  disableDialogEvents = async (tabId) => {
    await this.client.sendCommand({ tabId }, 'Page.disable', undefined, true, [
      CHROME_ERROR.CANNOT_ATTACH_TARGET,
    ]);
  };

  #handleDialogEvent = async (tabId, accept, promptText = '') => {
    this.logDebug('[handleDialogEvent] start', tabId, promptText, chrome.runtime.lastError);

    const result = await this.client.sendCommand(
      { tabId },
      PAGE_HANDLE_DIALOG_EVENT,
      { accept, promptText },
      false,
      [CHROME_ERROR.NO_DIALOG_IS_SHOWING],
    );
    this.logDebug('[handleDialogEvent] finished');
    return result;
  };

  confirmDialog = async (tabId, promptText = '') => {
    /*
     It works for .alert, .prompt and .confirm
     but there is a problem with a "beforeunload" event.
     Confirming a beforeunload dialog seems to work fine,
     but the dialog is still visible and blocks js thread.

     See injection.js to check "beforeunload" event handling.
    */
    this.logDebug('Confirm dialog', tabId, promptText);
    return this.#handleDialogEvent(tabId, true, promptText);
  };

  cancelDialog = (tabId) => {
    this.logDebug('Cancel dialog', tabId);
    return this.#handleDialogEvent(tabId, false);
  };

  enableListeningDialogs = async (tabId) => {
    if (this.dialogListeners[tabId]) {
      this.logDebug('Removing old listeners for tab', tabId);
      await this.disableListeningDialogs(tabId);
    }
    await this.enableDialogEvents(tabId);

    const onOpen = async (params, source) => {
      if (source.tabId === tabId) {
        this.logDebug('Call openPromptRequested', tabId);
        dispatch(RunnerActions.openPromptRequested(tabId));
      }
    };
    const onClose = async (params, source) => {
      if (source.tabId === tabId) {
        this.logDebug('Call closePromptRequested', tabId);
        dispatch(RunnerActions.closePromptRequested(tabId, params.result, params.userInput));
      }
    };

    this.dialogListeners[tabId] = { onOpen, onClose };
    this.client.on(PAGE_DIALOG_OPENING_EVENT, this.dialogListeners[tabId].onOpen);
    this.client.on(PAGE_DIALOG_CLOSED_EVENT, this.dialogListeners[tabId].onClose);
  };

  #removeListenersForTab = (tabId) => {
    this.client.off(PAGE_DIALOG_OPENING_EVENT, this.dialogListeners[tabId]?.onOpen);
    this.client.off(PAGE_DIALOG_CLOSED_EVENT, this.dialogListeners[tabId]?.onClose);
    delete this.dialogListeners[tabId];
  };

  disableListeningDialogs = async (tabId) => {
    this.#removeListenersForTab(tabId);
    await this.disableDialogEvents(tabId);
  };

  reset = async () => {
    this.logDebug('Resetting dialog listeners started');
    await Promise.all(Object.keys(this.dialogListeners).map(this.#removeListenersForTab));
    this.logDebug('Resetting dialog listeners finished');
  };
}
