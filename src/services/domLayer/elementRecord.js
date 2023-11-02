import { ContentActions } from '~/modules/content/content.redux';
import storeRegistry from '~/modules/storeRegistry';

import BaseService from '../baseService';

export default class ElementRecord extends BaseService {
  constructor(registry, element, meta) {
    super('ElementRecord');
    this.registry = registry;
    this.element = element;
    this.meta = meta;

    this.initObserver();
  }

  initObserver = () => {
    const config = {
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      childList: true,
    };

    this.observer = new MutationObserver(this.handleMutations);
    this.observer.observe(document.body, config);
    this.logVerbose('Initialize element mutations observer');
  };

  handleMutations = (mutations) => {
    for (let i = 0; i < mutations.length; i += 1) {
      const mutation = mutations[i];

      if (mutation.removedNodes.length > 0) {
        this.logVerbose('Registered removals', mutation.removedNodes);
        const removed = [...mutation.removedNodes].find((node) => node.contains(this.element));

        if (removed) {
          const addedAfterRemoval = [...mutation.addedNodes].find((node) =>
            removed.isEqualNode(node),
          );
          if (!addedAfterRemoval) {
            this.#onRemove();
          }
        }
      }
    }
  };

  #onRemove = () => {
    this.logVerbose('Element removed during run!', this.meta.key);
    this.registry.remove(this.meta.key);
    storeRegistry.dispatchInContent(ContentActions.elementRemoved(this.meta.testRunId));
  };

  remove = () => {
    this.observer.disconnect();
    this.element = null;
  };
}
