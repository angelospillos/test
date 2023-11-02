import { InvalidMouseInputParams } from '~/modules/runner/runner.exceptions';
import BaseService from '~/services/baseService';
import Logger from '~/services/logger';
import { sleep } from '~/utils/misc';

export const MOUSE_EVENT = 'Input.dispatchMouseEvent';

export const MOUSE_BUTTON_TYPE = {
  LEFT: 'left',
  RIGHT: 'right',
};

export const DELAY_BETWEEN_CLICKS_ON_DBLCLICK = 150;

const logger = Logger.get('Utils Misc');

export default class Mouse extends BaseService {
  #currentPosition = { x: 0, y: 0 };

  constructor(client) {
    super('Mouse');
    this.client = client;
  }

  #validateParams = (x, y) => {
    if (Number.isNaN(Number.parseInt(x, 10)) || Number.isNaN(Number.parseInt(y, 10))) {
      this.logDebug(
        'Invalid params were detected while running mouse command.',
        `x: ${x}`,
        `y: ${y}`,
      );
      throw new InvalidMouseInputParams();
    }
  };

  get position() {
    return this.#currentPosition;
  }

  move = async (tabId, x, y, button = MOUSE_BUTTON_TYPE.LEFT) => {
    this.#validateParams(x, y);
    this.logVerbose('move to', x, y);

    await this.client.sendCommand({ tabId }, MOUSE_EVENT, {
      x,
      y,
      button,
      type: 'mouseMoved',
    });

    this.#currentPosition = { x, y };
  };

  press = async (tabId, x, y, button = MOUSE_BUTTON_TYPE.LEFT, defaults = { clickCount: 1 }) => {
    this.#validateParams(x, y);
    const params = {
      ...defaults,
      x,
      y,
      button,
      type: 'mousePressed',
    };

    await this.client.sendCommand({ tabId }, MOUSE_EVENT, params);
  };

  release = async (tabId, x, y, button = MOUSE_BUTTON_TYPE.LEFT, defaults = { clickCount: 1 }) => {
    this.#validateParams(x, y);
    const params = {
      ...defaults,
      x,
      y,
      button,
      type: 'mouseReleased',
    };
    await this.client.sendCommand({ tabId }, MOUSE_EVENT, params);
  };

  click = async (tabId, x, y, button = MOUSE_BUTTON_TYPE.LEFT, defaults = { clickCount: 1 }) => {
    this.#validateParams(x, y);
    this.logVerbose('press');
    await this.press(tabId, x, y, button, defaults);
    this.logVerbose('release');
    await this.release(tabId, x, y, button, defaults);
    this.logVerbose('end click & release');
  };

  dblClick = async (tabId, x, y, button = MOUSE_BUTTON_TYPE.LEFT, defaults = { clickCount: 1 }) => {
    await this.click(tabId, x, y, button, { clickCount: 1 });
    await sleep(DELAY_BETWEEN_CLICKS_ON_DBLCLICK);
    await this.click(tabId, x, y, button, { ...defaults, clickCount: 2 });
  };

  dragAndDrop = async (tabId, startX, startY, endX, endY, smoothness = 20) => {
    logger.debug('press');
    await this.press(tabId, startX, startY, MOUSE_BUTTON_TYPE.LEFT, { clickCount: 0 });

    this.#currentPosition = {
      x: startX,
      y: startY,
    };

    if (smoothness > 0) {
      const xStep = Math.round((endX - startX) / smoothness);
      const yStep = Math.round((endY - startY) / smoothness);

      for (let index = 0; index < smoothness; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await this.move(tabId, startX + xStep * index, startY + yStep * index);
      }
    }

    await this.move(tabId, endX, endY);

    this.logVerbose('drop');
    await this.release(tabId, endX, endY);
    this.logVerbose('end drag & drop');
  };

  reset = () => {
    this.#currentPosition = { x: 0, y: 0 };
  };
}
