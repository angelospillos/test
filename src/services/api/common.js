/* eslint-disable no-param-reassign */
import axios from 'axios';
import status from 'http-status';
import { nanoid } from 'nanoid';
import { identity, pick } from 'ramda';

import { BACKEND_ERROR_CODES } from '~/constants/errorCodes';
import { MODAL_TYPE } from '~/constants/modal';
import { CoreActions } from '~/modules/core';
import * as exceptions from '~/modules/runner/runner.exceptions';
import StoreRegistry, { STORE_TYPES } from '~/modules/storeRegistry';
import { UIStateActions } from '~/modules/uistate/uistate.redux';
import { selectUserToken } from '~/modules/user/user.selectors';
import i18n from '~/translations';
import { serializeError } from '~/utils/errors';
import fetchAdapter from '~/vendors/axios-fetch-adapter';

const requestInterceptor = (request) => {
  const state = StoreRegistry.get(STORE_TYPES.BACKGROUND).getState();
  const authToken = selectUserToken(state);

  if (authToken) {
    request.headers.common.Authorization = `Token ${authToken}`;
  }

  request.params = { ...(request.params || {}), reqId: nanoid(8) };
  return request;
};

const apiInstance = axios.create({
  baseURL: process.env.API_REST_URL,
  responseType: 'json',
  credentials: 'same-origin',
  adapter: fetchAdapter,
});

export const baseUrl = process.env.API_REST_URL;

export const axiosFetch = (url, config = {}) =>
  axios.get(url, {
    ...config,
    adapter: fetchAdapter,
  });

export const getVersion = () => axiosFetch(`${baseUrl}/api/version`);

export const sendFormData = (url, data) => {
  const formData = new FormData();

  Object.keys(data).forEach((name) => {
    formData.append(name, data[name]);
  });

  const state = StoreRegistry.get(STORE_TYPES.BACKGROUND).getState();
  const authToken = selectUserToken(state);

  const headers = {};
  if (authToken) {
    headers.Authorization = `Token ${authToken}`;
  }
  return fetch(`${baseUrl}${url}?reqId=${nanoid(8)}`, {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'same-origin',
  });
};

export const handleError = (error) => {
  const { message, config } = error;
  const { url, method, params } = config ?? {};

  if (params?.ignoreGlobalErrorCatch) {
    error.isHandled = true;
    throw error;
  }

  const transformedMessage = i18n.t(
    'exceptions.apiError.defaultMessage',
    '{{ message }}: {{ method }} {{- url }}',
    { message, url, method: method?.toUpperCase() },
  );
  const customError = new exceptions.RequestError({ message: transformedMessage, url });
  if (error.response) {
    const errorClass = status[`${error.response.status}_CLASS`];
    if ([status.classes.CLIENT_ERROR, status.classes.SERVER_ERROR].includes(errorClass)) {
      const serializedError = serializeError(customError);
      const details = {
        request: error.config.data ?? { data: null },
        response: pick(['status', 'data'], error.response),
      };

      if (
        url.includes('start-recording') &&
        [
          BACKEND_ERROR_CODES.TEST_NOT_FOUND,
          BACKEND_ERROR_CODES.TEST_RUN_NOT_FOUND,
          BACKEND_ERROR_CODES.STEP_NOT_FOUND,
          BACKEND_ERROR_CODES.STEP_RUN_NOT_FOUND,
        ].includes(details.response.data[0].code)
      ) {
        StoreRegistry.dispatchInBackground(
          UIStateActions.showModal(MODAL_TYPE.TEST_RUN_DOES_NOT_EXIST),
        );
        error.isHandled = true;
      } else if (url.includes('screenshot')) {
        ['screenshot', 'screenshotData'].forEach((key) => {
          if (details.request && details.request[key]) {
            details.request[key] = `${details.request[key].substring(0, 20)} [...]`;
          }
          if (details.response.data && details.response.data[key]) {
            details.response.data[key] = `${details.response.data[key].substring(0, 20)} [...]`;
          }
        });

        StoreRegistry.dispatchInBackground(
          CoreActions.captureExceptionAsWarning(serializedError, details),
        );
      } else {
        StoreRegistry.dispatchInBackground(
          CoreActions.captureException(serializedError, null, details),
        );
        error.isHandled = true;
        throw error;
      }
    }
  } else {
    const serializedError = serializeError(customError);
    const details = {
      request: error.config?.data ?? null,
      response: {
        isResponseEmpty: true,
      },
    };
    StoreRegistry.dispatchInBackground(
      CoreActions.captureExceptionAsWarning(serializedError, details),
    );
    error.isHandled = true;
    throw error;
  }
};

apiInstance.interceptors.request.use(requestInterceptor);
apiInstance.interceptors.response.use(identity, handleError);

export default apiInstance;
