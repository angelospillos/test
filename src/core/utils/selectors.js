const isCustomTagWithNamespace = (element) => element.tagName.includes(':');

export const healXPathSelectorIfNeeded = (selector = '') => {
  const NAMESPACED_TAG_PATTERN = /[/(parent::)]?[aA-Z-]+:[A-Z-\]]+/g;

  if (NAMESPACED_TAG_PATTERN.test(selector)) {
    let transformedSelector = selector;
    console.debug('Converting namespaced tag names started', selector);
    selector
      .match(NAMESPACED_TAG_PATTERN)
      // sort to avoid replacing at the beginning tags that are part of other tags
      .sort((a, b) => (b.includes(a) ? 1 : -1))
      .forEach((namespacedSelector) => {
        const namespacedTag = namespacedSelector.replace(/^[/:]/, '');
        const element = { tagName: namespacedTag };
        if (isCustomTagWithNamespace(element)) {
          transformedSelector = transformedSelector.replaceAll(
            namespacedTag,
            `*[local-name()="${element.tagName.toLowerCase()}"]`,
          );
        }
      });
    console.debug('Converting namespaced tag names finished', transformedSelector);
    return transformedSelector;
  }

  return selector;
};
