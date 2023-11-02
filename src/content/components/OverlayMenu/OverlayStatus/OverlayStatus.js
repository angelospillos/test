import Loader from '@angelos/core/components/Loader';
import { CheckRegularIcon, DotIcon } from '@angelos/core/theme/icons';
import debounce from 'lodash.debounce';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useFirstMountState from '~/hooks/useFirstMountState';
import {
  selectIsRecordingProcessing,
  selectRecordedStepsNumber,
} from '~/modules/recorder/recorder.selectors';

import { Container, RecStatus, SavedStepStatus, LoadingStatus } from './OverlayStatus.styled';

const SAVED_MESSAGE_TTL = 1000;
const SAVED_MESSAGE_DELAY = 200;

const OverlayStatus = ({ recording, running, saving }) => {
  const isFirstMount = useFirstMountState();
  const isProcessing = useSelector(selectIsRecordingProcessing);
  const stepsNumber = useSelector(selectRecordedStepsNumber);
  const [isSavedVisible, setIsSavedVisible] = useState(false);
  const savedTimeout = useState();
  const { t } = useTranslation();

  const handleSavedStatus = useMemo(
    () =>
      debounce((saved) => {
        if (saved.current) {
          clearTimeout(saved.current);
        } else {
          setIsSavedVisible(true);
        }
        // eslint-disable-next-line no-param-reassign
        saved.current = setTimeout(() => {
          setIsSavedVisible(false);
        }, SAVED_MESSAGE_TTL);
      }, SAVED_MESSAGE_DELAY),
    [],
  );

  useEffect(() => {
    if (!isFirstMount && !isProcessing) {
      handleSavedStatus(savedTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, stepsNumber]);

  useEffect(
    () => () => {
      clearTimeout(savedTimeout.current);
      handleSavedStatus.cancel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <Container data-testid="OverlayStatus">
      <LoadingStatus>
        {(running || (saving && !isSavedVisible)) && <Loader size="small" />}
        {running && <p>{t('overlayStatus.running', 'Test is running...')}</p>}
      </LoadingStatus>
      {recording && !saving && !isSavedVisible && (
        <RecStatus>
          <DotIcon />
          {t('overlayStatus.recording', 'REC')}
        </RecStatus>
      )}
      {recording && !saving && isSavedVisible && (
        <SavedStepStatus>
          <CheckRegularIcon />
          {t('overlayStatus.saved', 'Saved')}
        </SavedStepStatus>
      )}
    </Container>
  );
};

export default OverlayStatus;
