import { last, init, flatten } from 'ramda';

import { STEP_SCROLL_DIRECTION_TYPE } from '~/constants/test';
import { isBackspace, isVisibleTextKey } from '~/utils/keyboardLayout';

const getTextFromEvent = (event) => {
  const hasSequence = (event.sequence && event.sequence !== event.key) || event.isPasted;
  return hasSequence ? event.sequence : event.key;
};

export const processTypingEventsToText = (typing) => {
  const textData = {
    value: '',
    clearBefore: false,
  };

  if (!typing || !typing.length) {
    return textData;
  }

  let textEvents = [];
  const initialValueKeys = typing[0].oldValue.split('');

  const handleBackspaceOnValue = (event) => {
    const lastEvent = last(textEvents);

    if (textEvents.length && isVisibleTextKey(lastEvent.key)) {
      textEvents.pop();
    } else if (textEvents.length && lastEvent.isPasted) {
      const updatedSequence = init(lastEvent.sequence);

      if (updatedSequence) {
        textEvents[textEvents.length - 1] = {
          ...lastEvent,
          sequence: updatedSequence,
        };
      } else {
        textEvents.pop();
      }
    } else if (!textData.clearBefore) {
      textEvents.push(event);
    }
  };

  const handleBackspaceOnInitialValue = (event) => {
    initialValueKeys.pop();

    if (!initialValueKeys.length) {
      textData.clearBefore = true;
      textEvents = [];
    } else {
      textEvents.push(event);
    }
  };

  for (let i = 0; i < typing.length; i += 1) {
    const event = typing[i];
    const isBackspaceKey = isBackspace(event.keyCode);
    const initialValueSize = initialValueKeys.length;

    if (isBackspaceKey) {
      const lastTextEvent = last(textEvents);
      if (lastTextEvent && !isBackspace(lastTextEvent.keyCode)) {
        handleBackspaceOnValue(event);
      } else if (initialValueSize) {
        handleBackspaceOnInitialValue(event);
      }
    } else {
      textEvents.push(event);
    }
  }

  textData.value = flatten(textEvents.map(getTextFromEvent)).join('');
  return textData;
};

export const getScrollDirection = (scrollEvent) => {
  const isHorizontalScroll = scrollEvent.scrollX !== scrollEvent.windowScrollX;
  if (isHorizontalScroll) {
    return scrollEvent.windowScrollX - scrollEvent.scrollX <= 0
      ? STEP_SCROLL_DIRECTION_TYPE.RIGHT
      : STEP_SCROLL_DIRECTION_TYPE.LEFT;
  }

  return scrollEvent.windowScrollY - scrollEvent.scrollY <= 0
    ? STEP_SCROLL_DIRECTION_TYPE.DOWN
    : STEP_SCROLL_DIRECTION_TYPE.UP;
};
