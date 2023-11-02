import { compareVersions } from 'compare-versions';
import { nanoid } from 'nanoid';
import { is } from 'ramda';
import urlParse from 'url-parse';
import { v4 as uuid } from 'uuid';

import { ASSERTION_PROPERTY, EVENT_TYPE, STEP_TYPE } from '~/constants/test';

export const convertBoolToString = (boolValue) => (boolValue ? 'true' : 'false');

export function trim(s) {
  return (s || '').replace(/^\s+|\s+$/g, '');
}

export const ellipsis = (text, limit = 120) => {
  if (!text || text.length < limit + 1) {
    return text;
  }
  return `${text.substring(0, limit)}...`;
};

export function sleep(milliseconds = 0) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, milliseconds);
  });
}

export const areaOverlap = (rect1, rect2) => {
  const xOverlap = Math.max(
    0,
    Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left),
  );
  const yOverlap = Math.max(
    0,
    Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top),
  );
  return xOverlap * yOverlap;
};

export function extractTextContent(node, lengthLimit = 1000) {
  if (node === document) {
    return '';
  }

  let textContent = '';
  const nodeIterator = document.createNodeIterator(node, NodeFilter.SHOW_TEXT);

  let currentNode = true;
  while (currentNode) {
    currentNode = nodeIterator.nextNode();
    if (!currentNode) {
      break;
    }
    if (currentNode.textContent) {
      textContent += trim(currentNode.textContent);
    }

    if (textContent.length > lengthLimit) {
      return '';
    }
  }
  return textContent;
}

export const hasLabelTag = (event) => {
  // this is only required for click events
  if (![EVENT_TYPE.CLICK, EVENT_TYPE.MOUSEDOWN, EVENT_TYPE.MOUSEUP].includes(event.type)) {
    return false;
  }
  const element = event.target;
  return !!(
    element &&
    element.hasAttribute('id') &&
    document.querySelector(`label[for="${element.id}"]`)
  );
};

export const isPageAssertion = (step) =>
  [
    ASSERTION_PROPERTY.PAGE_DOES_NOT_SHOW_TEXT,
    ASSERTION_PROPERTY.PAGE_HAS_TITLE,
    ASSERTION_PROPERTY.PAGE_SHOWS_TEXT,
    ASSERTION_PROPERTY.PAGE_URL_IS,
    ASSERTION_PROPERTY.DOWNLOAD_STARTED,
  ].includes(step.assertionProperty);

export const checkIsSelectorRequired = (step) =>
  [STEP_TYPE.CLICK, STEP_TYPE.CHANGE, STEP_TYPE.CLEAR, STEP_TYPE.HOVER, STEP_TYPE.TYPE].includes(
    step.type,
  ) ||
  (step.type === STEP_TYPE.ASSERT && !isPageAssertion(step));

export const genRandomId = () => nanoid(8);

export const genFrontId = () => uuid();

export const getangelosUserAgentPartial = () =>
  // FIXME: this should be optional from the project settings panel.
  // Nonstandard user-agent can break some websites (like issue with webankieta.pl)
  ``; // angelos/${process.env.VERSION}`;

export const createCompleteStepUrl = (step) => {
  let location = step.computedUrl || step.url;

  if (location && !location.startsWith('http')) {
    location = `http://${location}`;
  }

  if (step.username && step.password) {
    const urlParser = urlParse(location);
    urlParser.set('username', step.computedUsername || step.username);
    urlParser.set('password', step.computedPassword || step.password);
    location = urlParser.toString();
  }

  return location;
};

export const isValidUrl = (url) => {
  if (!url) {
    return false;
  }
  const supportedProtocols = ['https', 'http', ''];
  // eslint-disable-next-line no-useless-escape
  const pattern = /^[-a-zA-Z0-9@:%._\+~#=]{1,256}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
  const [address, protocol = ''] = url.split('://').reverse();

  return supportedProtocols.includes(protocol) && !address.includes(':/') && pattern.test(address);
};

export const removeExtraWhiteSpace = (value = '') => {
  if (!is(String, value)) {
    return value;
  }
  return value
    .replace(/\s+/g, ' ')
    .replace(/(?:\r\n|\r|\n)/g, '')
    .trim();
};

export const isBackgroundContext = () =>
  // eslint-disable-next-line no-restricted-globals
  self.ServiceWorkerGlobalScope && self instanceof self.ServiceWorkerGlobalScope;

export const hasAtMostVersion = (currentVersion, expectedVersion) =>
  // if current version is lower than / equal to requested
  currentVersion && compareVersions(currentVersion, expectedVersion) !== 1;
