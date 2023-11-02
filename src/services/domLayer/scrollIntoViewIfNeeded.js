import debounce from 'lodash.debounce';

import { INTERACTION_POSITION_TYPE } from '~/constants/test';

import {
  DEFAULT_SCROLL_OPTIONS,
  SCROLL_END_DEBOUNCE_TIME,
  SCROLL_INTO_VIEW_DEFAULT_TYPE,
  SCROLL_INTO_VIEW_MOVEMENT,
  SCROLL_INTO_VIEW_VARIANT,
} from './domLayer.constants';

const runScroll = (element, options = {}) => {
  /*
    In case when the element in iframe is fully visible
    but iframe part with the element is not visible in main frame (is below the fold),
    is covered will be set to true because interaction point outside the window and
    "scrollIntoView" will not be executed in iframe window context, so
    the action will not be propagated to main window aswell.
  */
  const elementToScroll = options.useTopParentInIframe ? element.closest('html, body') : element;
  elementToScroll.scrollIntoView({
    behavior: options.behavior ?? 'smooth',
    ...SCROLL_INTO_VIEW_VARIANT[options.type ?? SCROLL_INTO_VIEW_DEFAULT_TYPE],
  });
};

export default async function scrollIntoViewIfNeeded(element, options = {}) {
  const domLayer = this;
  domLayer.logVerbose('Checking if scroll is needed', element);

  const { isCovered, isInViewport, isInteractionPointInViewport, coveringElement } =
    await domLayer.getElementData(
      element,
      options.interactionPosition,
      options.customInteractionCoords,
      {
        isCovered: true,
        isInViewport: true,
      },
    );
  const isVisible = options.ignoreVisibility || domLayer.isVisible(element, true);

  if (isInteractionPointInViewport && isVisible && !isCovered) {
    domLayer.logVerbose('There is no need to scroll the element into view.');
    return Promise.resolve(true);
  }

  if (isInteractionPointInViewport && !isVisible) {
    /*
      There is a possible scenario that the parent of the element has `display` attribute set to `none` (is not rendered).
      In that case, the element rect always points to the top left corner (0, 0).
      While recording the element and its parents were visible so it will probably appear after a scroll event.
      The simplest solution is to find the first rendered parent and scroll it into view.
    */
    let hasNonRenderedParent = false;
    let firstRenderedParent;
    const parents = domLayer.getParents(element);
    for (let index = 0; index < parents.length; index += 1) {
      const parent = parents[index];

      if (domLayer.getComputedStyle(parent).display === 'none') {
        hasNonRenderedParent = true;
      } else if (hasNonRenderedParent) {
        firstRenderedParent = parent;
        break;
      }
    }

    if (hasNonRenderedParent) {
      domLayer.logVerbose('Element is inside invisible parent.');

      if (firstRenderedParent) {
        domLayer.logVerbose('Scrolling to the nearest visible ancestor...', firstRenderedParent);

        return domLayer.scrollIntoViewIfNeeded(firstRenderedParent, {
          interactionPosition: INTERACTION_POSITION_TYPE.CENTER,
        });
      }
      return Promise.resolve(false);
    }
  }

  // eslint-disable-next-line no-param-reassign
  options.useTopParentInIframe =
    isCovered && !isInteractionPointInViewport && domLayer.isInIframe();

  domLayer.logVerbose(
    'Scroll element into view initialized.',
    `\n - in viewport: ${isInViewport},`,
    `\n - isInteractionPointInViewport: ${isInteractionPointInViewport},`,
    `\n - is visible: ${isVisible},`,
    `\n - is covered: ${isCovered},`,
    coveringElement,
    `\n - use top parent in iframe: ${options.useTopParentInIframe}`,
  );

  return new Promise((resolve, reject) => {
    let isStarted = false;
    let scrollStartTimeout;

    try {
      const updateMousePositionWhileScroll =
        domLayer.interactions.getMousePositionUpdateHandler(window);
      const retryWithDifferentConfig = () => {
        const nextScrollType =
          SCROLL_INTO_VIEW_MOVEMENT[options.type ?? SCROLL_INTO_VIEW_DEFAULT_TYPE];

        if (!nextScrollType) {
          domLayer.logVerbose('Scroll element into view failed. Movement limit exceeded.');
          resolve(false);
          return;
        }

        domLayer.logVerbose('Trying to scroll with different config', nextScrollType);
        domLayer
          .scrollIntoViewIfNeeded(element, {
            ...options,
            type: nextScrollType,
          })
          .then(resolve)
          .catch(reject);
      };

      const handleScrollStart = () => {
        clearTimeout(scrollStartTimeout);
        isStarted = true;
      };

      const handleScrollEnd = debounce(async (parentCallback) => {
        window.removeEventListener('scroll', parentCallback, DEFAULT_SCROLL_OPTIONS);
        domLayer.frames.removeEventListener('scroll', parentCallback, DEFAULT_SCROLL_OPTIONS);

        const isCoveredAfterScroll = await domLayer.isCovered(
          element,
          options.interactionPosition,
          options.customInteractionCoords,
        );
        if (isCoveredAfterScroll) {
          domLayer.logVerbose('Scroll element into view failed. Element is still covered.');
          retryWithDifferentConfig();
        } else {
          domLayer.logVerbose('Scroll element into view finished.');
          resolve(true);
        }
      }, 250);

      const handleScroll = async () => {
        if (!isStarted) {
          handleScrollStart();
        }

        updateMousePositionWhileScroll();
        await handleScrollEnd(handleScroll);
      };

      window.addEventListener('scroll', handleScroll, DEFAULT_SCROLL_OPTIONS);
      domLayer.frames.addEventListener('scroll', handleScroll, DEFAULT_SCROLL_OPTIONS);

      runScroll(element, options);
      /*
        This timeout resolves two cases:
          - scroll was interrupted by some page changes (eg. delayed re-render)
          - scroll was not invoked because initial position meets destination position if scroll ended
            eg. A scroll to the middle of the screen won't be called if an element is middle of the screen.
      */
      scrollStartTimeout = setTimeout(() => {
        if (!isStarted) {
          window.removeEventListener('scroll', handleScroll, DEFAULT_SCROLL_OPTIONS);
          domLayer.frames.removeEventListener('scroll', handleScroll, DEFAULT_SCROLL_OPTIONS);

          domLayer.logVerbose('Scroll element into view failed. Timeout reached.');
          retryWithDifferentConfig();
        }
      }, SCROLL_END_DEBOUNCE_TIME);
    } catch (error) {
      reject(error);
    }
  });
}
