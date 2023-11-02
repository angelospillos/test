import BaseService from '../baseService';

class Offscreen extends BaseService {
  static OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

  constructor() {
    super('Offscreen');
  }

  creatingPromise = null;

  createOffscreen = async () => {
    this.logDebug('Creating offscreen document started.');
    if (!chrome.offscreen) {
      this.logDebug('Offscreen API is not supported on this version. Skipping.');
      return;
    }

    this.logDebug('Checking if offscreen document already exists.');
    if (await this.hasDocument()) {
      this.logDebug('Offscreen document already exists. Skipping.');
      return;
    }

    if (this.creatingPromise) {
      this.logDebug('Waiting for pending offscreen document creation.');
      await this.creatingPromise;
    } else {
      this.logDebug('Waiting for a new offscreen document.');
      try {
        this.creatingPromise = chrome.offscreen.createDocument({
          url: Offscreen.OFFSCREEN_DOCUMENT_PATH,
          reasons: [chrome.offscreen.Reason.BLOBS],
          justification: 'keep service worker running',
        });
        await this.creatingPromise;
      } catch (error) {
        this.logError('Error while creating offscreen document.', error);
      }
      this.creatingPromise = null;
    }
    this.logDebug('Document created.');
  };

  hasDocument = async () => chrome.offscreen.hasDocument();

  closeOffscreen = async () => {
    if (await this.hasDocument()) {
      await chrome.offscreen.closeDocument();
    }
  };
}

export default new Offscreen();
