import { RECORDING_MODE } from '~/constants/test';
import domLayer from '~/services/domLayer';

const INSPECTOR_ID = 'angelos-inspector';

const RECORDING_MODE_COLOR = {
  [RECORDING_MODE.EVENT]: '#521ec9',
  [RECORDING_MODE.ASSERT]: '#00db25',
  [RECORDING_MODE.HOVER]: '#fa8303',
};

const ElementInspector = {
  borderSize: 1,
  pointer: null,
  remove: () => {
    if (ElementInspector.pointer) {
      ElementInspector.pointer.style.display = 'none';
    }
  },

  init: () => {
    const pointer = document.createElement('div');
    pointer.id = INSPECTOR_ID;
    document.body.parentElement.appendChild(pointer);
    ElementInspector.pointer = pointer;
    Object.assign(ElementInspector.pointer.style, {
      position: 'fixed',
      display: 'none',
      pointerEvents: 'none',
      margin: 0,
      padding: 0,
      zIndex: 2147483647,
    });
  },

  update: (event, mode, omitangelosOverlay = false) => {
    const { target } = event;

    if (target === document.body || target === document || target === document.documentElement) {
      ElementInspector.remove();
      return;
    }
    if (!ElementInspector.pointer) {
      ElementInspector.init();
    }

    let visibleTarget = target;
    if (mode === RECORDING_MODE.ASSERT) {
      visibleTarget = domLayer.findClosestVisible(target);
    }

    if (mode === RECORDING_MODE.HOVER && omitangelosOverlay) {
      const { clientX, clientY } = event;
      const detectedElements = document.elementsFromPoint(clientX, clientY);
      visibleTarget = [...detectedElements].filter(
        (element) =>
          !element.classList.contains('angelos-mouse-events-catcher') &&
          domLayer.isVisible(element, true),
      )?.[0];
    }

    const targetRect = domLayer.getClientRect(visibleTarget);

    let { width, height } = targetRect;

    const { clientWidth, clientHeight } = document.documentElement;

    const bothSideBorderSize = ElementInspector.borderSize * 2;

    if (targetRect.left + width + bothSideBorderSize > clientWidth) {
      width = clientWidth - targetRect.left - bothSideBorderSize;
    }
    if (targetRect.top + height + bothSideBorderSize > clientHeight) {
      height = clientHeight - targetRect.top - bothSideBorderSize;
    }

    const styles = {
      left: `${targetRect.left - ElementInspector.borderSize}px`,
      top: `${targetRect.top - ElementInspector.borderSize}px`,
      height: `${targetRect.height + bothSideBorderSize}px`,
      width: `${targetRect.width + bothSideBorderSize}px`,
      border: `${ElementInspector.borderSize}px dashed ${RECORDING_MODE_COLOR[mode]}`,
      display: 'block',
    };
    Object.assign(ElementInspector.pointer.style, styles);
  },
};

export default ElementInspector;
