import { equals, cond, always, T, empty, mapObjIndexed } from 'ramda';

import {
  STEP_SCROLL_DIRECTION_TYPE,
  STEP_SCROLL_EDGE_TYPE,
  STEP_SCROLL_TARGET_TYPE,
  STEP_SCROLL_TO_TYPE,
} from '~/constants/test';
import { getElement, getWindow } from '~/content/runner/wait';
import {
  NextStepElementRequiredError,
  NextActiveStepWithElementRequiredError,
  ScrollFailedError,
  ElementDoesNotExist,
} from '~/modules/runner/runner.exceptions';
import { selectLastRunningStepTimer } from '~/modules/runner/runner.selectors';
import storeRegistry from '~/modules/storeRegistry';
import domLayer from '~/services/domLayer';
import {
  getElementWidth,
  getElementHeight,
  hasSamePosition,
  getElementMaxScrollXYPosition,
} from '~/utils/browser';
import { sleep } from '~/utils/misc';

import { SCROLL_REPEAT_INTERVAL_TIME } from './runner.constants';

export const getEdgePosition = (scrollableElement, type) => {
  const { maxScrollY, maxScrollX } = getElementMaxScrollXYPosition(scrollableElement);
  const middleScrollYPosition = maxScrollY / 2;
  const middleScrollXPosition = maxScrollX / 2;

  return cond([
    [
      equals(STEP_SCROLL_EDGE_TYPE.TOP_CENTER),
      always({ scrollY: 0, scrollX: middleScrollXPosition }),
    ],
    [equals(STEP_SCROLL_EDGE_TYPE.TOP_LEFT), always({ scrollY: 0, scrollX: 0 })],
    [equals(STEP_SCROLL_EDGE_TYPE.TOP_RIGHT), always({ scrollY: 0, scrollX: maxScrollX })],
    [
      equals(STEP_SCROLL_EDGE_TYPE.BOTTOM_CENTER),
      always({ scrollY: maxScrollY, scrollX: middleScrollXPosition }),
    ],
    [equals(STEP_SCROLL_EDGE_TYPE.BOTTOM_LEFT), always({ scrollY: maxScrollY, scrollX: 0 })],
    [
      equals(STEP_SCROLL_EDGE_TYPE.BOTTOM_RIGHT),
      always({ scrollY: maxScrollY, scrollX: maxScrollX }),
    ],
    [equals(STEP_SCROLL_EDGE_TYPE.LEFT), always({ scrollY: middleScrollYPosition, scrollX: 0 })],
    [
      equals(STEP_SCROLL_EDGE_TYPE.CENTER),
      always({ scrollY: middleScrollYPosition, scrollX: middleScrollXPosition }),
    ],
    [
      equals(STEP_SCROLL_EDGE_TYPE.RIGHT),
      always({ scrollY: middleScrollYPosition, scrollX: maxScrollX }),
    ],
  ])(type);
};

const getHalfOfTotalSize = (size) => parseInt(size / 2, 10);

const roundAllProps = mapObjIndexed((num) => Math.round(num));

const hasSameRoundedPosition = (oldPos, newPos) =>
  hasSamePosition(roundAllProps(oldPos), roundAllProps(newPos));

export const getNextElementRange = (scrollableElement, direction) => {
  const scrollYMove = getHalfOfTotalSize(getElementHeight(scrollableElement));
  const scrollXMove = getHalfOfTotalSize(getElementWidth(scrollableElement));
  const currentPosition = domLayer.interactions.getElementScrollXYPosition(scrollableElement);
  const { maxScrollY, maxScrollX } = getElementMaxScrollXYPosition(scrollableElement);

  const position = cond([
    [
      equals(STEP_SCROLL_DIRECTION_TYPE.UP),
      always({
        scrollY: Math.max(currentPosition.scrollY - scrollYMove, 0),
        scrollX: currentPosition.scrollX,
      }),
    ],
    [
      equals(STEP_SCROLL_DIRECTION_TYPE.DOWN),
      always({
        scrollY: currentPosition.scrollY + scrollYMove,
        scrollX: currentPosition.scrollX,
      }),
    ],
    [
      equals(STEP_SCROLL_DIRECTION_TYPE.LEFT),
      always({
        scrollY: currentPosition.scrollY,
        scrollX: Math.max(currentPosition.scrollX - scrollXMove, 0),
      }),
    ],
    [
      equals(STEP_SCROLL_DIRECTION_TYPE.RIGHT),
      always({
        scrollY: currentPosition.scrollY,
        scrollX: currentPosition.scrollX + scrollXMove,
      }),
    ],
  ])(direction);

  if (position.scrollX > maxScrollX) {
    position.scrollX = maxScrollX;
  }
  if (position.scrollY > maxScrollY) {
    position.scrollY = maxScrollY;
  }

  return position;
};

export default async function scroll({ testRunId, step, tabId }) {
  const isWindowScroll = step.scrollInside === STEP_SCROLL_TARGET_TYPE.WINDOW;
  let oldPosition = {};
  const runner = this;
  const result = await (isWindowScroll ? getWindow(step) : getElement(step));

  runner.updateStepRunResult(testRunId, tabId, step.id, result);
  if (!result.elementExists) {
    throw new ElementDoesNotExist();
  }

  const scrollableElement = isWindowScroll ? window : result.element;

  const handleScroll = domLayer.interactions.getMousePositionUpdateHandler(window);
  window.addEventListener('scroll', handleScroll);

  const scrollTo = (x, y) => {
    scrollableElement.scrollTo({ left: x, top: y, behavior: 'smooth' });
    const newPosition = domLayer.interactions.getElementScrollXYPosition(scrollableElement);

    if (!hasSameRoundedPosition(oldPosition, newPosition)) {
      runner.updateStepRunResult(testRunId, tabId, step.id, newPosition);
      oldPosition = newPosition;
    }
    return newPosition;
  };

  const resolveScrollPosition = async (getNewExpectedPosition, timeout) => {
    const initialTime = Date.now();
    let expectedPosition = getNewExpectedPosition();
    let currentPosition = scrollTo(expectedPosition.scrollX, expectedPosition.scrollY);

    while (!hasSameRoundedPosition(currentPosition, expectedPosition)) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(SCROLL_REPEAT_INTERVAL_TIME);
      if (timeout && Date.now() - initialTime >= timeout) {
        runner.updateStepRunResult(testRunId, tabId, step.id, {
          errorCode: new ScrollFailedError().params.errorCode,
          isSoftSuccess: true,
        });
        break;
      }
      if (runner.stopRunning) {
        break;
      }

      expectedPosition = getNewExpectedPosition();
      currentPosition = scrollTo(expectedPosition.scrollX, expectedPosition.scrollY);
    }
    return currentPosition;
  };

  const scrollToCoords = async () => {
    runner.logPotentialTimeoutReason(testRunId, new ScrollFailedError());

    return resolveScrollPosition(
      always({ scrollX: step.scrollX, scrollY: step.scrollY }),
      // TODO: refactor
      selectLastRunningStepTimer(storeRegistry.getProxyState()).scrollTimeout,
    );
  };

  const scrollToEdge = async () => {
    const getNewExpectedPosition = () => getEdgePosition(scrollableElement, step.scrollEdge);
    return resolveScrollPosition(getNewExpectedPosition);
  };

  const scrollToElement = async () => {
    if (!step.nextActiveStepWithSelector) {
      throw new NextActiveStepWithElementRequiredError();
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (runner.stopRunning) {
        runner.logVerbose('[scroll] Stopped.');
        break;
      }

      runner.logVerbose('[scroll] Starting new scroll attempt');

      const {
        element: targetElement,
        isSuccess: isScrollSuccess,
        isSoftSuccess,
        elementExists,
        // eslint-disable-next-line no-await-in-loop
      } = await getElement(step.nextActiveStepWithSelector);

      runner.logPotentialTimeoutReason(testRunId, new NextStepElementRequiredError());

      if (!elementExists || !domLayer.isVisible(targetElement)) {
        const nextPositionToSearch = getNextElementRange(scrollableElement, step.scrollDirection);

        if (hasSameRoundedPosition(nextPositionToSearch, oldPosition)) {
          runner.logVerbose(
            '[scroll] Page is already scrolled to the end. Waiting for element to appear for the last time.',
          );

          // eslint-disable-next-line no-await-in-loop
          const lastChanceForElement = await runner.waitForElement({
            testRunId,
            tabId,
            step: step.nextActiveStepWithSelector,
            doesNotExistError: new NextStepElementRequiredError(),
            disabledResultUpdates: true,
          });
          if (lastChanceForElement.isSuccess || lastChanceForElement.isSoftSuccess) {
            lastChanceForElement.element.scrollIntoViewIfNeeded();
            runner.logVerbose('[scroll] Element appeared after the last scroll attempt.');
            break;
          }
        } else {
          runner.logVerbose(
            '[scroll] Looking for target on different position:',
            nextPositionToSearch,
          );
          // eslint-disable-next-line no-await-in-loop
          await resolveScrollPosition(always(nextPositionToSearch), null);
        }
      } else if (isScrollSuccess || isSoftSuccess) {
        runner.logVerbose(`[scroll] Target found. ${isSoftSuccess ? 'Soft success.' : 'Success!'}`);
        break;
      }
    }
  };

  const waitForScroll = cond([
    [equals(STEP_SCROLL_TO_TYPE.COORDS), always(scrollToCoords)],
    [equals(STEP_SCROLL_TO_TYPE.EDGE), always(scrollToEdge)],
    [equals(STEP_SCROLL_TO_TYPE.UNTIL_NEXT_STEP_ELEMENT_IS_VISIBLE), always(scrollToElement)],
    [T, always(empty)],
  ])(step.scrollTo);

  await waitForScroll();
  window.removeEventListener('scroll', handleScroll);
}
