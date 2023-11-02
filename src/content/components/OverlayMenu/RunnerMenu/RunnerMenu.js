import { FINAL_STATUSES } from '@angelos/core/constants';
import { CheckRegularIcon, SmallDotIcon } from '@angelos/core/theme/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import StatusBadge from '~/content/components/StatusBadge';
import { selectTestRunByTestId } from '~/modules/runner/runner.selectors';
import { getFormattedDuration } from '~/utils/dates';

import { Button, PrimaryButton, Headline } from '../OverlayMenu.styled';

import { Results, ResultRow, ResultLabel } from './RunnerMenu.styled';

const RunnerMenu = ({ testId, onFinish, onStartRecording }) => {
  const { t } = useTranslation();
  const testRun = useSelector(selectTestRunByTestId(testId));

  const isFinished = FINAL_STATUSES.includes(testRun?.status);

  return (
    <>
      {isFinished ? (
        <>
          <Headline>{t('overlayMenu.headlineRunning', 'Finished running')}</Headline>
          <Results>
            <ResultRow>
              <ResultLabel>{t('overlayMenu.result', 'Result')}</ResultLabel>
              <StatusBadge
                status={testRun?.status}
                warning={testRun?.warning}
                continueOnFailure={testRun?.continueOnFailure}
                extended
              />
            </ResultRow>
            <ResultRow>
              <ResultLabel>{t('overlayMenu.runTime', 'Run time')}</ResultLabel>
              <div>{testRun?.duration ? getFormattedDuration(testRun.duration, true) : 'n/a'}</div>
            </ResultRow>
          </Results>
        </>
      ) : (
        <Headline>{t('overlayMenu.headlinePaused', 'Paused recording')}</Headline>
      )}
      <Button Icon={SmallDotIcon} onClick={onStartRecording}>
        {isFinished
          ? t('runnerMenu.startRecording', 'Start recording')
          : t('runnerMenu.continueRecording', 'Continue recording')}
      </Button>
      <PrimaryButton Icon={CheckRegularIcon} onClick={onFinish}>
        {t('runnerMenu.closeWindows', 'Finish and close')}
      </PrimaryButton>
    </>
  );
};

export default RunnerMenu;
