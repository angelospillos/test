import { pixelParamToNumber } from '~/utils/dom';

import BaseService from '../baseService';

export default class Elements extends BaseService {
  #createdElements = [];

  createdElementsObserver = null;

  #stylesSnapshot = new Map();

  #documentSnapshot = null;

  constructor(domLayer) {
    super('Elements');
    this.domLayer = domLayer;
    this.toggleVerboseLogs();
  }

  takeStylesSnapshot = (nodesList) => {
    const elements = [...nodesList];
    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index];
      if (element.nodeType === document.ELEMENT_NODE && !this.getBasicStylesSnapshot(element)) {
        const styles = this.domLayer.getComputedStyle(element);

        this.#stylesSnapshot.set(element, {
          isVisible: this.domLayer.isVisible(element, true),
          hasBorderBoxSizing: styles.boxSizing === 'border-box',
          borders: {
            top: pixelParamToNumber(styles.borderTopWidth),
            bottom: pixelParamToNumber(styles.borderBottomWidth),
            left: pixelParamToNumber(styles.borderLeftWidth),
            right: pixelParamToNumber(styles.borderRightWidth),
          },
        });
      }
    }

    return this.#stylesSnapshot;
  };

  getStylesSnapshot = () => this.#stylesSnapshot;

  takeDocumentSnapshot = () => {
    this.#documentSnapshot = document.cloneNode(true);
  };

  getDocumentSnapshot = () => this.#documentSnapshot;

  getCreatedElements = () => this.#createdElements;

  takeAllElementsStylesSnapshot = () =>
    this.takeStylesSnapshot(document.body.querySelectorAll('*'));

  isCreatedRecently = (element) =>
    this.#createdElements.some(
      (createdElement) => createdElement.contains(element) || createdElement.isEqualNode(element),
    );

  hasChangedVisibility = (element) => {
    const prevElementStyles = this.getBasicStylesSnapshot(element);
    return (
      !!prevElementStyles && prevElementStyles.isVisible !== this.domLayer.isVisible(element, true)
    );
  };

  getBasicStylesSnapshot = (element) => this.#stylesSnapshot.get(element);

  startWatchingElements = () => {
    this.takeAllElementsStylesSnapshot();
    this.startCollectingCreatedElements();
  };

  stopWatchingElements = () => {
    this.stopCollectingCreatedElements();
  };

  startCollectingCreatedElements = () => {
    this.stopCollectingCreatedElements();

    const config = {
      attributes: false,
      attributeOldValue: false,
      subtree: true,
      childList: true,
    };
    this.createdElementsObserver = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i += 1) {
        const newElements = [...mutations[i].addedNodes];
        this.#createdElements = this.#createdElements.concat(newElements);
      }
    });
    this.createdElementsObserver.observe(document.body, config);
    this.logVerbose('Watching new elements started');
  };

  stopCollectingCreatedElements = () => {
    if (this.createdElementsObserver) {
      this.createdElementsObserver.disconnect();
      this.createdElementsObserver = null;
      this.takeStylesSnapshot(this.#createdElements);
      this.logVerbose('Watching new elements stopped', this.#createdElements);
    }
  };

  clearCreatedElements = () => {
    this.#createdElements = [];
    this.logVerbose('New elements cleared', this.#createdElements);
  };

  clearDocumentSnapshot = () => {
    this.#documentSnapshot = null;
    this.logVerbose('Document snapshot cleared');
  };

  reset = () => {
    this.clearCreatedElements();
    this.clearDocumentSnapshot();
  };
}
