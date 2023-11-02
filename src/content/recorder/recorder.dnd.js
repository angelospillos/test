import { clamp, without } from 'ramda';

import { HTMLInputTypes, HTMLTags } from '~/constants/browser';
import { EVENT_TYPE, INTERACTION_POSITION_TYPE } from '~/constants/test';
import domLayer from '~/services/domLayer';

const isSliderInteraction = (dragTarget, initialDragRect) => {
  const endDragTargetRect = dragTarget.getBoundingClientRect();
  const hPosChanged = initialDragRect.left !== endDragTargetRect.left;
  const vPosChanged = initialDragRect.top !== endDragTargetRect.top;
  return !(hPosChanged && vPosChanged);
};

const isValidElement = (element) => {
  if (!element) {
    return false;
  }
  if (!element.getBoundingClientRect) {
    // eslint-disable-next-line no-console
    console.debug(
      'Detected element without getBoundingClientRect',
      JSON.stringify(element, ['id', 'className', 'tagName']),
    );
  }

  const rect = element?.getBoundingClientRect();
  return Boolean(rect.width && rect.height);
};

export const findDropElement = (initialDragDetails, dragEvent, dropEvent) => {
  const dragTarget = dragEvent.target;
  let dropTarget = dropEvent.target;
  let dropPath = [...(dropEvent.path ?? [])];
  let validateElement = isValidElement;

  if (isSliderInteraction(dragTarget, initialDragDetails)) {
    /*
    Sometimes mousedown is emitted on parent element, but mouseup is emitted on a child of that element.
    So, the best option is to override drop (mouseup) target because it is still inside of initally grabbed element.
  */
    if (dragTarget.contains(dropTarget) && dragTarget !== dropTarget) {
      dropPath = without([dropTarget], dropPath);
      dropTarget = dragTarget;
    }

    const elementUnderDraggedElement = document.elementFromPoint(
      initialDragDetails.clientX,
      initialDragDetails.clientY,
    );

    validateElement = (dropParentElement) =>
      isValidElement(dropParentElement) && dropParentElement.contains(elementUnderDraggedElement);
  }

  if (dropTarget === dragTarget) {
    return dropPath.slice(1).find(validateElement) ?? dragTarget;
  }

  return dropTarget;
};

export default async function dragAndDrop(event) {
  const recorder = this;

  if (domLayer.isTextHighlighted() || event.target.tagName === HTMLTags.SELECT) {
    /*
      It's necessary to avoid recording extra DnD steps while text selection
      or setting select value with extra mouse movement (mousedown -> mousemove -> mouseup)
    */
    return;
  }

  const DISTANCE_DIFF_TO_DND_TRIGGER = 20;
  const diffX = Math.abs(event.clientX - recorder.lastRawMouseDownEvent.clientX);
  const diffY = Math.abs(event.clientY - recorder.lastRawMouseDownEvent.clientY);
  const isDragAndDropInteraction =
    diffX >= DISTANCE_DIFF_TO_DND_TRIGGER || diffY >= DISTANCE_DIFF_TO_DND_TRIGGER;

  if (
    !isDragAndDropInteraction ||
    recorder.isInvalidTarget(event.target) ||
    recorder.lastRawMouseDownEvent?.target?.type === HTMLInputTypes.RANGE
  ) {
    return;
  }

  const initialDragDetails = recorder.lastEvents[EVENT_TYPE.MOUSEDOWN];
  const dropElement = findDropElement(initialDragDetails, recorder.lastRawMouseDownEvent, event);
  Object.defineProperty(event, 'target', { value: dropElement });

  const dragDetails = await recorder.dumpEventDetails(recorder.lastRawMouseDownEvent);
  const dropDetails = await recorder.dumpEventDetails(event);

  recorder.addEventRequested(EVENT_TYPE.DROP, {
    ...dragDetails,
    dndDragX: Math.round(Math.max(0, initialDragDetails.clientX - initialDragDetails.left)),
    dndDragY: Math.round(Math.max(0, initialDragDetails.clientY - initialDragDetails.top)),
    dndDropX: Math.ceil(clamp(0, dropDetails.width, dragDetails.centroid[0] - dropDetails.left)),
    dndDropY: Math.ceil(clamp(0, dropDetails.height, dragDetails.centroid[1] - dropDetails.top)),
    dndDropSelectors: dropDetails.selectors,
    dndDropInteractionPosition: INTERACTION_POSITION_TYPE.CUSTOM,
  });
}
