import { omit } from 'ramda';

import { catchUnexpectedErrors } from '~/utils/errors';

import BaseService from '../baseService';

class System extends BaseService {
  constructor() {
    super('System');
  }

  getDisplaysInfo = () =>
    new Promise((resolve, reject) => {
      const onResovle = (displays = []) => {
        resolve(
          displays.map(omit(['mirroringDestinationIds', 'mirroringSourceId', 'name', 'isUnified'])),
        );
      };
      if (!chrome.system?.display) {
        resolve('Unsupported API: system.display');
      }
      chrome.system.display.getInfo(catchUnexpectedErrors(onResovle, { onError: reject }));
    });
}

export default new System();
