import { without } from 'ramda';

import domLayer from '~/services/domLayer';

const TRANSITION_CLEANUP_TIMEOUT_DELAY = 100;

export const ANIMATION_INTERATION_INFINITE = 'infinite';

class AnimationsControl {
  constructor() {
    this.animating = [];
    this.infiniteAnimations = [];
    this.transitioning = new Map();
    this.transitioningCleanupTimeouts = new Map();
  }

  queueDelayedAnimationsInAnimatingList = (node) => {
    if (!node || node.nodeType !== document.ELEMENT_NODE) {
      return;
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i += 1) {
        this.queueDelayedAnimationsInAnimatingList(node.children[i]);
      }
    }
    const styles = domLayer.getComputedStyle(node);
    const { animationDelay } = styles;
    if (animationDelay) {
      const delay = parseFloat(animationDelay);
      if (delay > 0.0) {
        if (this.#isInfiniteAnimation(node, styles)) {
          this.infiniteAnimations.push(node);
        }
        this.animating.push(node);
      }
    }
  };

  #hasAnimatingElementContainElement = (element) => (animatingElement) =>
    animatingElement.contains(element);

  #isInfiniteAnimation = (target, styles) => {
    const computedStyles = styles || domLayer.getComputedStyle(target);

    const { animationIterationCount } = computedStyles;
    return animationIterationCount === ANIMATION_INTERATION_INFINITE;
  };

  isElementPartOfAnimatingTree = (element) =>
    this.animating.some(this.#hasAnimatingElementContainElement(element));

  isElementPartOfInifniteAnimatingTree = (element) =>
    this.infiniteAnimations.some(this.#hasAnimatingElementContainElement(element));

  hasOnlyActiveInfiniteAnimations = (element) => {
    const activeAnimations = this.animating.filter(
      this.#hasAnimatingElementContainElement(element),
    );
    const activeInfiniteAnimations = this.infiniteAnimations.filter(
      this.#hasAnimatingElementContainElement(element),
    );
    return !!activeAnimations.length && activeInfiniteAnimations.length === activeAnimations.length;
  };

  handleTransitionStart = (event) => {
    if (this.transitioningCleanupTimeouts.get(event.target)) {
      clearTimeout(this.transitioningCleanupTimeouts.get(event.target));
    }
    const styles = domLayer.getComputedStyle(event.target);
    const { transitionDuration, transitionDelay } = styles;
    const transitionTime = parseFloat(transitionDuration || 0) + parseFloat(transitionDelay || 0);
    if (transitionTime) {
      const cleanupTimeout = setTimeout(() => {
        this.transitioning.delete(event.target);
        clearTimeout(this.transitioningCleanupTimeouts.get(event.target));
      }, transitionTime * 1000 + TRANSITION_CLEANUP_TIMEOUT_DELAY);
      this.transitioningCleanupTimeouts.set(event.target, cleanupTimeout);
    }
  };

  handleTransitionEnd = (event) => {
    this.transitioning.delete(event.target);
  };

  handleTransitionCancel = (event) => {
    this.transitioning.delete(event.target);
  };

  handleAnimationStart = (event) => {
    if (this.#isInfiniteAnimation(event.target)) {
      this.infiniteAnimations.push(event.target);
    }
    this.animating.push(event.target);
  };

  handleAnimationEnd = (event) => {
    this.animating = without([event.target], this.animating);
    this.infiniteAnimations = without([event.target], this.infiniteAnimations);
  };

  handleMutation = (mutations) => {
    /* this is actually an animationcancel event simulation */
    const mutatedAnimations = [];
    for (let i = 0; i < mutations.length; i += 1) {
      const mutation = mutations[i];
      if (mutation.addedNodes.length > 0) {
        for (let j = 0; j < mutation.addedNodes.length; j += 1) {
          const node = mutation.addedNodes[j];
          // Smart identification of expected animations. This could prevent from too fast
          // clicking.
          // When element is in the DOM and not moving but immediately after animation-delay
          // animation is starting. Then element is moving and click is missing
          // (or just page is not ready yet to handle click). Implemented after problems with
          // ryanair.com page.
          this.queueDelayedAnimationsInAnimatingList(node);
        }
      }
      for (let x = 0; x < this.animating.length; x += 1) {
        const animatingElement = this.animating[x];
        for (let n = 0; n < mutation.removedNodes.length; n += 1) {
          const removedNode = mutation.removedNodes[n];
          if (removedNode.contains(animatingElement) && !document.body.contains(animatingElement)) {
            if (!mutatedAnimations.includes(animatingElement)) {
              mutatedAnimations.push(animatingElement);
            }
          }
        }
        if (mutation.target.contains(animatingElement)) {
          const { animationDuration } = domLayer.getComputedStyle(animatingElement);
          if (!animationDuration || parseFloat(animationDuration) === 0.0) {
            mutatedAnimations.push(animatingElement);
          }
        }
      }
    }
    this.animating = without(mutatedAnimations, this.animating);
  };

  initMutationObserver = () => {
    const config = {
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      childList: true,
    };
    const mutationObserver = new MutationObserver(this.handleMutation);
    mutationObserver.observe(document.body, config);
  };

  start = () => {
    document.addEventListener('animationstart', this.handleAnimationStart);
    document.addEventListener('animationend', this.handleAnimationEnd);
    document.addEventListener('transitionstart', this.handleTransitionStart);
    document.addEventListener('transitionend', this.handleTransitionEnd);
    document.addEventListener('transitioncancel', this.handleTransitionCancel);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initMutationObserver();
      });
    } else {
      this.initMutationObserver();
    }
  };

  stop = () => {
    document.removeEventListener('animationstart', this.handleAnimationStart);
    document.removeEventListener('animationend', this.handleAnimationEnd);
    document.removeEventListener('transitionstart', this.handleTransitionStart);
    document.removeEventListener('transitionend', this.handleTransitionEnd);
    document.removeEventListener('transitioncancel', this.handleTransitionCancel);
  };
}

export default new AnimationsControl();
