import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { STEP_TYPE } from '~/constants/test';
import useUnresolvedCondition from '~/hooks/useUnresolvedCondition';
import {
  selectWindowTestRunId,
  selectTabIsNetworkIdle,
  selectIsPromptOpened,
} from '~/modules/extension/extension.selectors';
import { selectIsRecording } from '~/modules/recorder/recorder.selectors';
import {
  selectCurrentTabIdForTestRunId,
  selectIsRunningTestRun,
  selectLastRunningStepTimer,
  selectLastRunningStepType,
} from '~/modules/runner/runner.selectors';
import i18n from '~/translations';

import { useCountDown } from './useCountDown';

const EMPTY_MESSAGE = { label: '' };
const MESSAGE_VISIBLITY_TIMEOUT_MS = 5000;

const getBusyNetworkMessage = () => ({
  label: i18n.t('messages.requestsListener', 'Waiting for network requests to be finished.'),
});

const getConditionsMessage = (label) => ({
  label: i18n.t('messages.unresolvedCondition', 'Waiting for "{{ conditionLabel }}".', {
    conditionLabel: label,
  }),
});

const getOpenedPromptMessage = () => ({
  label: i18n.t('messages.openedPrompt', 'Waiting for prompt to be opened.'),
});

const getResolvingSoftConditionsMessage = () => ({
  label: i18n.t(
    'messages.softConditions',
    'Waiting conditions not fulfilled, trying to continue anyway.',
  ),
});

const useRuntimeMessages = (windowId) => {
  const { t } = useTranslation();
  const testRunId = useSelector(selectWindowTestRunId(windowId));
  const tabId = useSelector(selectCurrentTabIdForTestRunId(testRunId));
  const isNetworkIdle = useSelector(selectTabIsNetworkIdle(tabId));
  const isRecording = useSelector(selectIsRecording);
  const timeouts = useSelector(selectLastRunningStepTimer);
  const stepType = useSelector(selectLastRunningStepType);
  const isRunning = useSelector(selectIsRunningTestRun(testRunId));
  const {
    label: unresolvedConditionLabel,
    isVisible: shouldShowCondition,
    elementExists,
  } = useUnresolvedCondition(isRunning);
  const [message, setMessage] = useState(EMPTY_MESSAGE);
  const timeLeftToSleepResolve = useCountDown(timeouts?.start);
  const timeLeftToSoftResolve = useCountDown(timeouts?.conditionsEnd);
  const timeLeftToStepTimeout = useCountDown(timeouts?.end);
  const timeLeftToDisplayTimeout = useCountDown(
    (timeouts?.start ?? 0) + MESSAGE_VISIBLITY_TIMEOUT_MS,
  );
  const shouldShowSoftConditionsMessage = !timeLeftToSoftResolve;
  const shouldShowSleepMessage = !!timeLeftToSleepResolve;
  const isPromptOpened = useSelector(selectIsPromptOpened);
  const shouldShowPromptMessage = !isPromptOpened && stepType === STEP_TYPE.ANSWER_PROMPT;
  const isVisible =
    isRunning &&
    timeLeftToStepTimeout &&
    (!isNetworkIdle || shouldShowCondition || shouldShowPromptMessage || shouldShowSleepMessage);

  useLayoutEffect(() => {
    if (tabId && !isRecording && isVisible) {
      if (shouldShowPromptMessage) {
        setMessage(getOpenedPromptMessage());
      } else if (shouldShowSoftConditionsMessage && elementExists) {
        setMessage(getResolvingSoftConditionsMessage());
      } else if (!isNetworkIdle || shouldShowCondition) {
        setMessage(
          !isNetworkIdle ? getBusyNetworkMessage() : getConditionsMessage(unresolvedConditionLabel),
        );
      }
    } else {
      setMessage(EMPTY_MESSAGE);
    }
  }, [
    tabId,
    isRunning,
    isRecording,
    unresolvedConditionLabel,
    shouldShowCondition,
    isNetworkIdle,
    timeouts,
    elementExists,
    t,
    shouldShowSoftConditionsMessage,
    timeLeftToSoftResolve,
    isVisible,
    shouldShowPromptMessage,
  ]);

  return {
    ...message,
    sleep: timeLeftToSleepResolve,
    timeout: !timeLeftToDisplayTimeout ? timeLeftToStepTimeout : 0,
    isVisible,
  };
};

export default useRuntimeMessages;
