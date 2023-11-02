import sequential from 'promise-sequential';

import BaseService from '~/services/baseService';
import Logger from '~/services/logger';
import { KEYS, SEQUENCE_TO_KEY_MAP } from '~/utils/keyboardLayout';
import { sleep } from '~/utils/misc';

const logger = Logger.get('DevTools Keyboard');

export const KEYBOARD_EVENT = 'Input.dispatchKeyEvent';
const SEQUENCES = Object.keys(SEQUENCE_TO_KEY_MAP);

export default class Keyboard extends BaseService {
  constructor(client) {
    super('Keyboard');
    this.client = client;
  }

  keyParams = (keyOrSequence) => {
    const keyObj =
      SEQUENCE_TO_KEY_MAP[keyOrSequence] !== undefined
        ? KEYS[SEQUENCE_TO_KEY_MAP[keyOrSequence]]
        : KEYS[keyOrSequence];

    if (!keyObj) {
      return {
        text: keyOrSequence,
        key: keyOrSequence,
        unmodifiedText: keyOrSequence,
      };
    }
    return {
      code: keyObj.code,
      key: keyObj.key,
      text: keyObj.text || (SEQUENCES.includes(keyOrSequence) ? '' : keyOrSequence),
      unmodifiedText: keyObj.text || (SEQUENCES.includes(keyOrSequence) ? '' : keyOrSequence),
      windowsVirtualKeyCode: keyObj.keyCode || 0,
    };
  };

  #getKeyEventEmitter =
    (eventType) =>
    async (tabId, char = 0) => {
      const params = this.keyParams(char);

      await this.client.sendCommand({ tabId }, KEYBOARD_EVENT, {
        ...params,
        type: eventType,
      });

      logger.verbose(eventType, tabId, char, params);
      return true;
    };

  keydown = this.#getKeyEventEmitter('keyDown');

  keyup = this.#getKeyEventEmitter('keyUp');

  typeString = (tabId, char) => async () => {
    await this.keydown(tabId, char);
    await this.keyup(tabId, char);
    await sleep(); // To force new frame in event loop for each typeString call
  };

  typeTextPart = (tabId, part) => async () => {
    const stringsToType = SEQUENCES.includes(part) ? [part] : part.split('');
    await sequential(stringsToType.map((string) => this.typeString(tabId, string)));
  };

  type = async (tabId, text) => {
    const regex = new RegExp(`(${SEQUENCES.join('|')})`);
    const parts = text.split(regex).filter((item) => item);
    await sequential(parts.map((part) => this.typeTextPart(tabId, part)));
  };
}
