import type { DownloadItem, DownloadQuery } from '~/types/extension';

import { catchUnexpectedErrors } from '~/utils/errors';

import BaseService from '../../baseService';

export class Downloads extends BaseService {
  #api = chrome.downloads;

  constructor() {
    super('Downloads');
  }

  getLatestDownloadedFiles = async (query: DownloadQuery) =>
    this.getDownloadedFiles({
      ...query,
      orderBy: ['-startTime'],
    });

  isFileOnTheList = async (url) => {
    const fileName = url.split('/').pop();
    this.logVerbose(`[${fileName}] Checking if file is on the list...`);

    const files = await this.getDownloadedFiles({ url });
    const isOnTheList = !!files[0];
    this.logVerbose(`[${fileName}] File is ${isOnTheList ? '' : '*not*'} on the list`);
    return isOnTheList;
  };

  getDownloadedFiles = async (query: DownloadQuery) =>
    new Promise<DownloadItem[]>((resolve, reject) => {
      this.#api.search(
        query,
        catchUnexpectedErrors(
          (files) => {
            resolve(files);
          },
          {
            onError: reject,
          },
        ),
      );
    });
}

export default new Downloads();
