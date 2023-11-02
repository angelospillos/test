import { captureScreenshot } from '~/content/recorder/recorder.helpers';
import { showPageLoadingMessage, removeMessage } from '~/services/messages';

showPageLoadingMessage();

const removeRecordingMessage = async (force) => {
  await removeMessage(force);
  captureScreenshot();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    removeRecordingMessage();
  });
} else {
  removeRecordingMessage();
}
