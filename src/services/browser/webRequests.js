import { isNil, prop, without } from 'ramda';

import { NETWORK_IDLE_VERIFICATION_TIME_SECONDS } from '~/constants/step';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import StoreRegistry from '~/modules/storeRegistry';
import BaseService from '~/services/baseService';
import { catchUnexpectedErrors } from '~/utils/errors';

class WebRequests extends BaseService {
  requestsData = {};

  customHeaders = {
    userAgent: '',
    acceptLanguage: '',
    nonStandardList: [],
  };

  constructor() {
    super('WebRequests');
  }

  reset = async () => {
    const tabIds = Object.keys(this.requestsData);
    for (let index = 0; index < tabIds.length; index += 1) {
      const tabId = tabIds[index];
      this.setIsNetworkIdle(tabId);
      this.stopListeningRequests(tabId);
    }
    this.requestsData = {};
    await this.removeExtraHeaders();
    this.logVerbose('Cleared successfully');
  };

  initializeExtraHeaders = async (userAgent, acceptLanguage, customHeaders = []) => {
    this.customHeaders.userAgent = userAgent || this.customHeaders.userAgent;
    this.customHeaders.acceptLanguage = acceptLanguage || this.customHeaders.acceptLanguage;
    this.customHeaders.nonStandardList = customHeaders || this.customHeaders.nonStandardList;

    const requestHeaders = [];
    this.customHeaders.nonStandardList.forEach((customHeader) => {
      requestHeaders.push({
        header: customHeader.key,
        value: customHeader.value,
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      });
    });

    if (this.customHeaders.userAgent) {
      requestHeaders.push({
        header: 'User-Agent',
        value: this.customHeaders.userAgent,
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      });
    }

    if (this.customHeaders.acceptLanguage) {
      requestHeaders.push({
        header: 'Accept-Language',
        value: `${this.customHeaders.acceptLanguage},en-US;q=0.9,en;q=0.8`,
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      });
    }

    if (requestHeaders.length) {
      const rule = {
        id: Number.parseInt(Math.random() * 10000, 10) + 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders,
        },
        priority: 2,
        condition: {
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            chrome.declarativeNetRequest.ResourceType.MEDIA,
            chrome.declarativeNetRequest.ResourceType.OBJECT,
            chrome.declarativeNetRequest.ResourceType.IMAGE,
            chrome.declarativeNetRequest.ResourceType.FONT,
            chrome.declarativeNetRequest.ResourceType.OTHER,
            chrome.declarativeNetRequest.ResourceType.PING,
            chrome.declarativeNetRequest.ResourceType.SCRIPT,
            chrome.declarativeNetRequest.ResourceType.STYLESHEET,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.WEBBUNDLE,
            chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
            chrome.declarativeNetRequest.ResourceType.WEBTRANSPORT,
            chrome.declarativeNetRequest.ResourceType.CSP_REPORT,
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          ],
        },
      };

      await chrome.declarativeNetRequest.updateSessionRules({ addRules: [rule] });
    }
  };

  removeExtraHeaders = async () => {
    const rules = (await chrome.declarativeNetRequest.getSessionRules()) ?? [];
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: rules.map(prop('id')) });

    this.customHeaders = {
      userAgent: '',
      acceptLanguage: '',
      nonStandardList: [],
    };
  };

  startListeningRequests = (tabId) => {
    if (!this.requestsData[tabId]) {
      this.logVerbose('Start listening requests on tab:', tabId);
      const filter = {
        urls: ['<all_urls>'],
        tabId,
      };
      this.requestsData[tabId] = {
        onBefore: catchUnexpectedErrors(this.onBeforeRequest),
        onCompleted: catchUnexpectedErrors(this.onFinished),
        onErrorOccurred: catchUnexpectedErrors(this.onErrorOccurred),
        onBeforeNavigate: catchUnexpectedErrors(this.onBeforeNavigate),
        onBeforeSendHeaders: catchUnexpectedErrors(this.onBeforeSendHeaders),
        onLimitResolved: null,
        activeRequests: [],
        failedRequests: [],
        downloadRequests: [],
        idleTimeout: null,
        expected: null,
        verificationTime: NETWORK_IDLE_VERIFICATION_TIME_SECONDS,
        isNetworkIdle: true,
      };
      chrome.webRequest.onBeforeRequest.addListener(this.requestsData[tabId].onBefore, filter);
      chrome.webRequest.onCompleted.addListener(this.requestsData[tabId].onCompleted, filter);
      chrome.webRequest.onErrorOccurred.addListener(
        this.requestsData[tabId].onErrorOccurred,
        filter,
      );
      chrome.webNavigation.onBeforeNavigate.addListener(this.requestsData[tabId].onBeforeNavigate);
      chrome.webRequest.onBeforeSendHeaders.addListener(
        this.requestsData[tabId].onBeforeSendHeaders,
        { urls: ['<all_urls>'] },
        ['requestHeaders', 'extraHeaders'],
      );
    }
  };

  stopListeningRequests = (tabId) => {
    if (this.requestsData[tabId]) {
      this.logVerbose('Stop listening requests on tab:', tabId);
      chrome.webRequest.onBeforeRequest.removeListener(this.requestsData[tabId].onBefore);
      chrome.webRequest.onCompleted.removeListener(this.requestsData[tabId].onCompleted);
      chrome.webRequest.onErrorOccurred.removeListener(this.requestsData[tabId].onErrorOccurred);
      chrome.webRequest.onBeforeSendHeaders.removeListener(
        this.requestsData[tabId].onBeforeSendHeaders,
      );
      chrome.webNavigation.onBeforeNavigate.removeListener(
        this.requestsData[tabId].onBeforeNavigate,
      );
      clearTimeout(this.requestsData[tabId].idleTimeout);
      delete this.requestsData[tabId];
    }
  };

  waitUntilPendingRequestsBelowLimit = (tabId, limit) =>
    new Promise((resolve) => {
      this.logVerbose('Waiting until number of pending requests will be under or equal:', limit);
      this.setRequestsLimit(tabId, limit, resolve);
    });

  setIsNetworkIdle = (tabId) => {
    if (this.requestsData[tabId]) {
      const activeRequests = this.getRequests().length;
      this.requestsData[tabId].isNetworkIdle = true;
      if (this.requestsData[tabId].onLimitResolved) {
        this.resetRequestsLimit(tabId);
      }
      StoreRegistry.dispatchInBackground(
        ExtensionActions.setIsTabNetworkIdleSucceeded(tabId, true, activeRequests),
      );
      this.logVerbose('Network is idle');
    }
  };

  setIsNetworkBusy = (tabId) => {
    this.requestsData[tabId].isNetworkIdle = false;
    StoreRegistry.dispatchInBackground(
      ExtensionActions.setIsTabNetworkIdleSucceeded(tabId, false, this.getRequests(tabId).length),
    );
    this.logVerbose('Network is busy');
  };

  areRequestsOverExpectedLimit = (tabId) => {
    if (this.requestsData[tabId]) {
      if (isNil(this.requestsData[tabId].expected)) {
        return false;
      }
      return this.getRequests(tabId).length > this.requestsData[tabId].expected;
    }
    return false;
  };

  setRequestsLimit = async (tabId, limit = '', onResolved) => {
    if (this.requestsData[tabId]) {
      const [expected, time] = `${limit}`.split('|');

      this.requestsData[tabId].onLimitResolved =
        this.requestsData[tabId].onLimitResolved || onResolved;
      this.requestsData[tabId].expected = Math.max(parseInt(expected, 10) || 0, 0);
      const parsedTime = parseInt(time, 10);
      this.requestsData[tabId].verificationTime = Math.max(
        Number.isNaN(parsedTime) ? NETWORK_IDLE_VERIFICATION_TIME_SECONDS : parsedTime,
        0,
      );
      this.logVerbose(
        'Pending requests limit was set successfuly:',
        this.requestsData[tabId].expected,
      );

      // We need to check if the network is idle while setuping
      if (this.areRequestsOverExpectedLimit(tabId)) {
        this.setIsNetworkBusy(tabId);
      } else {
        this.setIsNetworkIdle(tabId);
      }
    }
  };

  resetRequestsLimit = (tabId) => {
    if (this.requestsData[tabId]) {
      this.logVerbose('Network meets the limit!');
      if (this.requestsData[tabId].onLimitResolved) {
        this.requestsData[tabId].onLimitResolved(this.getRequests(tabId).length);
        this.requestsData[tabId].onLimitResolved = null;
      }
      this.requestsData[tabId].expected = null;
      this.requestsData[tabId].verificationTime = NETWORK_IDLE_VERIFICATION_TIME_SECONDS;
    }
  };

  isNetworkIdle = (tabId) => {
    if (this.requestsData[tabId]) {
      return this.requestsData[tabId].isNetworkIdle;
    }
    return true;
  };

  scheduleIdleState = (tabId) => {
    const time = this.requestsData[tabId].verificationTime;
    this.logVerbose('Network is going to be idle in the next', time, 'second(s)');
    this.requestsData[tabId].idleTimeout = setTimeout(() => {
      this.setIsNetworkIdle(tabId);
    }, time * 1000);
  };

  cancelScheduledIdleState = (tabId) => {
    clearTimeout(this.requestsData[tabId].idleTimeout);
    this.requestsData[tabId].idleTimeout = null;
  };

  getRequests = (tabId) => {
    if (this.requestsData[tabId]) {
      return this.requestsData[tabId].activeRequests;
    }
    return [];
  };

  addRequest = (tabId, request) => {
    if (this.requestsData[tabId]) {
      this.requestsData[tabId].activeRequests.push(request.requestId);
      this.logVerbose(
        'New pending request:',
        request.requestId,
        `(pending requests: ${this.getRequests(tabId).length})`,
      );
    }
  };

  removeRequest = (tabId, requestId) => {
    if (this.requestsData[tabId]) {
      this.requestsData[tabId].activeRequests = without(
        [requestId],
        this.requestsData[tabId].activeRequests,
      );
      this.logVerbose(
        'Pending request was finished:',
        requestId,
        `(pending requests: ${this.getRequests(tabId).length})`,
      );
    }
  };

  addFailedRequest = (tabId, details) => {
    if (this.requestsData[tabId]) {
      this.requestsData[tabId].failedRequests.push(details);
    }
  };

  getFailedRequest = (tabId, url, initiator) => {
    if (this.requestsData[tabId]) {
      return (
        this.requestsData[tabId].failedRequests.find(
          (request) =>
            request.url.startsWith(url) && (!initiator || request.initiator === initiator),
        ) || null
      );
    }
    return null;
  };

  removeFailedRequest = (tabId, url, initiator) => {
    if (this.requestsData[tabId]) {
      const failedRequest = this.requestsData[tabId].failedRequests.find(
        (request) => request.url.startsWith(url) && (!initiator || request.initiator === initiator),
      );

      if (failedRequest) {
        this.requestsData[tabId].failedRequests = without(
          [failedRequest],
          this.requestsData[tabId].failedRequests,
        );
      }
    }
  };

  onBeforeNavigate = (details) => {
    const { tabId, frameId } = details;
    if (frameId !== 0) {
      return;
    }

    const state = StoreRegistry.getBackgroundState();
    const isRecording = selectIsRecording(state);

    if (!isRecording && this.areRequestsOverExpectedLimit(tabId)) {
      this.logVerbose('Page url change or page reload was detected');
      this.cancelScheduledIdleState(tabId);
      this.setIsNetworkBusy(tabId);
    }
  };

  onBeforeRequest = (details) => {
    const { tabId } = details;
    if (this.requestsData[tabId]) {
      this.addRequest(tabId, details);

      const hadScheduledIdleState = !!this.requestsData[tabId].idleTimeout;
      this.cancelScheduledIdleState(tabId);

      if (
        this.areRequestsOverExpectedLimit(tabId) &&
        (this.isNetworkIdle(tabId) || hadScheduledIdleState)
      ) {
        this.setIsNetworkBusy(tabId);
      }
    }
  };

  onBeforeSendHeaders = (details) => {
    const { tabId } = details;
    if (this.requestsData[tabId]) {
      this.removeFailedRequest(tabId, details.url, details.initiator);
    }
  };

  onFinished = (details) => {
    const { tabId, requestId } = details;
    this.removeRequest(tabId, requestId);

    if (
      !this.isNetworkIdle(tabId) &&
      !this.areRequestsOverExpectedLimit(tabId) &&
      !this.requestsData[tabId].idleTimeout
    ) {
      this.scheduleIdleState(tabId);
    }
  };

  onErrorOccurred = (details) => {
    this.addFailedRequest(details.tabId, details);
    this.onFinished(details);
  };
}

export default new WebRequests();
