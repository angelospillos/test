import { INTERNAL_SERVER_ERROR, FORBIDDEN, NOT_FOUND, PAYMENT_REQUIRED } from 'http-status';
import { useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getBaseActionName } from '~/modules/actionState/actionState.redux';
import selectActionState from '~/modules/actionState/actionState.selectors';

const SHOW_SUCCESS_TIMEOUT = 3000;

export default (actionFunction, params = {}) => {
  if (!actionFunction) {
    return {};
  }
  const dispatch = useDispatch();
  const { reset = true, reqId = null, onSuccess, onFailure } = params;
  const actionState = useSelector(selectActionState(actionFunction, { reqId }));
  const { isSuccess, isFailure, errors, isLoading } = actionState;
  const { type } = actionFunction();
  const baseActionName = useMemo(() => getBaseActionName(type, { reqId }), [type, reqId]);
  const resetHandler = useCallback(() => {
    dispatch({ type: `${baseActionName}_RESET`, meta: {} });
  }, [dispatch, baseActionName]);

  const errorStatus = errors && errors.response ? errors.response.status : null;
  const hasInternalServerError = !isLoading && errorStatus >= INTERNAL_SERVER_ERROR;
  const isForbidden = !isLoading && errorStatus === FORBIDDEN;
  const isNotFound = !isLoading && errorStatus === NOT_FOUND;
  const isPaymentRequired = !isLoading && errorStatus === PAYMENT_REQUIRED;

  useEffect(() => {
    let timeoutSuccessFunc;

    if (isSuccess && onSuccess) {
      onSuccess();
    }
    if (isFailure && onFailure) {
      onFailure(errors, errorStatus, {
        hasInternalServerError,
        isForbidden,
        isNotFound,
        isPaymentRequired,
      });
    }
    if ((isSuccess || isFailure) && reset) {
      timeoutSuccessFunc = setTimeout(() => {
        resetHandler();
      }, SHOW_SUCCESS_TIMEOUT);
    }
    return () => {
      clearTimeout(timeoutSuccessFunc);
    };
  }, [
    isSuccess,
    isFailure,
    isLoading,
    dispatch,
    baseActionName,
    reset,
    onFailure,
    onSuccess,
    errors,
    resetHandler,
    errorStatus,
    hasInternalServerError,
    isForbidden,
    isNotFound,
    isPaymentRequired,
  ]);

  useEffect(
    () => () => {
      if (reset) {
        resetHandler();
      }
    },
    [reset, resetHandler],
  );

  return {
    isSuccess,
    isFailure,
    errors,
    isLoading,
    hasInternalServerError,
    isPaymentRequired,
    isForbidden,
    isNotFound,
    reset: resetHandler,
  };
};
