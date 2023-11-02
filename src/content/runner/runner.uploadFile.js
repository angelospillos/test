import { last } from 'ramda';

import { HTMLTags } from '~/constants/browser';
import {
  UnchangableElement,
  ElementDoesNotExist,
  FileUploadError,
  FileDoesNotExist,
} from '~/modules/runner/runner.exceptions';
import api from '~/services/api';
import storage from '~/services/browser/storage';
import { sleep } from '~/utils/misc';

import { CHANGE_REPEAT_INTERVAL_TIME } from './runner.constants';
import { getElement } from './wait';

const unchangableElementError = new UnchangableElement();
const elementDoesNotExistError = new ElementDoesNotExist();
const fileUploadError = new FileUploadError();

export const getFile = async (url) => {
  try {
    const response = await api.fetch(url, {
      responseType: 'blob',
    });
    const fileName = decodeURI(last(url.split('?')[0].split('/')));
    return new File([await response.data.arrayBuffer()], fileName, { type: response.data.type });
  } catch (error) {
    throw new FileDoesNotExist();
  }
};

export default async function uploadFile({ testRunId, step, tabId }) {
  const runner = this;
  let result;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (runner.stopRunning) {
      return;
    }

    // eslint-disable-next-line no-await-in-loop
    result = await getElement(step);
    runner.updateStepRunResult(testRunId, tabId, step.id, result);

    if (!result.elementExists) {
      runner.logPotentialTimeoutReason(testRunId, elementDoesNotExistError);
    } else if (HTMLTags.INPUT !== result.element.tagName) {
      runner.logPotentialTimeoutReason(testRunId, unchangableElementError);
    } else if (result.isSuccess) {
      runner.logPotentialTimeoutReason(testRunId, null);
      break;
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(CHANGE_REPEAT_INTERVAL_TIME);
  }

  let hasFile = false;

  const dataTransfer = new window.DataTransfer();

  const file = await getFile(step.value);
  dataTransfer.items.add(file);

  const handleFileInputChange = (event) => {
    storage.setStepExecuted(step.id);
    hasFile =
      result.element.value.endsWith(file.name) || event.dataTransfer.files[0].name === file.name;
  };
  const eventListener = {
    name: 'change',
    handler: handleFileInputChange,
    options: { once: true, capture: true },
  };

  window.addEventListener(eventListener.name, eventListener.handler, eventListener.options);
  result.element.files = dataTransfer.files;

  const event = new CustomEvent('change', {
    bubbles: true,
    cancelable: true,
    detail: dataTransfer,
  });
  Object.assign(event, { dataTransfer });

  const cleanUp = () => {
    window.removeEventListener(eventListener.name, eventListener.handler, eventListener.options);
  };

  result.element.dispatchEvent(event);

  runner.logPotentialTimeoutReason(testRunId, fileUploadError);
  // eslint-disable-next-line no-constant-condition
  while (!hasFile) {
    if (runner.stopRunning) {
      cleanUp();
      return;
    }
  }
  runner.logPotentialTimeoutReason(testRunId, null);
}
