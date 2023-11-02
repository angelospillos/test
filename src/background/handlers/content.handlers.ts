import type { MessageEventCallback } from './handlers.types';
import type { DownloadItem, DownloadQuery } from '~/types/extension';

import { store } from '~/background/store';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import { selectHasRunningTestRun } from '~/modules/runner/runner.selectors';
import browser from '~/services/browser';
import Logger from '~/services/logger';

const logger = Logger.get('Background Content Handlers');

interface ContentHandlers {
  onGetEventListeners: MessageEventCallback<{ selector: string }, Record<string, unknown[]>>;
  onExecute: MessageEventCallback<{ code: string }, string>;
  onGetLatestDownloadedFiles: MessageEventCallback<{ query: DownloadQuery }, DownloadItem[]>;
}

const ContentHandlers: ContentHandlers = {
  onGetEventListeners: async (msg, sender) => {
    let listeners = {};
    const state = store.getState();
    const isRunning = selectHasRunningTestRun(state);
    const isRecording = selectIsRecording(state);

    if (isRunning || isRecording) {
      try {
        listeners = await browser.devTools.page.getEventListeners(sender?.tab?.id, msg.selector);
      } catch (error) {
        logger.debug('[getEventListeners] Error catched:', error);
      }
    }
    return listeners;
  },

  onExecute: async (msg, sender) => {
    let result = '';
    const state = store.getState();
    const isRunning = selectHasRunningTestRun(state);
    const isRecording = selectIsRecording(state);

    if (isRunning || isRecording) {
      result = await browser.devTools.runtime.execute(sender?.tab?.id, msg.code);
    }
    return result;
  },

  onGetLatestDownloadedFiles: async (msg) => {
    let files: DownloadItem[] = [];
    const state = store.getState();
    const isRunning = selectHasRunningTestRun(state);

    if (isRunning) {
      files = await browser.downloads.getLatestDownloadedFiles(msg.query);
    }
    return files;
  },
};

export default ContentHandlers;
