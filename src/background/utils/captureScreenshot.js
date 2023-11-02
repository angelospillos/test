import * as Sentry from '@sentry/browser';

import BaseService from '~/services/baseService';
import browser from '~/services/browser';
import { isExcludedUrl } from '~/services/browser/browser.helpers';
import { CHROME_ERROR, hasExpectedChromeErrorOccurred } from '~/utils/errors';

export class CaptureScreenshot extends BaseService {
  format = 'webp';

  timeoutMs = 2000;

  legacyFormat = 'jpeg';

  quality = 80;

  tabScreenshotPromise = null;

  constructor() {
    super('CaptureScreenshot');
    this.lastScreenshot = null;
  }

  clearScreenshotsHistory = () => {
    this.lastScreenshot = null;
  };

  captureTab = async (tabId, fromDevTools = false) => {
    this.tabScreenshotPromise = new Promise((resolve, reject) => {
      if (!tabId) {
        resolve(null);
        this.tabScreenshotPromise = null;
        return;
      }

      chrome.tabs.get(tabId, (tabObject) => {
        if (tabObject) {
          if (isExcludedUrl(tabObject.url)) {
            this.logVerbose('Trying to capture screenshot for tab with wrong url', tabObject);
            resolve(null);
            this.tabScreenshotPromise = null;
            return;
          }

          const params = {
            format: fromDevTools ? this.format : this.legacyFormat,
            quality: this.quality,
          };

          const screenshotTimeout = setTimeout(() => {
            this.logVerbose('Screenshot timeout!', tabObject, params, fromDevTools);
            resolve(null);
            this.tabScreenshotPromise = null;
          }, this.timeoutMs);

          if (fromDevTools) {
            this.logVerbose('Tab capturing started using devtools protocol');
            // Screenshots via captureVisibleTab can be shifted in time so that's why we are
            // using devtools protocol to make them without shifts in running session (a bit
            // surprising).
            browser.devTools.page.captureTabScreenshot(tabId, params).then((result) => {
              clearTimeout(screenshotTimeout);
              const lastRuntimeError = chrome.runtime.lastError;
              if (hasExpectedChromeErrorOccurred([CHROME_ERROR.NO_TAB_WITH_ID], lastRuntimeError)) {
                reject(lastRuntimeError.message);
              } else {
                if (!result) {
                  this.logVerbose('Empty screenshot in dataUrl.');
                }
                this.lastScreenshot = result || this.lastScreenshot;
                this.logVerbose('Tab capturing finished');
                resolve(result);
              }
              this.tabScreenshotPromise = null;
            });
          } else {
            // We are taking screenshots in two different ways because while recording session devtools are not attached
            // so we are not able to take screenshot using devtools API.
            chrome.tabs.captureVisibleTab(tabObject.windowId, params, (dataUrl) => {
              clearTimeout(screenshotTimeout);
              const lastRuntimeError = chrome.runtime.lastError;
              if (
                hasExpectedChromeErrorOccurred([CHROME_ERROR.NO_WINDOW_WITH_ID], lastRuntimeError)
              ) {
                reject(lastRuntimeError.message);
              } else {
                if (!dataUrl) {
                  this.logVerbose('Empty screenshot in dataUrl.');
                }
                this.lastScreenshot = dataUrl || this.lastScreenshot;
                this.logVerbose('Tab capturing finished');
                resolve(this.lastScreenshot);
              }
              this.tabScreenshotPromise = null;
            });
          }
        } else {
          this.logVerbose('Tab object does not exist');
          resolve(null);
          this.tabScreenshotPromise = null;
        }
      });
    });

    return this.tabScreenshotPromise;
  };

  #toDataURL = async (data) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.addEventListener('error', () => reject(reader.error));
      reader.addEventListener('abort', () => reject(new Error('Read aborted')));
      reader.readAsDataURL(data);
    });

  getCanvasSize = ({ width, height, left, top, windowInnerWidth, windowInnerHeight }) => {
    const size = { width, height };

    if (top + height > windowInnerHeight) {
      if (top > 0) {
        size.height = windowInnerHeight - top;
      } else {
        size.height = windowInnerHeight;
      }
    }

    if (left + width > windowInnerWidth) {
      if (left > 0) {
        size.width = windowInnerWidth - left;
      } else {
        size.width = windowInnerWidth;
      }
    }

    if (
      size.width < 0 ||
      size.height < 0 ||
      Number.isNaN(size.width) ||
      Number.isNaN(size.height)
    ) {
      this.logDebug('Invalid canvas size detected.', size.width, size.height);
      this.logDebug(
        'Initial data used to process size:',
        width,
        height,
        left,
        top,
        windowInnerWidth,
        windowInnerHeight,
      );
      size.width = Math.max(0, size.width || 0);
      size.height = Math.max(0, size.height || 0);
      this.logDebug('Canvas size normalized.', size.width, size.height);
      Sentry.captureMessage('Invalid offscree canvas size detected', 'warning');
    }

    return size;
  };

  captureElement = async (tabId, rect) => {
    const { width, height, left, top, windowDevicePixelRatio } = rect;
    if (!this.lastScreenshot) {
      this.logVerbose('Last screenshot is EMPTY!');

      if (!this.tabScreenshotPromise) {
        Sentry.captureMessage('Extension was forced to capture extra tab screenshot.', 'warning');
        await this.captureTab(tabId);
      } else {
        await this.tabScreenshotPromise;
      }
    }

    const size = this.getCanvasSize(rect);
    let blobScreenshot;
    try {
      blobScreenshot = await fetch(this.lastScreenshot).then((r) => r.blob());
    } catch (error) {
      this.logVerbose('Last screenshot', !!this.lastScreenshot, !!this.tabScreenshotPromise);
      this.logError('Error while capturing element screenshot');
      return 'data:image/jpeg;base64,';
    }

    const img = await createImageBitmap(blobScreenshot, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });

    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    context.drawImage(
      img,
      left * windowDevicePixelRatio,
      Math.max(top * windowDevicePixelRatio, 0),
      width * windowDevicePixelRatio,
      height * windowDevicePixelRatio,
      0,
      0,
      width,
      height,
    );
    try {
      const blob = await canvas.convertToBlob({
        type: `image/${this.format}`,
        quality: this.quality / 100,
      });
      const elementScreenshot = await this.#toDataURL(blob);
      this.logVerbose('screen', this.lastScreenshot, '\n', 'element', elementScreenshot);
      return elementScreenshot;
    } catch (error) {
      this.logVerbose('screen', this.lastScreenshot, '\n', 'element', '<empty>');
      return 'data:image/jpeg;base64,';
    }
  };
}

export default new CaptureScreenshot();
