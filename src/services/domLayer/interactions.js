import debounce from 'lodash.debounce';

import { INTERACTION_POSITION_TYPE } from '~/constants/test';
import { selectTabMousePosition } from '~/modules/extension/extension.selectors';
import { RunnerActions } from '~/modules/runner/runner.redux';
import {
  selectCurrentTabIdForTestRunId,
  selectRunningTestRun,
} from '~/modules/runner/runner.selectors';
import storeRegistry from '~/modules/storeRegistry';
import {
  clipPolygonToBbox,
  combinePolygons,
  diffPolygons,
  getPolygonPointsList,
  transformRectToPolygon,
} from '~/utils/math';

import BaseService from '../baseService';
import runtimeMessaging from '../runtimeMessaging';

import { getVisibleContentRects } from './helpers';

const MOUSE_POSITION_UPDATE_DEBOUNCE_TIME = 33;

export default class Interactions extends BaseService {
  constructor(domLayer) {
    super('Interactions');
    this.domLayer = domLayer;
  }

  isClickable = async (element) => {
    if (
      !element ||
      element.nodeType !== document.ELEMENT_NODE ||
      [true, 'disabled'].includes(element.disabled) ||
      this.domLayer.getComputedStyle(element).getPropertyValue('pointer-events') === 'none'
    ) {
      return Promise.resolve(false);
    }

    return Boolean(
      element.getAttribute('onclick') ||
        element.getAttribute('href') ||
        element.getAttribute('role') === 'button' ||
        element.getAttribute('type') === 'button' ||
        (await this.domLayer.getElementListeners(element)).click?.length,
    );
  };

  isNonClickableChildOfElement = async (element, sourceElement) => {
    const elementsToCheck = this.domLayer
      .getPath(element)
      .filter((node) => sourceElement.contains(node));

    if (!elementsToCheck.length) {
      return false;
    }

    let isClickable = false;
    for (let index = 0; index < elementsToCheck.length; index += 1) {
      const elementFromPath = elementsToCheck[index];
      // eslint-disable-next-line no-await-in-loop
      isClickable = elementFromPath !== sourceElement && (await this.isClickable(elementFromPath));

      if (isClickable) {
        break;
      }
    }

    return !isClickable;
  };

  getRegularMousePosition = (elementRect, interactionPosition, customInteractionCoords) => {
    const xUnit = elementRect.width / 6;
    const yUnit = elementRect.height / 6;
    let x;
    let y;

    switch (interactionPosition) {
      case INTERACTION_POSITION_TYPE.CUSTOM: {
        x = elementRect.x + (customInteractionCoords?.x ?? 0);
        y = elementRect.y + (customInteractionCoords?.y ?? 0);
        break;
      }
      case INTERACTION_POSITION_TYPE.TOP_LEFT: {
        x = elementRect.x + xUnit;
        y = elementRect.y + yUnit;
        break;
      }
      case INTERACTION_POSITION_TYPE.TOP_CENTER: {
        x = elementRect.x + xUnit * 3;
        y = elementRect.y + yUnit;
        break;
      }
      case INTERACTION_POSITION_TYPE.TOP_RIGHT: {
        x = elementRect.x + xUnit * 5;
        y = elementRect.y + yUnit;
        break;
      }
      case INTERACTION_POSITION_TYPE.LEFT: {
        x = elementRect.x + xUnit;
        y = elementRect.y + yUnit * 3;
        break;
      }
      case INTERACTION_POSITION_TYPE.RIGHT: {
        x = elementRect.x + xUnit * 5;
        y = elementRect.y + yUnit * 3;
        break;
      }
      case INTERACTION_POSITION_TYPE.BOTTOM_LEFT: {
        x = elementRect.x + xUnit;
        y = elementRect.y + yUnit * 5;
        break;
      }
      case INTERACTION_POSITION_TYPE.BOTTOM_CENTER: {
        x = elementRect.x + xUnit * 3;
        y = elementRect.y + yUnit * 5;
        break;
      }
      case INTERACTION_POSITION_TYPE.BOTTOM_RIGHT: {
        x = elementRect.x + xUnit * 5;
        y = elementRect.y + yUnit * 5;
        break;
      }
      case INTERACTION_POSITION_TYPE.CENTER:
      default: {
        x = elementRect.x + xUnit * 3;
        y = elementRect.y + yUnit * 3;
        break;
      }
    }

    return { x: Math.round(x), y: Math.round(y) };
  };

  getTargetValidator = (element) => async (target) =>
    // is exact element
    element === target ||
    // is proper child element
    this.isNonClickableChildOfElement(target, element);

  getSmartMousePosition = async (element, rect) => {
    const isValidTarget = this.getTargetValidator(element);
    const centerPoint = this.getRegularMousePosition(rect, INTERACTION_POSITION_TYPE.CENTER);
    const interactionTarget = document.elementFromPoint(centerPoint.x, centerPoint.y);
    this.logVerbose(
      '[getSmartMousePosition] center interaction target',
      centerPoint,
      interactionTarget,
    );

    if (
      rect.x > window.innerWidth || // is out of viewport
      rect.y > window.innerHeight ||
      (await isValidTarget(interactionTarget))
    ) {
      this.logVerbose('[getSmartMousePosition] target on center point is valid');
      return centerPoint;
    }

    // Get rects of elements which have own click handler
    const clickableChildRects = await getVisibleContentRects(element, this.isClickable);

    this.logVerbose('[getSmartMousePosition] clickableChildRects', clickableChildRects);

    const clickablePolygon = combinePolygons(
      clickableChildRects.map((childRect) => transformRectToPolygon(childRect, 1)),
    );

    // Get space of non-blickable elements
    const elementPolygon = transformRectToPolygon(rect);
    let nonClickablePolygon = elementPolygon;

    if (clickablePolygon) {
      this.logVerbose(
        '[getSmartMousePosition] searching for non clickable polygon',
        rect,
        elementPolygon,
        clickablePolygon,
      );
      nonClickablePolygon = diffPolygons(elementPolygon, clickablePolygon);
    }
    this.logVerbose('[getSmartMousePosition] nonClickablePolygon', nonClickablePolygon);

    // Clip space to viewport
    const clippedPolygon = clipPolygonToBbox(nonClickablePolygon, [
      0,
      0,
      window.innerWidth,
      window.innerHeight,
    ]);

    // Find possible interaction points
    const pointsList = getPolygonPointsList(clippedPolygon);
    this.logVerbose('[getSmartMousePosition] pointsList', pointsList);

    for (let index = 0; index < pointsList.length; index += 1) {
      const point = pointsList[index];
      const intPoint = { x: Math.round(point.x), y: Math.round(point.y) };
      // Validate if position points to proper element
      const pointTarget = document.elementFromPoint(intPoint.x, intPoint.y);
      // eslint-disable-next-line no-await-in-loop
      if (await isValidTarget(pointTarget)) {
        this.logVerbose('[getSmartMousePosition] valid target', pointTarget);
        return intPoint;
      }
    }

    return centerPoint;
  };

  getMousePosition = async (element, rect, interactionPosition, customInteractionCoords) => {
    const isSmartDetection = interactionPosition === INTERACTION_POSITION_TYPE.SMART;
    return isSmartDetection
      ? this.getSmartMousePosition(element, rect)
      : this.getRegularMousePosition(rect, interactionPosition, customInteractionCoords);
  };

  getElementScrollXYPosition = (element) => ({
    scrollX: element === window ? element.scrollX : element.scrollLeft,
    scrollY: element === window ? element.scrollY : element.scrollTop,
  });

  getMousePositionUpdateHandler = (element) => {
    const state = storeRegistry.getProxyState();
    const testRun = selectRunningTestRun(state);
    if (!testRun) {
      return Function.prototype;
    }
    const tabId = selectCurrentTabIdForTestRunId(testRun.testRunId)(state);

    const initialMousePosition = selectTabMousePosition(tabId)(state);
    const initialScrollPosition = this.getElementScrollXYPosition(element);

    return debounce(() => {
      const currentScrollPosition = this.getElementScrollXYPosition(element);
      const diffScrollX = currentScrollPosition.scrollX - initialScrollPosition.scrollX;
      const diffScrollY = currentScrollPosition.scrollY - initialScrollPosition.scrollY;

      runtimeMessaging.dispatchActionInBackground(
        RunnerActions.updateMousePositionRequested(
          tabId,
          initialMousePosition.x - diffScrollX,
          initialMousePosition.y - diffScrollY,
        ),
      );
    }, MOUSE_POSITION_UPDATE_DEBOUNCE_TIME);
  };
}
