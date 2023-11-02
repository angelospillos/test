/* eslint-disable no-template-curly-in-string */
import * as Yup from 'yup';

import i18n from '~/translations';

export const DATA_RESTRICTIONS = {
  SUITE_NAME_MAX_LENGTH: 100,
  PROJECT_NAME_MAX_LENGTH: 100,
  SCHEDULE_NAME_MAX_LENGTH: 100,
  TEST_NAME_MAX_LENGTH: 255,
  VARIABLE_NAME_MAX_LENGTH: 30,
  PROFILE_NAME_MAX_LENGTH: 50,
};

export const VALIDATION_MESSAGE = {
  REQUIRED: i18n.t('validationMessage.required', 'This field is required'),
  ALPHANUMERIC: i18n.t(
    'validationMessage.alphanumeric',
    'This field should contain only alphanumeric characters',
  ),
};

export const alphanumericValidator = Yup.string()
  .test('alphanumeric', VALIDATION_MESSAGE.ALPHANUMERIC, (value) =>
    /^[a-zA-Z0-9\-_]*[a-zA-Z_][0-9]*$/.test(value),
  )
  .required(VALIDATION_MESSAGE.REQUIRED);

export const valueNameValidator = alphanumericValidator
  .max(DATA_RESTRICTIONS.VARIABLE_NAME_MAX_LENGTH, VALIDATION_MESSAGE.MAX_LENGTH)
  .default('');
