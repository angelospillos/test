import { intersection, prop, without } from 'ramda';

import BaseService from '~/services/baseService';
import Debugger from '~/services/browser/debugger';
import { sleep } from '~/utils/misc';

import { Keyboard, Mouse } from './input';
import Page from './page';
import Runtime from './runtime';

const DEFAULT_PROTOCOL_VERSION = '1.3';
export const DEVTOOLS_DISCONNECTION_TIMEOUT = 2 * 1000;

class DevToolsClient extends BaseService {
  constructor() {
    super('DevToolsClient');
    this.attachedTabs = [];
    this.keyboard = new Keyboard(this);
    this.debugger = new Debugger(this);
    this.mouse = new Mouse(this);
    this.page = new Page(this);
    this.runtime = new Runtime(this);
  }

  enableCommandsErrors = () => this.debugger.enableCommandsErrors();

  disableCommandsErrors = () => this.debugger.disableCommandsErrors();

  sendCommand = (...args) => this.debugger.sendCommand(...args);

  on = (...args) => this.debugger.on(...args);

  off = (...args) => this.debugger.off(...args);

  attach = async (tabId) => {
    const result = await this.debugger.attach({ tabId }, DEFAULT_PROTOCOL_VERSION);
    await this.page.enableListeningDialogs(tabId);
    return result;
  };

  detach = async (tabId) => {
    this.logInfo('Detaching debugger for tab:', tabId);
    await this.page.disableListeningDialogs(tabId);
    await this.debugger.detach({ tabId });
    this.logInfo('Debugger detached for tab:', tabId);
  };

  removeFromAttachedTabs = (tabId) => {
    this.attachedTabs = without([tabId], this.attachedTabs);
  };

  isConnected = (tabId) => this.attachedTabs.includes(tabId);

  connect = async (tabId) => {
    if (!this.isConnected(tabId)) {
      // We need to add tab first to ignore redundant connect attempts
      this.attachedTabs.push(tabId);
      try {
        await this.attach(tabId);
      } catch (error) {
        this.removeFromAttachedTabs(tabId);
        throw error;
      }
    }
  };

  disconnect = async (tabId) => {
    await this.detach(tabId);
    this.removeFromAttachedTabs(tabId);
  };

  getAttachedPages = async () => {
    const targets = await this.debugger.getTargets();
    const attachedPages = targets.filter(({ attached, tabId }) => attached && !!tabId);
    return attachedPages.map(prop('tabId'));
  };

  disconnectAll = (closePendingDialog = false) => {
    const runDisconnection = async () => {
      this.logVerbose('Disconnecting all tabs started');
      const attachedPages = await this.getAttachedPages();
      this.logDebug('Attached pages detected');
      const tabsToDisconnect = intersection(attachedPages, this.attachedTabs);
      this.logDebug('Tabs to disconnect detected', tabsToDisconnect);

      if (closePendingDialog) {
        this.logDebug('Closing unnecessary dialogs started');
        await Promise.all(tabsToDisconnect.map(this.page.cancelDialog));
        this.logDebug('Closing unnecessary dialogs finished');
      }

      await Promise.all(tabsToDisconnect.map(this.disconnect));
      this.logVerbose('Disconnecting finished. All tabs disconnected.');
      this.debugger.reset();
    };
    return Promise.race([sleep(DEVTOOLS_DISCONNECTION_TIMEOUT), runDisconnection()]);
  };

  reset = async () => {
    this.logVerbose('Resetting mouse settings');
    this.mouse.reset();
    this.logVerbose('Resetting page settings');
    await this.page.reset();
    this.logVerbose('Resetting debugger settings');
    this.debugger.reset();
  };
}

export default DevToolsClient;
