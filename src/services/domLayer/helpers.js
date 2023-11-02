import { identity } from 'ramda';

import { HTMLTags } from '~/constants/browser';

export const getTextNodeRect = (node) => {
  const range = document.createRange();
  range.selectNode(node);
  const rect = range.getBoundingClientRect();
  range.detach();
  return rect;
};

export const getVisibleContentRects = async (element, filter = identity) => {
  const nodes = [...element.childNodes];
  const results = await Promise.all(nodes.map(filter));
  const childNodes = nodes.filter((node, index) => results[index]);

  return childNodes.reduce((rects, node) => {
    const rect =
      node.nodeType === document.TEXT_NODE ? getTextNodeRect(node) : node.getBoundingClientRect();

    if (rect && rect.width && rect.height) {
      rects.push(rect);
    }

    return rects;
  }, []);
};

export const getFrameElement = (event) => {
  const frames = [
    ...(document.getElementsByTagName(HTMLTags.IFRAME) ?? []),
    ...(document.getElementsByTagName(HTMLTags.FRAME) ?? []),
  ];

  return frames.find((frame) => frame.contentWindow === event.source);
};

export function isElementVisible(element, ignoreViewportCheck) {
  const domLayer = this;

  if (!element) {
    domLayer.logDebug(
      '[domLayer] isElementVisible was invoked on element which does not exist',
      element,
    );
    return false;
  }

  if (element === document) {
    domLayer.logDebug('[domLayer] isElementVisible was invoked on document');
    return true;
  }

  let node = element;
  let rect;

  if (!ignoreViewportCheck) {
    rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }
    if (rect.left > window.innerWidth || rect.top > window.innerHeight) {
      return false;
    }
  }

  // travers across all parents
  while (node) {
    const styles = window.getComputedStyle(node);
    if (styles.display === 'none') {
      return false;
    }
    // https://trello.com/c/endTGHdh/450-isvisible-opacity-1-problem
    if (styles.opacity === '0') {
      return false;
    }
    if (['none', 'hidden'].includes(styles.visibility)) {
      return false;
    }
    node = node.parentElement;
  }
  return ignoreViewportCheck ? true : rect.x + rect.width > 0;
}
