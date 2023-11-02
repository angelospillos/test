import isPlainObject from 'lodash.isplainobject';
import { is, pathOr } from 'ramda';
import format from 'string-format';

import i18n from '~/translations';

export const errorsMessages = {
  authorizationError: i18n.t('backendErrorsMap.authorizationError', 'Authorization error.'),
  userAlreadyExists: i18n.t(
    'backendErrorsMap.userAlreadyExists',
    'The user {email} is already registered in the system as a regular account.',
  ),
  userAlreadyExistsGoogle: i18n.t(
    'backendErrorsMap.userAlreadyExistsGoogle',
    'The user {email} is already connected via Google account.',
  ),
  userAlreadyExistsGithub: i18n.t(
    'backendErrorsMap.userAlreadyExistsGithub',
    'The user {email} is already connected via GitHub account.',
  ),
  userEmailAlreadyExists: i18n.t(
    'backendErrorsMap.userEmailAlreadyExists',
    'User is already registered with this e-mail address.',
  ),
  groupNameNotUnique: i18n.t(
    'backendErrorsMap.groupNameNotUnique',
    'This name is already used by another group in your project.',
  ),
  testNameNotUnique: i18n.t(
    'backendErrorsMap.testNameNotUnique',
    'This name is already used by another test in your project.',
  ),
};

const nonFieldErrors = 'nonFieldErrors';

const getErrorMessage = (error) =>
  errorsMessages[error.code]
    ? format(errorsMessages[error.code], error.params || {})
    : error.message;

const traverseAndExtract = (fieldsWithErrors) => {
  const extracted = {};
  Object.keys(fieldsWithErrors).forEach((fieldKey) => {
    fieldsWithErrors[fieldKey].forEach((error) => {
      const fieldName = `${fieldKey !== nonFieldErrors ? fieldKey : error.code}`;
      const hasNestedErrors = !error.code && !error.message;
      if (hasNestedErrors) {
        extracted[fieldName] = traverseAndExtract(error);
      } else {
        extracted[fieldName] = getErrorMessage(error);
      }
    });
  });
  return extracted;
};

export const extractErrors = (errorResponse) => {
  let extracted = {};
  const responseData = is(Error, errorResponse)
    ? pathOr([], ['response', 'data'], errorResponse)
    : errorResponse;

  try {
    if (!Array.isArray(responseData)) {
      return extracted;
    }

    if (responseData[0] && responseData[0].code && is(String, responseData[0].code)) {
      return { [responseData[0].code]: responseData[0].message };
    }

    responseData.forEach((errorsMap) => {
      if (isPlainObject(errorsMap)) {
        extracted = { ...extracted, ...traverseAndExtract(errorsMap) };
      }
    });

    return extracted;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.debug('Errors to extract', responseData);
    throw error;
  }
};
