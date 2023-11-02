import IconButton from '@angelos/core/components/IconButton';
import Loader from '@angelos/core/components/Loader';
import { SelectOption } from '@angelos/core/components/Select';
import VariableName from '@angelos/core/components/VariableName';
import { ArrowLeftIcon } from '@angelos/core/theme/icons';
import { ascend, descend, prop, propOr, sortBy, sortWith, mapObjIndexed, pipe } from 'ramda';
import { useCallback, useEffect, useMemo, memo, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { RecorderActions } from '~/modules/recorder/recorder.redux';
import { selectRecordingVariables } from '~/modules/recorder/recorder.selectors';
import {
  NOT_COMPUTED_VALUE,
  TOO_DEEP_NESTING,
  UNDEFINED_VARIABLE,
} from '~/services/variables/variables.constants';
import i18n from '~/translations';
import { addStyleOverride, removeStyleOverride } from '~/utils/dom';
import { ellipsis } from '~/utils/misc';

import { Headline, BackButton } from '../../OverlayMenu.styled';

import {
  Content,
  VariableItem,
  ActionHeadline,
  ActionSection,
  Select,
  InsertDescription,
  LoaderContainer,
} from './VariablesMenu.styled';

const sortActiveByRecentAndName = sortWith([
  ascend(pipe(prop('disabled'))),
  descend(propOr(0, 'timestamp')),
  ascend(prop('name')),
]);

const isVariableDisabled = (variable) =>
  [NOT_COMPUTED_VALUE, TOO_DEEP_NESTING, UNDEFINED_VARIABLE].includes(variable.computed) ||
  !variable.computed;

const getComputedValue = (variable) => {
  if (variable.computed === NOT_COMPUTED_VALUE || !variable.computed) {
    return i18n.t(
      'variablesMenu.insert.selectVariable.notComputedOption',
      '(computed while running)',
    );
  }

  if (variable.computed === TOO_DEEP_NESTING) {
    return i18n.t(
      'variablesMenu.insert.selectVariable.tooDeepNestingOption',
      '(too deep nesting level)',
    );
  }

  if (variable.computed === UNDEFINED_VARIABLE) {
    return i18n.t(
      'variablesMenu.insert.selectVariable.undefinedVariable',
      '(undefined nested variable)',
    );
  }

  return variable.computed;
};

const InsertVariableMenu = ({ onBackClick }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const variables = useSelector(selectRecordingVariables);
  const [variableToInsert, setVariableToInsert] = useState(null);

  const extendedVariables = useMemo(
    () =>
      mapObjIndexed(
        (variable, name) => ({
          ...variable,
          name,
          disabled: isVariableDisabled(variable),
          computed: getComputedValue(variable),
        }),
        variables,
      ),
    [variables],
  );

  const variablesList = sortBy(prop('name'), Object.values(extendedVariables));

  useEffect(() => {
    addStyleOverride('insert-variable');

    return () => removeStyleOverride('insert-variable');
  }, []);

  const updateVariable = useCallback(
    (variable) => {
      setVariableToInsert(variable);
      dispatch(RecorderActions.setPendingLocalVariableEventSucceeded({ variable }));
    },
    [dispatch],
  );

  const handleVariableChange = useCallback(
    (event) => {
      updateVariable({ name: event.target.value, ...variables[event.target.value] });
    },
    [updateVariable, variables],
  );

  useEffect(() => {
    if (!variableToInsert) {
      const recentVariable = sortActiveByRecentAndName(variablesList)[0];
      updateVariable(recentVariable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variablesList]);

  const renderVariable = (variable) => {
    const details = extendedVariables[variable.value];

    if (!details) {
      return variable.value;
    }

    return (
      <VariableItem>
        <span>{variable.value}</span>
        <span>{details.computed}</span>
      </VariableItem>
    );
  };

  const renderLoadingState = () => (
    <LoaderContainer>
      <Loader />
      {t('variablesMenu.insert.selectVariable.loadingState', 'Loading variables')}
    </LoaderContainer>
  );

  const variableValue = `${ellipsis(variableToInsert?.computed?.toString?.(), 45)}`;

  return (
    <>
      <Headline>
        <IconButton onClick={onBackClick}>
          <ArrowLeftIcon />
        </IconButton>
        {t('variablesMenu.insert.selectVariable.title', 'Insert variable')}
      </Headline>
      <Content>
        {!variablesList.length ? (
          renderLoadingState()
        ) : (
          <>
            <ActionSection>
              <ActionHeadline>
                <Trans i18nKey="variablesMenu.insert.selectVariable.label">
                  <span>1</span>
                  Select variable
                </Trans>
              </ActionHeadline>
              <Select
                placeholder={t(
                  'variablesMenu.insert.selectVariable.placeholder',
                  'Select variable',
                )}
                onChange={handleVariableChange}
                value={variableToInsert?.name}
                fullWidth
                showSearch
                renderSelectedOption={renderVariable}
              >
                {variablesList.map((variable) => (
                  <SelectOption
                    key={variable.name}
                    value={variable.name}
                    disabled={variable.disabled}
                    render={renderVariable}
                  />
                ))}
              </Select>
            </ActionSection>
            <ActionSection>
              <ActionHeadline>
                <Trans i18nKey="variablesMenu.insert.element.label">
                  <span>2</span>
                  Click an input element
                </Trans>
              </ActionHeadline>
              <InsertDescription>
                <Trans i18nKey="variablesMenu.insert.element.description.value">
                  You will insert &quot;{variableValue}&quot;.
                </Trans>
              </InsertDescription>
              <InsertDescription>
                <Trans i18nKey="variablesMenu.insert.element.description.variable">
                  It will be saved as
                  <VariableName>{variableToInsert?.name}</VariableName>.
                </Trans>
              </InsertDescription>
            </ActionSection>
          </>
        )}
        <BackButton onClick={onBackClick}>{t('variablesMenu.back', 'Go back')}</BackButton>
      </Content>
    </>
  );
};

export default memo(InsertVariableMenu);
