import { isNil } from 'ramda';

// Extended version of webapp helper
export const getElement = (
  selector,
  styles = {},
  forceRecreate = false,
  context = document.body,
) => {
  const currentElement = context.querySelector(selector);

  if (currentElement && !forceRecreate) {
    return currentElement;
  }

  const element = currentElement || document.createElement('div');
  context.appendChild(element);

  const selectors = selector.split('.').filter(String);
  for (let index = 0; index < selectors.length; index += 1) {
    const partialSelector = selectors[index];

    if (partialSelector.startsWith('#')) {
      element.setAttribute('id', partialSelector.replace(/^#/, ''));
    } else {
      element.setAttribute('class', partialSelector);
    }
  }

  const styleProps = Object.keys(styles);
  for (let index = 0; index < styleProps.length; index += 1) {
    const prop = styleProps[index];
    element.style[prop] = styles[prop];
  }
  return element;
};

export const keepElementOnTop = (element) => {
  const observer = new MutationObserver((mutations) => {
    const shouldBeMoved = mutations.some((mutation) => {
      const nodes = Array.prototype.slice.call(mutation.addedNodes);
      return nodes.some((node) => node !== element && node.style.zIndex === element.style.zIndex);
    });

    if (shouldBeMoved) {
      document.body.appendChild(element);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: false,
    attributes: false,
    characterData: false,
  });

  return observer;
};

export const addStyleOverride = (name) => {
  document.body.classList.add('angelos-overrides');
  document.body.classList.add(`angelos-overrides__${name}`);
};

export const removeStyleOverride = (name) => {
  document.body.classList.remove(`angelos-overrides__${name}`);
  const wasItLastOverride = (document.body.className.match(/angelos-overrides/g) || []).length === 1;
  if (wasItLastOverride) {
    document.body.classList.remove('angelos-overrides');
  }
};

export const pixelParamToNumber = (param) => {
  if (isNil(param)) {
    return 0;
  }

  const pixel = parseFloat(param.replace('px', ''), 10);
  if (Number.isNaN(pixel)) {
    return 0;
  }
  return pixel;
};

export const calculateBoundingClientRectInsideIframe = (elementRect, iframeRect) => ({
  ...elementRect,

  x: elementRect.left + iframeRect.x,
  left: elementRect.left + iframeRect.x,
  right: elementRect.right + iframeRect.x,

  y: elementRect.top + iframeRect.y,
  top: elementRect.top + iframeRect.y,
  bottom: elementRect.bottom + iframeRect.y,

  width: elementRect.width,
  height: elementRect.height,
});
