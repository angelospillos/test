import * as Sentry from '@sentry/browser';
import { Offline } from '@sentry/integrations';
import { path, pathEq } from 'ramda';

import { REQUEST_ERROR } from '~/modules/runner/runner.exceptions';
import { isSupportedBrowser } from '~/services/browser/details';

const normalizeUrl = (url) =>
  url.replace(/(webpack_require__@)?(moz|chrome)-extension:\/\/[^/]+\//, '/');

export const transformSentryExceptionEvent = (event, hint) => {
  // eslint-disable-next-line no-param-reassign
  if (event.exception && path([0, 'stacktrace', 'frames'], event.exception.values)) {
    event.exception.values[0].stacktrace.frames.forEach((frame) => {
      // eslint-disable-next-line no-param-reassign
      frame.filename = normalizeUrl(frame.filename);
    });
  }

  if (pathEq(['params', 'errorCode'], REQUEST_ERROR, hint.originalException)) {
    // eslint-disable-next-line no-param-reassign
    event.fingerprint = [String(hint.originalException.message)];
  }
};

export const transformBreadcrumb = (breadcrumb) => {
  if (
    breadcrumb.category === 'console' &&
    breadcrumb.level !== 'error' &&
    path(['data', 'logger'])
  ) {
    return null;
  }

  if (breadcrumb.category === 'fetch') {
    if (breadcrumb.data?.url.includes('data:')) {
      // eslint-disable-next-line no-param-reassign
      breadcrumb.data.url = breadcrumb.data.url.substring(0, 20);
    }
  }

  return breadcrumb;
};

export const init = (extensionElement) => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.ENV,
    release: `${process.env.VERSION}-${process.env.ENV}`,
    beforeSend(event, hint) {
      let shouldSend = true;

      try {
        shouldSend = isSupportedBrowser();
      } catch (error) {
        console.error(error);
      }

      if (shouldSend) {
        transformSentryExceptionEvent(event, hint);
        return event;
      }

      return null;
    },
    beforeBreadcrumb: transformBreadcrumb,
    normalizeDepth: 7,
    maxValueLength: 200,
    integrations: [new Offline()],
  });

  Sentry.configureScope((scope) => {
    scope.setTag('subProject', 'extension');
    scope.setTag('extensionElement', extensionElement);
  });
};
