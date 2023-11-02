import Input from '@angelos/core/components/Input';
import { ArrowLeftIcon, SaveIcon } from '@angelos/core/theme/icons';
import { useFormik } from 'formik';
import { useCallback, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { batch, useDispatch, useSelector } from 'react-redux';
import { useUnmount } from 'react-use';

import IconButton from '~/components/IconButton';
import { EVENT_TYPE } from '~/constants/test';
import { VARIABLE_TYPE } from '~/constants/variables';
import useActionState from '~/hooks/useActionState';
import { RecorderActions } from '~/modules/recorder/recorder.redux';
import { selectPendingLocalVariableEvent } from '~/modules/recorder/recorder.selectors';

import { Headline, BackButton, PrimaryButton, FormField } from '../../OverlayMenu.styled';

import { setVariableFormFields, setVariableSchema } from './VariablesMenu.schema';
import { Content, Text } from './VariablesMenu.styled';

const setVariableReqId = 'setVariable';

const SetVariableView = ({ onBackClick, onFinish }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const localVariable = useSelector(selectPendingLocalVariableEvent);

  useEffect(() => {
    if (!localVariable) {
      dispatch(RecorderActions.unlockNativeMouseInteractionsRequested());
    }
  }, [dispatch, localVariable]);

  const handleSubmit = useCallback(
    (values) => {
      batch(() => {
        dispatch(
          RecorderActions.addEventRequested(
            {
              ...localVariable,
              localVariableName: values[setVariableFormFields.name],
              localVariableSource: VARIABLE_TYPE.ELEMENT,
              type: EVENT_TYPE.SET_LOCAL_VARIABLE,
            },
            true,
            { reqId: setVariableReqId },
          ),
        );
        dispatch(
          RecorderActions.addVariableToListRequested({
            timestamp: localVariable.timestamp,
            type: VARIABLE_TYPE.VALUE,
            name: values[setVariableFormFields.name],
            value: localVariable.value,
            computed: localVariable.value,
          }),
        );
      });
    },
    [localVariable, dispatch],
  );

  const initialValues = {
    [setVariableFormFields.name]: t('variablesMenu.set.defaultName', 'savedVariable'),
  };

  const formik = useFormik({
    initialValues,
    validationSchema: setVariableSchema,
    onSubmit: handleSubmit,
  });

  const handleSuccess = useCallback(() => {
    dispatch(RecorderActions.setPendingLocalVariableEventSucceeded(null));
    onFinish({});
  }, [dispatch, onFinish]);

  const handleFailure = useCallback((errors) => {
    formik.setErrors(errors.added);
    formik.setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { reset } = useActionState(RecorderActions.addEventRequested, {
    reset: false,
    onSuccess: handleSuccess,
    onFailure: handleFailure,
    reqId: setVariableReqId,
  });

  useUnmount(() => {
    reset();
  });

  return (
    <>
      <Headline>
        <IconButton onClick={onBackClick}>
          <ArrowLeftIcon />
        </IconButton>
        {t('variablesMenu.set.title', 'Save variable for later')}
      </Headline>
      <Content>
        {localVariable ? (
          <form onSubmit={formik.handleSubmit}>
            <FormField label={t('variablesMenu.set.name.label', 'Name')}>
              <Input
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...formik.getFieldProps(setVariableFormFields.name)}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...formik.getFieldMeta(setVariableFormFields.name)}
                fullWidth
                autoFocus
              />
            </FormField>
            <PrimaryButton type="submit" disabled={formik.isSubmitting || !formik.isValid}>
              {t('variablesMenu.set.saveButton', 'Save variable')}
            </PrimaryButton>
          </form>
        ) : (
          <>
            <SaveIcon />
            <Text>
              {t(
                'variablesMenu.set.decription',
                'Click any element on the page to save its text as a variable.',
              )}
            </Text>
          </>
        )}
        <BackButton onClick={onBackClick}>{t('variablesMenu.back', 'Go back')}</BackButton>
      </Content>
    </>
  );
};

export default memo(SetVariableView);
