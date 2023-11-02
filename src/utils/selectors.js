import { healXPathSelectorIfNeeded } from '~/core/utils/selectors';
import { prop, uniqBy } from 'ramda';

import { HTMLTags } from '~/constants/browser';
import { trim } from '~/utils/misc';

export const ELEMENT_ID = 'elementId';
export const ELEMENT_NAME = 'elementName';
export const ELEMENT_HREF = 'elementHref';
export const ELEMENT_PLACEHOLDER = 'elementPlaceholder';
export const ELEMENT_CLASS_NAME = 'elementClassName';
export const ELEMENT_TEXT = 'elementText';
export const ELEMENT_FULL_XPATH = 'elementFullXPath';
export const ELEMENT_CUSTOM_ATTRIBUTES = 'elementCustomAttributes';
export const XPATH = 'XPath';

const USED_XPATH_FUNCTIONS = ['concat'];

const isSVGElement = (element) =>
  element.tagName.toUpperCase() === HTMLTags.SVG || element.ownerSVGElement;

const getXPathTagName = (element) => {
  if (isSVGElement(element)) {
    return `*[name()="${element.tagName}"]`;
  }

  return element.tagName;
};

const getElementIdx = (elt) => {
  let count = 1;
  let sib;
  for (sib = elt.previousSibling; sib; sib = sib.previousSibling) {
    if (sib.nodeType === 1 && sib.tagName === elt.tagName) {
      count += 1;
    }
  }
  return count;
};

export const getElementsByXPath = (xpath, parent = document) => {
  const results = [];
  let element;

  const selector = healXPathSelectorIfNeeded(xpath);

  const query = document.evaluate(
    selector,
    parent,
    null,
    window.XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null,
  );

  for (let i = 0, length = query.snapshotLength; i < length; i += 1) {
    element = query.snapshotItem(i);
    results.push(element);
  }
  return results;
};

const addIndexToXPathQuery = (element, query) => {
  const elements = getElementsByXPath(query);
  let i;

  for (i = 0; i < elements.length; i += 1) {
    if (element === elements[i]) {
      if (i === 0) {
        return query;
      }

      // nodes counter started from 1 in XPath locator
      i += 1;
      return `(${query})[${i}]`;
    }
  }
  return false;
};

export const cleanStringForXPath = (str) => {
  let parts = str.match(/[^'"]+|['"]/g);

  parts = parts.map((part) => {
    if (part === "'") {
      return '"\'"'; // output "'"
    }
    if (part === '"') {
      return "'\"'"; // output '"'
    }
    return `'${part}'`;
  });
  if (parts.length > 1) {
    return `concat(${parts.join(',')})`;
  }
  return `"${str}"`;
};

export const getElementXPathByText = (element, maxDepth = 3) => {
  let i;
  let text;
  let xpath;
  let xpathWithIndex;
  let result;
  let child;

  if (!element || !element.innerHTML || element.innerHTML.length > 10000) {
    return false;
  }
  if (maxDepth <= 0) {
    return false;
  }

  const MINIMAL_TEXT_LENGTH = 2;

  for (i = 0; i < element.childNodes.length; i += 1) {
    child = element.childNodes[i];
    text = null;
    if (child.nodeType === document.TEXT_NODE) {
      text = trim(child.nodeValue);
    }
    if (text && text.length >= MINIMAL_TEXT_LENGTH) {
      text = cleanStringForXPath(text);
      xpath = `//${child.parentElement.tagName}[normalize-space(text())=${text}]`;
      xpathWithIndex = addIndexToXPathQuery(element, xpath);

      return xpathWithIndex;
    }
  }

  for (i = 0; i < element.childNodes.length; i += 1) {
    child = element.childNodes[i];
    text = null;
    if (child.nodeType === document.ELEMENT_NODE) {
      result = getElementXPathByText(child, maxDepth - 1);
      if (result) {
        return [result, '..'].join('/');
      }
    }
  }
  return false;
};

export const createXPathByAttribute = (element, attrName, attrValue) => {
  let value = `${attrValue ?? ''}`;
  const isFuncValue = USED_XPATH_FUNCTIONS.some((func) => value.startsWith(`${func}(`));

  if (!isFuncValue) {
    value = value.includes('"') ? `'${value}'` : `"${value}"`;
  }
  const tagName = getXPathTagName(element);

  if (isSVGElement(element)) {
    const transformedTagNameWithAttr = tagName.replace(']', ` and @${attrName}=${value}]`);
    return `//${transformedTagNameWithAttr}`;
  }

  return `//${tagName}[@${attrName}=${value}]`;
};

export const getElementXPathByAttribute = (element, attributeObj) => {
  let tmpQuery;
  let placeholder;
  let selector;

  if (element && typeof element === 'object' && element.hasAttribute) {
    if (attributeObj.name === ELEMENT_HREF && element.hasAttribute('href')) {
      const href = element.getAttribute('href');
      if (href) {
        tmpQuery = createXPathByAttribute(element, 'href', element.href);
        tmpQuery = addIndexToXPathQuery(element, tmpQuery);
        if (tmpQuery) {
          selector = tmpQuery;
        }
      }
    }
    if (attributeObj.name === ELEMENT_ID && element.hasAttribute('id')) {
      const elementId = element.getAttribute('id').toLowerCase();
      // exclude random IDs (select2 and ember generate them)
      if (elementId.indexOf('select2') === -1 && elementId.indexOf('ember') === -1) {
        tmpQuery = createXPathByAttribute(element, 'id', element.id);
        tmpQuery = addIndexToXPathQuery(element, tmpQuery);
        if (tmpQuery) {
          selector = tmpQuery;
        }
      }
    }
    if (attributeObj.name === ELEMENT_NAME && element.hasAttribute('name')) {
      const elementName = element.getAttribute('name');
      tmpQuery = createXPathByAttribute(element, 'name', elementName);
      tmpQuery = addIndexToXPathQuery(element, tmpQuery);
      if (tmpQuery) {
        selector = tmpQuery;
      }
    }
    if (attributeObj.name === ELEMENT_PLACEHOLDER && element.hasAttribute('placeholder')) {
      placeholder = element.getAttribute('placeholder');
      // almost always will be INPUT so we can add tagName to be sure
      if (placeholder) {
        placeholder = cleanStringForXPath(placeholder);
        tmpQuery = createXPathByAttribute(element, 'placeholder', placeholder);
        tmpQuery = addIndexToXPathQuery(element, tmpQuery);
        if (tmpQuery) {
          selector = tmpQuery;
        }
      }
    }
    if (attributeObj.name === ELEMENT_CLASS_NAME && element.hasAttribute('class')) {
      const classNames = element.getAttribute('class').split(' ');
      for (let i = 0; i < classNames.length; i += 1) {
        tmpQuery = createXPathByAttribute(element, 'class', classNames[i]);
        if (tmpQuery === addIndexToXPathQuery(element, tmpQuery)) {
          selector = tmpQuery;
          break;
        }
      }
    }
    if (attributeObj.name === ELEMENT_CUSTOM_ATTRIBUTES) {
      const attributes = (attributeObj.extraValue || '').split(',');
      for (let attrNo = 0; attrNo < attributes.length; attrNo += 1) {
        const attrName = attributes[attrNo];
        if (attrName && element.hasAttribute(attrName)) {
          const attrValue = element.getAttribute(attrName);
          tmpQuery = createXPathByAttribute(element, attrName, attrValue);
          if (tmpQuery) {
            const tmpQueryWithIndex = addIndexToXPathQuery(element, tmpQuery);
            selector =
              tmpQueryWithIndex && tmpQueryWithIndex !== tmpQuery ? tmpQueryWithIndex : tmpQuery;
          }
        }
      }
    }
  }
  return selector;
};

export const getElementXPathByParentAttribute = (element, attributeObj) => {
  const stack = [];
  let tmpSelector;
  let node = element;
  let nodeSelector;

  for (; node && node.nodeType === document.ELEMENT_NODE; node = node.parentNode) {
    tmpSelector = getElementXPathByAttribute(node, attributeObj);
    if (tmpSelector) {
      nodeSelector = tmpSelector;
      break;
    }
    const idx = getElementIdx(node);
    let tagName = getXPathTagName(node);
    if (idx > 1) {
      tagName += `[${idx}]`;
    }

    stack.push(tagName);
  }
  const stackCopy = [...stack];
  if (nodeSelector) {
    stackCopy.push(nodeSelector);
  }
  stackCopy.reverse();
  if (stackCopy.length && stackCopy[0].indexOf('/') === -1) {
    stackCopy.splice(0, 0, '');
  }
  if (attributeObj && !nodeSelector) {
    return null;
  }
  return stackCopy.length ? stackCopy.join('/') : null;
};

export const getElementFullXPath = (element) => {
  const stack = [];
  let node = element;

  for (; node && node.nodeType === document.ELEMENT_NODE; node = node.parentNode) {
    const idx = getElementIdx(node);
    let tagName = getXPathTagName(node);
    if (idx > 1) {
      tagName += `[${idx}]`;
    }

    stack.push(tagName);
  }
  stack.reverse();
  stack.splice(0, 0, '');
  return stack.join('/');
};

export const excludeSVGFromXPath = (element) => {
  const node = element;
  // SVG tags doesn't work with xpath (they have own namespace)
  if (element?.tagName) {
    let pointer = element;
    for (; pointer && pointer.nodeType === document.ELEMENT_NODE; pointer = pointer.parentNode) {
      if (pointer.tagName.toUpperCase() === HTMLTags.SVG) {
        return pointer;
      }
    }
  }
  return node;
};

export const getElementSelectors = (element, projectSettings) => {
  const selectors = [];
  const node = element;

  const byAttributes = [
    ELEMENT_ID,
    ELEMENT_NAME,
    ELEMENT_HREF,
    ELEMENT_PLACEHOLDER,
    ELEMENT_CLASS_NAME,
    ELEMENT_CUSTOM_ATTRIBUTES,
  ];

  const activeSelectors = projectSettings.selectorMethods.filter(prop('isActive'));

  for (let index = 0; index < activeSelectors.length; index += 1) {
    const selectorMethod = activeSelectors[index];
    const baseSelector = { type: XPATH, method: selectorMethod.name };
    try {
      if (byAttributes.includes(selectorMethod.name)) {
        const selector = getElementXPathByAttribute(node, selectorMethod);

        if (selector) {
          selectors.push({ ...baseSelector, selector });
        }

        const parentSelector = getElementXPathByParentAttribute(node, selectorMethod);
        if (parentSelector) {
          selectors.push({ ...baseSelector, selector: parentSelector });
        }
      }
      if (selectorMethod.name === ELEMENT_TEXT) {
        const selector = getElementXPathByText(node);
        if (selector) {
          selectors.push({ ...baseSelector, selector });
        }
      }
      if (selectorMethod.name === ELEMENT_FULL_XPATH) {
        const selector = getElementFullXPath(node);
        if (selector) {
          selectors.push({ ...baseSelector, selector });
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug(error);
      // eslint-disable-next-line no-continue
      continue;
    }
  }

  return uniqBy(prop('selector'), selectors);
};
