import { cond, pipe, prop, propEq, T } from 'ramda';

import { HTMLInputTypes, HTMLTags } from '~/constants/browser';
import { BackgroundActions } from '~/modules/background/background.redux';
import runtimeMessaging from '~/services/runtimeMessaging';
import { removeExtraWhiteSpace } from '~/utils/misc';

export const captureScreenshot = () =>
  runtimeMessaging.dispatchActionInBackground(BackgroundActions.captureTabScreenshotRequested());

const getTargetFile = (target) =>
  new Promise((resolve, reject) => {
    const file = target.files[0];

    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        url: event.target.result,
      });
    });
    reader.addEventListener('error', () => {
      reject(new Error(`Error occurred while reading file: ${file.name}`));
    });

    try {
      reader.readAsDataURL(file);
    } catch (error) {
      reject(new Error(`Invalid file type. It's not a Blob: ${file?.name}, ${file?.type}`));
    }
  });

const getSelectValue = (target) =>
  [...target.selectedOptions].map(pipe(prop('textContent'), removeExtraWhiteSpace)).join('\n');

export const getTargetValue = cond([
  [propEq('tagName', HTMLTags.SELECT), getSelectValue],
  [propEq('type', HTMLInputTypes.FILE), getTargetFile],
  [T, prop('value')],
]);

export const getScrollValues = (event, isTargetDocument = event.target === document) => ({
  scrollY: parseFloat(
    isTargetDocument ? parseInt(window.scrollY, 10) : parseInt(event.target.scrollTop, 10),
  ),
  scrollX: parseFloat(
    isTargetDocument ? parseInt(window.scrollX, 10) : parseInt(event.target.scrollLeft, 10),
  ),
});
