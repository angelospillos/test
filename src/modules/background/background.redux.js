import { createActions } from 'reduxsauce';

export const { Types: BackgroundTypes, Creators: BackgroundActions } = createActions(
  {
    captureTabScreenshotRequested: [],
    captureElementScreenshotRequested: ['tabId', 'event'],
    clearScreenshotsHistoryRequested: [],
    pageNavigationCommitted: ['testRunId', 'tabId', 'frameId'],
    pageNavigationCompleted: ['testRunId', 'tabId', 'frameId'],
    domContentLoaded: ['tabId', 'frameId'],
  },
  { prefix: 'BACKGROUND/' },
);
