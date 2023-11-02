import { groupBy, propEq, prop } from 'ramda';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  CUSTOM_WAITING_CONDITION,
  CONDITION_PARAMS,
  INITIAL_CONDITIONS_LIST,
  END_CONDITIONS_LIST,
} from '~/constants/step';
import { selectLastRunningStepResult } from '~/modules/runner/runner.selectors';

import useFirstMountState from './useFirstMountState';

const splitConditions = (condition) => {
  if (INITIAL_CONDITIONS_LIST.includes(condition.type)) {
    return 'initial';
  }
  if (END_CONDITIONS_LIST.includes(condition.type)) {
    return 'final';
  }
  return 'regular';
};

const isFailure = propEq('isSuccess', false);

const CONDITIONS_VISIBILITY_TIMEOUT = 3000;

const useUnresolvedCondition = (isRunning) => {
  const { t } = useTranslation();
  const stepRun = useSelector(selectLastRunningStepResult);
  const unresolvedConditionTimeout = useRef();
  const isFirstMount = useFirstMountState();
  const [condition, setCondition] = useState({});
  const [isVisible, setIsVisible] = useState(false);
  const { conditionsState, elementExists } = stepRun || {};

  const hideCondition = useCallback(() => {
    clearTimeout(unresolvedConditionTimeout.current);
    unresolvedConditionTimeout.current = null;
    setCondition({});
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (isRunning) {
      const waitingConditions = Object.values(conditionsState || {});
      const {
        initial = [],
        regular = [],
        final = [],
      } = groupBy(splitConditions, waitingConditions);

      let pendingCondition = initial.find(isFailure);
      if (!pendingCondition && !elementExists && waitingConditions.length) {
        pendingCondition = { ...CUSTOM_WAITING_CONDITION.ELEMENT_EXISTS, elementExists };
      } else if (elementExists) {
        regular.push(...final);
        pendingCondition = regular.find(isFailure);
      }

      if (!pendingCondition) {
        hideCondition();
      } else {
        setCondition({
          ...pendingCondition,
          elementExists,
          label: pendingCondition?.label || prop('label', CONDITION_PARAMS[pendingCondition?.type]),
        });

        if (!unresolvedConditionTimeout.current) {
          unresolvedConditionTimeout.current = setTimeout(() => {
            setIsVisible(true);
          }, CONDITIONS_VISIBILITY_TIMEOUT);
        }
      }
    } else {
      hideCondition();
    }
  }, [conditionsState, elementExists, isRunning, hideCondition, stepRun, t]);

  useEffect(
    () => () => {
      clearTimeout(unresolvedConditionTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (!isFirstMount && !isRunning) {
      hideCondition();
    }
  }, [isRunning, hideCondition, isFirstMount]);

  return {
    label: condition.label,
    elementExists: condition.elementExists,
    isVisible: !!(isVisible && condition.label),
  };
};

export default useUnresolvedCondition;
