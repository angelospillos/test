import debounce from 'lodash.debounce';
import { props, equals, isEmpty, isNil, eqProps, sortBy, prop } from 'ramda';

import { HTMLInputTypes, HTMLTags, WINDOW_MOVE_INTERVAL_TIME } from '~/constants/browser';
import { EVENT_TYPE, INTERACTION_POSITION_TYPE } from '~/constants/test';
import { InvalidElementSelectorError } from '~/modules/runner/runner.exceptions';
import domLayer from '~/services/domLayer';
import Logger from '~/services/logger';
import { sleep, areaOverlap } from '~/utils/misc';

import { pixelParamToNumber, addStyleOverride, removeStyleOverride } from './dom';
import { getElementsByXPath } from './selectors';

const logger = Logger.get('Utils DOM');

export const keyCodes = {
  BACKSPACE: 8,
  TAB: 9,
  ENTER: 13,
  ESC: 27,
  F12: 123,
};

const isMacOS = () => navigator.appVersion.indexOf('Mac') !== -1;

export const getElementAttributes = (element) => {
  const attributes = {};
  Array.prototype.slice.call(element.attributes).forEach((item) => {
    attributes[item.name] = item.value;
  });
  return attributes;
};

export const getElementVisibleXY = async (
  element,
  interactionPosition = INTERACTION_POSITION_TYPE.CENTER,
) => {
  if (!element) {
    throw new Error(`Given element is incorrect: ${element}`);
  }
  const rect = domLayer.getClientRect(element);
  if (isEmpty(rect)) {
    const errorMsg = 'Element outside of visible part of the window';
    logger.debug(errorMsg);
    throw new Error(errorMsg);
  }

  const { x, y } = await domLayer.interactions.getMousePosition(element, rect, interactionPosition);
  return { x, y };
};

export const getRelatedRectsToMouseoverFromPointToElement = (currentMousePosition, element) => {
  const relatedRects = [];

  const { x, y, isInitial } = currentMousePosition;
  if (isNil(x) || isNil(y)) {
    return relatedRects;
  }
  const mouseElement = document.elementFromPoint(x, y);
  if (!mouseElement || mouseElement === element) {
    return relatedRects;
  }
  const mouseElementRect = domLayer.getClientRect(mouseElement);
  const getPosition = props(['top', 'bottom', 'left', 'right']);
  for (let prevNodeRect = null, node = element; node !== document; node = node.parentNode) {
    if (node && node.nodeType === document.ELEMENT_NODE) {
      const nodeRect = domLayer.getClientRect(node);
      const hasSamePosition = equals(getPosition(nodeRect), getPosition(prevNodeRect));
      if (prevNodeRect && !hasSamePosition) {
        if (areaOverlap(mouseElementRect, nodeRect)) {
          break;
        }
        relatedRects.push(nodeRect);
      }
      prevNodeRect = nodeRect;
    } else {
      break;
    }
  }
  if (isInitial) {
    relatedRects.push(mouseElementRect);
  }
  relatedRects.reverse();
  return relatedRects;
};

const DELAY_BETWEEN_MOVING_DETECTION = 70;

export const isElementMoving = async (element) => {
  const dumpParams = (node) => {
    const styles = domLayer.getComputedStyle(node);
    return {
      rect: domLayer.getClientRect(node),
      styles,
    };
  };
  const start = dumpParams(element);
  await sleep(DELAY_BETWEEN_MOVING_DETECTION);
  const stop = dumpParams(element);

  const isMoving =
    !equals(start.rect.centroid, stop.rect.centroid) ||
    start.styles.display !== stop.styles.display ||
    start.styles.opacity !== stop.styles.opacity;
  // eslint-disable-next-line no-console
  console.table([
    ['element', element, ''],
    ['centroid', start.rect.centroid.toString(), stop.rect.centroid.toString()],
    ['display', start.styles.display, stop.styles.display],
    ['opacity', start.styles.opacity, stop.styles.opacity],
  ]);
  return isMoving;
};

export const getElementsBySelector = (selector) => {
  if (!selector) {
    return false;
  }

  try {
    if (selector.startsWith('./') || selector.startsWith('/') || selector.startsWith('(')) {
      // FIXME: smarter detection
      return getElementsByXPath(selector);
    }
    return document.querySelectorAll(selector);
  } catch (error) {
    throw new InvalidElementSelectorError(selector, error);
  }
};

export const getElementBySelector = (selector) => {
  const elements = getElementsBySelector(selector);
  if (!elements || elements.length === 0) {
    return null;
  }
  return elements[0];
};

export const getElementsListBySelectors = (step) => {
  const selectors = sortBy(prop('order'), step.selectors);
  const result = [];
  for (let i = 0; i < selectors.length; i += 1) {
    const selectorData = selectors[i];
    const selector = selectorData.computedSelector || selectorData.selector;
    const element = getElementBySelector(selector);
    if (element) {
      logger.verbose('element', element, 'selector', selector);
      result.push({
        element,
        selector: selectorData.selector,
        computedSelector: selectorData.computedSelector,
      });
    }
  }
  return result;
};

const equalScrollX = eqProps('scrollX');
const equalScrollY = eqProps('scrollY');
export const hasSamePosition = (pos1, pos2) => equalScrollX(pos1, pos2) && equalScrollY(pos1, pos2);

const getElementWithStyleResetIfNeeded = (element) => {
  if (element.scrollHeight > element.offsetHeight) {
    const containsTextOnly =
      element.childNodes.length &&
      ![...element.childNodes].some((e) => e.nodeType === document.ELEMENT_NODE);

    if (containsTextOnly) {
      /*
        Element scrollHeight can be bigger than offsetHeight even when the element is not scrollable.
        It's happening if element contains only text nodes and has set `line-height` and `font-size` attributes,
        and font family with non-standard aspect height.

        Similar case: https://www.codestudyblog.com/sf2002c/0208193444.html
      */
      const { fontSize, fontWeight } = domLayer.getComputedStyle(element);
      const clonedNode = element.cloneNode(true);
      clonedNode.style.fontSize = fontSize;
      clonedNode.style.fontWeight = fontWeight;
      clonedNode.style.fontFamily = 'sans-serif';
      clonedNode.style.lineHeight = 'normal';
      clonedNode.style.opacity = '0';
      clonedNode.style.pointerEvents = 'none';
      return clonedNode;
    }

    const containsImageOnly =
      element.childNodes.length === 1 &&
      [HTMLTags.IMAGE, HTMLTags.SVG].includes(element.childNodes[0].tagName);
    if (containsImageOnly) {
      const clonedNode = element.cloneNode(true);
      clonedNode.style.pointerEvents = 'none';
      clonedNode.classList.add('angelos-overrides__no-pseudo-elements');
      return clonedNode;
    }
  }

  return element;
};

const getElementProp = (sourceElement, propName) => {
  const element = getElementWithStyleResetIfNeeded(sourceElement);

  if (element !== sourceElement) {
    addStyleOverride('no-pseudo-elements');
    sourceElement.parentElement.appendChild(element);
    const propValue = element[propName];
    element.remove();
    removeStyleOverride('no-pseudo-elements');
    return propValue;
  }

  return sourceElement[propName];
};

export const getElementHeight = (sourceElement) => {
  if (sourceElement === window) {
    return sourceElement.innerHeight;
  }

  return getElementProp(sourceElement, 'offsetHeight');
};

export const getElementWidth = (element) =>
  element === window ? element.innerWidth : getElementProp(element, 'offsetWidth');

export const getScrollbarWidth = (element) => {
  if (element === document.body) {
    return window.innerWidth - document.documentElement.clientWidth;
  }
  const { borderLeftWidth, borderRightWidth } = domLayer.getComputedStyle(element);
  const horizontalBorderSize =
    pixelParamToNumber(borderLeftWidth) + pixelParamToNumber(borderRightWidth);

  return element.offsetWidth - element.clientWidth - horizontalBorderSize;
};

export const getScrollbarsVisibility = (element) => {
  const scrollableElement = element === window ? document.body : element;
  const { overflowX, overflowY } = domLayer.getComputedStyle(scrollableElement);
  const hasAlwaysScroll = equals('scroll');
  const conditionalScrollStates = ['auto'];
  const scrollBarSize = getScrollbarWidth(scrollableElement);

  const contentOverflowsOnY =
    (!!scrollBarSize || isMacOS()) &&
    getElementProp(scrollableElement, 'scrollHeight') - getElementHeight(element) > scrollBarSize;

  const contentOverflowsOnX =
    (!!scrollBarSize || isMacOS()) &&
    getElementProp(scrollableElement, 'scrollWidth') - getElementWidth(element) > scrollBarSize;

  return {
    y:
      hasAlwaysScroll(overflowY) ||
      (conditionalScrollStates.includes(overflowY) && contentOverflowsOnY),
    x:
      hasAlwaysScroll(overflowX) ||
      (conditionalScrollStates.includes(overflowX) && contentOverflowsOnX),
  };
};

export const isScrollInteraction = (event) => {
  const scrollbarsVisibility = getScrollbarsVisibility(event.target);

  /* If the scrollX is visible it takes place on the Y axis */
  if (scrollbarsVisibility.x && event.clientY > event.target.clientHeight) {
    return true;
  }

  /* If the scrollY is visible it takes place on the X axis */
  if (scrollbarsVisibility.y && event.clientX > event.target.clientWidth) {
    return true;
  }
  return false;
};

export const isIgnoredInputInteraction = (event, lastEvent) => {
  const currentElement = event.target;

  if (currentElement.tagName === HTMLTags.INPUT) {
    const isInteractionOnNumberInput =
      currentElement.type === HTMLInputTypes.NUMBER &&
      document.activeElement === currentElement &&
      (event.type === EVENT_TYPE.KEYDOWN ||
        (event.type === EVENT_TYPE.CLICK &&
          [EVENT_TYPE.CHANGE, EVENT_TYPE.MOUSEDOWN, EVENT_TYPE.KEYDOWN].includes(lastEvent?.type)));

    return isInteractionOnNumberInput;
  }
  return false;
};

export const getElementMaxScrollXYPosition = (element) => {
  const scrollableElement = element === window ? document.body : element;
  const scrollbars = getScrollbarsVisibility(element);

  return {
    maxScrollY: scrollbars.y
      ? Math.max(0, scrollableElement.scrollHeight - getElementHeight(element))
      : 0,
    maxScrollX: scrollbars.x
      ? Math.max(0, scrollableElement.scrollWidth - getElementWidth(element))
      : 0,
  };
};

export const isEditableTextField = (event) => {
  if (event.target.tagName === HTMLTags.TEXTAREA) {
    return true;
  }
  return (
    event.target.tagName === HTMLTags.INPUT &&
    ![HTMLInputTypes.CHECKBOX, HTMLInputTypes.RADIO].includes(event.target.type)
  );
};

export const listenOnWindowMove = (callback) => {
  let interval;
  let cachedPosition = { top: window.screenTop, left: window.screenLeft };
  const debouncedCallback = debounce(callback, WINDOW_MOVE_INTERVAL_TIME);

  const handleMouseout = (event) => {
    if (event.toElement === null && event.relatedTarget === null) {
      interval = setInterval(() => {
        if (cachedPosition.top !== window.screenTop || cachedPosition.left !== window.screenLeft) {
          cachedPosition = {
            top: window.screenTop,
            left: window.screenLeft,
          };
          debouncedCallback(cachedPosition.left, cachedPosition.top);
        }
      }, WINDOW_MOVE_INTERVAL_TIME);
    } else {
      clearInterval(interval);
    }
  };

  window.addEventListener('mouseout', handleMouseout);

  const port = chrome.runtime.connect();
  if (port) {
    port.onDisconnect.addListener(() => {
      window.removeEventListener('mouseout', handleMouseout);
      clearInterval(interval);
    });
  }
};

export const cloneElementWithoutUselessChildren = (element) => {
  const clone = element.cloneNode(true);
  const elementsToRemove = clone.querySelectorAll('style');

  for (let index = 0; index < elementsToRemove.length; index += 1) {
    const useLessElement = elementsToRemove[index];
    useLessElement.remove();
  }

  // Browser does not clone select value if attribute "selected" is not defined
  if (element.value) {
    if (element.type === HTMLInputTypes.FILE) {
      Object.defineProperty(clone, 'value', {
        value: element.value,
      });
    } else {
      clone.value = element.value;
    }
  }

  return clone;
};

export const isSecretField = (element) => element.type === HTMLInputTypes.PASSWORD;
