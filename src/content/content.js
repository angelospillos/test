import '~/translations';

import { render } from 'react-dom';
import { Provider } from 'react-redux';

import { RECORDED_WEBSITE } from '~/constants/events';
import Root from '~/content/components/Root';
import recorder from '~/content/recorder';
import runner from '~/content/runner/runner';
import { dispatch, proxyStore } from '~/content/store';
import { ContentActions, ContentTypes } from '~/modules/content/content.redux';
import { RecorderTypes } from '~/modules/recorder/recorder.redux';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import storeRegistry from '~/modules/storeRegistry';
import { UserActions } from '~/modules/user/user.redux';
import domLayer from '~/services/domLayer';
import Logger from '~/services/logger';
import runtimeMessaging from '~/services/runtimeMessaging';
import { FONTS_STYLESHEET } from '~/theme/fonts';
import { listenOnWindowMove } from '~/utils/browser';
import { captureException, captureExceptionAsWarning, catchUnexpectedErrors } from '~/utils/errors';
import { createPersistentPort } from '~/utils/extension';
import * as sentryUtils from '~/utils/sentry';

import styles from './content.scss';

const MAX_LOGS_SIZE_BYTES = 100000;

const logger = Logger.get('Content');
// eslint-disable-next-line no-undef, camelcase
__webpack_public_path__ = chrome.runtime.getURL('');

const captureRuntimeException = (error) => captureException(error, false);

if (process.env.SENTRY_DSN) {
  sentryUtils.init('content');
}

window.bb = { recorder, runner, domLayer, logger };

let injectedAppContainer;
const extensionId = chrome.runtime.id;

const createAppContainer = () => {
  const appContainer = document.createElement('div');
  document.body.parentElement.appendChild(appContainer);
  appContainer.classList.add('angelos');
  appContainer.id = 'angelos';
  Object.assign(appContainer.style, {
    position: 'fixed',
    width: '100%',
    height: '100%',
    zIndex: 2147483647,
    pointerEvents: 'none',
    filter: 'none',
    display: 'block',
    visibility: 'visible',
    opacity: 1,
    transform: 'none',
  });
  return appContainer;
};

const renderOverlay = async (windowId, isSelenium) => {
  await domLayer.waitForBody();

  injectedAppContainer = createAppContainer();

  try {
    await proxyStore.ready();

    render(
      <Provider store={proxyStore}>
        <Root windowId={windowId} hiddenOverlay={isSelenium} />
        <style type="text/css">{FONTS_STYLESHEET}</style>
        <style type="text/css">{styles}</style>
      </Provider>,
      injectedAppContainer,
    );
  } catch (error) {
    captureRuntimeException(error);
  }
};

const renderAssets = async () => {
  injectedAppContainer = createAppContainer();

  try {
    render(
      <>
        <style type="text/css">{FONTS_STYLESHEET}</style>
        <style type="text/css">{styles}</style>
      </>,
      injectedAppContainer,
    );
  } catch (error) {
    captureRuntimeException(error);
  }
};

const handleSagasMessage = catchUnexpectedErrors(
  (msg, sender) => {
    logger.info('Have message', msg, sender);
    dispatch({ ...msg, source: 'content' });
    domLayer.postMessage(msg, '*');
  },
  { isBackgroundContext: false },
);

const initWindowPositionListener = (userSettings) => {
  let settings = { ...userSettings };

  const handleWindowMove = (left, top) => {
    if (settings.windowPositionTop !== top || settings.windowPositionLeft !== left) {
      settings = {
        windowPositionTop: top,
        windowPositionLeft: left,
      };
      runtimeMessaging.dispatchActionInBackground(
        UserActions.updateExtensionSettingsRequested(settings),
      );
    }
  };
  listenOnWindowMove(handleWindowMove);

  // Window can be moved during init so we have do extra check on init
  handleWindowMove(window.screenLeft, window.screenTop);
};

const initRecording = async () => {
  recorder.captureScreenshot();

  try {
    await domLayer.isDocumentReady('initRecording');
    recorder.bindListeners();
    recorder.initScreenshotRecorder();
    logger.info('Recording init finished for frame:', domLayer.frames.frameId);
  } catch (error) {
    captureException(error);
  }
};

export const bootstrap = async (frameId, settings) => {
  const { projectSettings, isRecording, isRunning, isSelenium, windowId, tabId, userSettings } =
    settings;

  await domLayer.init(tabId, frameId, projectSettings);
  const frame = await domLayer.getCurrentFrame(projectSettings);

  if (frame.isRoot) {
    initWindowPositionListener(userSettings);
  }

  runtimeMessaging.dispatchActionInBackground(ContentActions.initialized(frame));

  if (isRecording) {
    await initRecording();
  }
  if (frame.isRoot) {
    await renderOverlay(windowId, isSelenium);
  } else if (!isSelenium) {
    await renderAssets();
  }
  if (isRunning) {
    await runner.start();
  }
};

const handleMessage = catchUnexpectedErrors(
  async (event) => {
    if (!event.data || typeof event.data !== 'object') {
      return;
    }

    switch (event.data?.type) {
      case RecorderTypes.ADD_EVENT_REQUESTED: {
        logger.info('Content received event ADD_EVENT_REQUESTED', event.data);
        recorder.handleAddEventRequested(event);
        break;
      }
      case ContentTypes.GET_SETTINGS_SUCCEEDED: {
        logger.info('Content received event GET_SETTINGS_SUCCEEDED', event.data);
        bootstrap(event.data.frameId, event.data.settings);
        break;
      }
      case ContentTypes.START_RECORDING_REQUESTED: {
        logger.info('Content received event START_RECORDING_REQUESTED', event.data);
        await initRecording();
        break;
      }
      case RECORDED_WEBSITE.PROMPT_RESOLVED: {
        const isRecording = selectIsRecording(await storeRegistry.getState());
        logger.info('Content received event ANSWER_PROMPT', event.data);
        if (isRecording) {
          recorder.answerPrompt(event.data.result);
        }
        break;
      }
      case RECORDED_WEBSITE.LOG: {
        try {
          const logSizeInBytes = new TextEncoder().encode(event.data.args).length;
          if (logSizeInBytes <= MAX_LOGS_SIZE_BYTES) {
            Logger.storeLog(event.data.loggingType, JSON.parse(event.data.args));
          } else {
            logger.debug('Log size exceeded', logSizeInBytes);
          }
        } catch (error) {
          captureExceptionAsWarning(error, {}, false);
        }
        break;
      }
      default:
        break;
    }
  },
  { isBackgroundContext: false },
);

const handleResize = catchUnexpectedErrors(
  () => {
    runtimeMessaging.dispatchActionInBackground(
      ContentActions.resizeViewportRequested({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }),
    );
  },
  { isBackgroundContext: false },
);

export const closeContentSession = () => {
  domLayer.removeEventListener('message', handleMessage);
  domLayer.removeEventListener('resize', handleResize);
  chrome.runtime.onMessage.removeListener(handleSagasMessage);
  domLayer.reset();
  recorder.reset();
  runner.reset();
};

const initContentSession = (extId) => {
  logger.debug('Extension ID:', extId);
  chrome.runtime.onMessage.addListener(handleSagasMessage);

  domLayer.addEventListener('message', handleMessage);
  domLayer.addEventListener('resize', handleResize);

  proxyStore
    .ready()
    .then(() => {
      runtimeMessaging.dispatchActionInBackground(
        ContentActions.getSettingsRequested({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        }),
      );
    })
    .catch((e) => {
      logger.debug('Proxy store init aborted', e);
    });

  createPersistentPort('content', () => {
    closeContentSession();
    logger.debug('Connection with background.js aborted');
  });
};

initContentSession(extensionId);
