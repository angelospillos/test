import { cond, T, always, equals, pathEq } from 'ramda';

import { HTMLTags, HTMLInputTypes } from '~/constants/browser';
import { ASSERTION_TYPE, ASSERTION_PROPERTY, EVENT_TYPE } from '~/constants/test';
import domLayer from '~/services/domLayer';
import { cloneElementWithoutUselessChildren } from '~/utils/browser';

const getRadioOrCheckboxEventDetails = (event) => ({
  assertionProperty: event.target.checked
    ? ASSERTION_PROPERTY.CHECKED
    : ASSERTION_PROPERTY.NOT_CHECKED,
  assertionExpectedValue: 'true',
});

const inputTypePath = ['target', 'type'];

const getSelectEventDetails = (event) => ({
  assertionProperty: ASSERTION_PROPERTY.VALUE,
  assertionExpectedValue: event.target.value,
});

const getInputEventDetails = cond([
  [pathEq(inputTypePath, HTMLInputTypes.RADIO), getRadioOrCheckboxEventDetails],
  [pathEq(inputTypePath, HTMLInputTypes.CHECKBOX), getRadioOrCheckboxEventDetails],
  [
    T,
    (event) => ({
      assertionProperty: ASSERTION_PROPERTY.VALUE,
      assertionExpectedValue: event.target.value || event.target.src,
    }),
  ],
]);

const getGenericEventDetails = (event) => {
  const { textContent } = cloneElementWithoutUselessChildren(event.target);
  if (!textContent) {
    return {
      assertionProperty: ASSERTION_PROPERTY.VISIBLE,
      assertionExpectedValue: 'true',
    };
  }
  return {
    assertionProperty: ASSERTION_PROPERTY.TEXT_CONTENT,
    assertionExpectedValue: textContent,
  };
};
export default async function assert(event) {
  const target = domLayer.findClosestVisible(event.target);
  if (!target) {
    this.logInfo('There is no visible element to record');
    return;
  }

  Object.defineProperty(event, 'target', { value: target });
  const eventDetails = await this.dumpEventDetails(event);
  eventDetails.assertionType = ASSERTION_TYPE.EQUAL;

  const elementSpecificDetails = cond([
    [
      equals(HTMLTags.TEXTAREA),
      always({
        assertionProperty: ASSERTION_PROPERTY.VALUE,
        assertionExpectedValue: event.target.value,
      }),
    ],
    [equals(HTMLTags.SELECT), () => getSelectEventDetails(event)],
    [equals(HTMLTags.INPUT), () => getInputEventDetails(event)],
    [T, () => getGenericEventDetails(event)],
  ])(event.target.tagName);

  const eventData = {
    ...eventDetails,
    ...elementSpecificDetails,
  };

  this.addEventRequested(EVENT_TYPE.ASSERT, eventData);
}
