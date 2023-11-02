import produce from 'immer';
import { prop, path, isEmpty, isNil } from 'ramda';

import { extractErrors } from '~/utils/apiErrorHandler';

const isRequest = (type) => type.endsWith('_REQUEST') || type.endsWith('_REQUESTED');
const isFailure = (type) => type.endsWith('_FAILURE') || type.endsWith('_FAILED');
const isSuccess = (type) => type.endsWith('_SUCCESS') || type.endsWith('_SUCCEEDED');

export const getBaseActionName = (type, meta) => {
  const baseName = type.split(
    /(_REQUEST|_SUCCESS|_FAILURE|_RESET|_REQUESTED|_SUCCEEDED|_FAILED)$/,
  )[0];
  if (!isEmpty(meta) && !isNil(meta)) {
    const { reqId } = meta;
    if (reqId) {
      return `${baseName}:${reqId}`;
    }
  }
  return baseName;
};

export const defaultState = {
  isLoading: false,
  isSuccess: false,
  isFailure: false,
  status: null,
  errors: null,
};

const INITIAL_STATE = {};

export default produce((draftState, action) => {
  if (!action?.type || !action?.meta) {
    return;
  }
  const baseActionName = getBaseActionName(action.type, action.meta);

  if (isRequest(action.type)) {
    draftState[baseActionName] = { ...defaultState, isLoading: true, errors: {} };
  }
  if (!prop(baseActionName, draftState)) {
    return;
  }
  const isLoading = path([baseActionName, 'isLoading'], draftState);
  if (isSuccess(action.type) && isLoading) {
    draftState[baseActionName].isSuccess = true;
    draftState[baseActionName].isLoading = false;
  } else if (isFailure(action.type) && isLoading) {
    draftState[baseActionName].isFailure = true;
    draftState[baseActionName].isLoading = false;
    draftState[baseActionName].errors = extractErrors(action.error || {});
  } else if (action.type.endsWith('_RESET')) {
    draftState[baseActionName] = defaultState;
  }
}, INITIAL_STATE);
