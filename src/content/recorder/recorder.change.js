import { cond, T, always, equals, propEq } from 'ramda';

import { HTMLTags, HTMLInputTypes } from '~/constants/browser';
import { MAX_FILE_SIZE } from '~/constants/step';
import { EVENT_TYPE } from '~/constants/test';
import { showFileSizeMessage } from '~/services/messages';
import { isEditableTextField } from '~/utils/browser';

import { getTargetValue } from './recorder.helpers';

const getNumberInputDetails = (initialDetails) => {
  const eventDetails = { ...initialDetails };
  eventDetails.fromInputSpinnerClick = true;

  return eventDetails;
};

const getFileInputDetails = (initialDetails) => {
  const eventDetails = { ...initialDetails };
  eventDetails.fromFileUpload = true;

  if (eventDetails.value.size > MAX_FILE_SIZE) {
    eventDetails.value = null;
    showFileSizeMessage();
  }

  return eventDetails;
};

const getCustomInputDetails = (initialDetails, sourceEvent) => {
  const getDetails = cond([
    [equals(HTMLInputTypes.FILE), always(getFileInputDetails)],
    [equals(HTMLInputTypes.NUMBER), always(getNumberInputDetails)],
    // eslint-disable-next-line etc/no-commented-out-code
    // text, password, color, submit, radio, checkbox, search, range, url, telephone, time, date, datetime-loca, week, month
    [T, () => always(initialDetails)],
  ])(sourceEvent.target.type);

  return getDetails(initialDetails, sourceEvent);
};

const inputTypesHandledUsingInputEvent = [
  HTMLInputTypes.DATE,
  HTMLInputTypes.DATETIME_LOCAL,
  HTMLInputTypes.TIME,
  HTMLInputTypes.MONTH,
  HTMLInputTypes.WEEK,
  HTMLInputTypes.COLOR,
];

const inputTypesWithCustomDetails = [
  HTMLInputTypes.FILE,
  HTMLInputTypes.NUMBER,
  HTMLInputTypes.RANGE,
  ...inputTypesHandledUsingInputEvent,
];

export default async function change(event) {
  if (
    (event.type === EVENT_TYPE.INPUT &&
      !inputTypesHandledUsingInputEvent.includes(event.target.type)) ||
    (event.type === EVENT_TYPE.CHANGE &&
      inputTypesHandledUsingInputEvent.includes(event.target.type))
  ) {
    return;
  }

  let eventDetails = await this.dumpEventDetails(event);
  eventDetails.value = await getTargetValue(event.target);

  const hasFieldInteractionBefore = [
    EVENT_TYPE.KEYDOWN,
    EVENT_TYPE.PASTE,
    EVENT_TYPE.CLICK,
    EVENT_TYPE.MOUSEDOWN,
  ].includes(this.lastEvent.type);
  const isAutoFilledByBrowser = !hasFieldInteractionBefore && !eventDetails.isFocused;

  const isCustomChangeEvent = inputTypesWithCustomDetails.includes(event.target.type);
  if (event.target.tagName === HTMLTags.INPUT && isCustomChangeEvent) {
    eventDetails.isCustomChangeEvent = true;
    eventDetails = getCustomInputDetails(eventDetails, event);
  } else if (isEditableTextField(event) && (hasFieldInteractionBefore || isAutoFilledByBrowser)) {
    // when user is choosing value suggested for field
    const hasSameTargetId = propEq('targetId', eventDetails.targetId, this.lastEvent);
    const hasProperValue = this.lastEventTargetValue !== eventDetails.value && !!eventDetails.value;

    if (!eventDetails.key && (hasSameTargetId || isAutoFilledByBrowser) && hasProperValue) {
      eventDetails.fromAutosuggestion = true;
    }
  }

  const shouldRecordEventAsChangeEvent =
    event.target.tagName === HTMLTags.SELECT ||
    isCustomChangeEvent ||
    eventDetails.fromAutosuggestion ||
    eventDetails.fromFileUpload;

  if (shouldRecordEventAsChangeEvent) {
    this.addEventRequested(EVENT_TYPE.CHANGE, eventDetails);
    this.lastEventTargetValue = this.getTargetValue(event);
  }
}
