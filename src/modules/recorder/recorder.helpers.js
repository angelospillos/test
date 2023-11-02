import { map, omit, pick, pipe, prop, reverse, uniqBy, values } from 'ramda';

import { CONVERTABLE_FIELDS } from '~/constants/variables';
import variables from '~/services/variables';

import EventsProcessor from './eventsProcessor';

export const processRecordedEvent = (eventData, recorderDomain) =>
  new EventsProcessor(eventData, recorderDomain).process();

export const filterChangesList = pipe(reverse, uniqBy(prop('frontId')), reverse);

export const transformChangesList = (ids, changes, testId) =>
  pipe(
    pick(ids),
    values,
    map(
      pipe(
        omit(['typing']),
        (step) =>
          variables.convertTextFieldsToVariables(
            step,
            CONVERTABLE_FIELDS,
            testId,
            step.usedVariablesNames,
          ),
        omit(['usedVariablesNames']),
      ),
    ),
  )(changes);
