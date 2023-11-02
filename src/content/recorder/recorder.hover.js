import { EVENT_TYPE } from '~/constants/test';

export default async function hover(event) {
  const recorder = this;
  const eventDetails = await recorder.dumpEventDetails(event);
  recorder.addEventRequested(EVENT_TYPE.HOVER, eventDetails);
  recorder.captureScreenshot();
  recorder.eventsCatcherLayer.enableMouseEventsWithPropagation();
}
