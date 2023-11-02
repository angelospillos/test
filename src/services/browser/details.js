/* eslint-disable no-restricted-globals */
import bowser from 'bowser';

import { catchUnexpectedErrors } from '~/utils/errors';

const getBrowserDetails = () => bowser.getParser(self.navigator.userAgent);

export const get = () =>
  new Promise((resolve, reject) => {
    const details = getBrowserDetails();
    chrome.extension.isAllowedIncognitoAccess(
      catchUnexpectedErrors(
        (isAllowedIncognitoAccess) => {
          resolve({
            isAllowedIncognitoAccess,
            browserName: details.parsedResult.browser.name,
            browserVersion: details.parsedResult.browser.version,
            osName: `${details.parsedResult.os.name} ${
              details.parsedResult.os.versionName || details.parsedResult.os.version || ''
            }`,
          });
        },
        { onError: reject },
      ),
    );
  });

export const isSupportedBrowser = () => {
  const browser = getBrowserDetails();
  return browser.satisfies({
    chrome: '>=105',
    opera: '>=90',
    edge: '>=105',
    brave: '>=105',
    chromium: '>=105',
  });
};
