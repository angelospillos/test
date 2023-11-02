import { MinimizeIcon, MenuIcon } from '@angelos/core/theme/icons';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import Draggable from 'react-draggable';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Switch, Route, useHistory } from 'react-router-dom';

import Countdown from '~/components/Countdown';
import ErrorBoundry from '~/components/ErrorBoundary';
import { RECORDING_MODE } from '~/constants/test';
import views from '~/content/views';
import useRuntimeMessages from '~/hooks/useRuntimeMessages';
import { ExtensionActions } from '~/modules/extension/extension.redux';
import { selectWindowTestRunId } from '~/modules/extension/extension.selectors';
import { RecorderActions } from '~/modules/recorder/recorder.redux';
import {
  selectIsRecording,
  selectIsSaving,
  selectHasInitialState,
  selectIsRecordingOnMobile,
} from '~/modules/recorder/recorder.selectors';
import { selectIsRunningTestRun } from '~/modules/runner/runner.selectors';
import { keyCodes } from '~/utils/browser';
import { captureException } from '~/utils/errors';

import {
  Container,
  Logo,
  Buttons,
  Header,
  HeaderContent,
  RuntimeMessage,
  Headline,
  Timeout,
  ToggleButton,
} from './OverlayMenu.styled';
import OverlayStatus from './OverlayStatus';
import RecorderMenu from './RecorderMenu';
import RunnerMenu from './RunnerMenu';

const OverlayMenu = ({ windowId, testId }) => {
  const { t } = useTranslation();
  const history = useHistory();
  const dispatch = useDispatch();
  const isRecording = useSelector(selectIsRecording);
  const isRecordingOnMobile = useSelector(selectIsRecordingOnMobile);
  const isSaving = useSelector(selectIsSaving);
  const testRunId = useSelector(selectWindowTestRunId(windowId));
  const isRunning = useSelector(selectIsRunningTestRun(testRunId));
  const hasInitialState = useSelector(selectHasInitialState);
  const runtimeMessage = useRuntimeMessages(windowId);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (runtimeMessage.isVisible) {
      history.push(views.runProgress);
    } else if (isRecording || isSaving) {
      history.push(views.recorder);
    } else {
      history.push(views.runner);
    }
  }, [isRecording, isSaving, runtimeMessage.isVisible, history]);

  const handleCloseWindows = () => {
    dispatch(ExtensionActions.closeWindowsRequested());
  };
  const handleStartRecordingToClipboard = () =>
    dispatch(RecorderActions.startToClipboardRequested(testId, windowId));

  const handleRenderException = useCallback((error) => {
    captureException(error, false);
  }, []);

  const handleToggleButtonClick = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed]);

  useEffect(() => {
    const handleShortcut = ({ keyCode }) => {
      if (keyCode === keyCodes.ESC) {
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.EVENT));
        dispatch(RecorderActions.unlockNativeMouseInteractionsRequested());
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [dispatch]);

  const renderRecorderMenu = () => (
    <RecorderMenu
      testId={testId}
      testRunId={testRunId}
      windowId={windowId}
      isSaving={isSaving}
      onFinish={handleCloseWindows}
    />
  );

  const renderRunnerMenu = () => (
    <RunnerMenu
      testId={testId}
      onStartRecording={handleStartRecordingToClipboard}
      onFinish={handleCloseWindows}
    />
  );

  const renderRuntimeMessage = () => (
    <RuntimeMessage>
      <Headline>{t('messages.headline', 'Please wait')}</Headline>
      {runtimeMessage.sleep ? (
        <Timeout>
          <Trans i18nKey="messages.sleep">
            Sleep/Delay -
            <Countdown running value={runtimeMessage.sleep} inversed />
            seconds left
          </Trans>
        </Timeout>
      ) : (
        <>
          <p>{runtimeMessage.label}</p>
          {!!runtimeMessage.timeout && (
            <Timeout>
              <Trans i18nKey="messages.timeout">
                Timeout in
                <Countdown running value={runtimeMessage.timeout} inversed />
                seconds...
              </Trans>
            </Timeout>
          )}
        </>
      )}
    </RuntimeMessage>
  );

  if ((isRecording && hasInitialState) || (!runtimeMessage.isVisible && isRunning)) {
    return null;
  }

  const isCollapsingEnabled = isRecordingOnMobile && (isRecording || isSaving);

  return (
    <ErrorBoundry onError={handleRenderException}>
      <Draggable handle="#drag-handler">
        <Container disabled={isRunning} collapsed={collapsed}>
          <Header>
            <HeaderContent id={!runtimeMessage.isVisible ? 'drag-handler' : null}>
              <Logo />
              <OverlayStatus running={isRunning} recording={isRecording} saving={isSaving} />
            </HeaderContent>
            {isCollapsingEnabled && (
              <ToggleButton onClick={handleToggleButtonClick}>
                {collapsed ? <MenuIcon /> : <MinimizeIcon />}
              </ToggleButton>
            )}
          </Header>
          <Buttons>
            <Switch>
              <Route path={views.recorder} render={renderRecorderMenu} />
              <Route path={views.runner} render={renderRunnerMenu} />
              <Route path={views.runProgress} render={renderRuntimeMessage} />
            </Switch>
          </Buttons>
        </Container>
      </Draggable>
    </ErrorBoundry>
  );
};

OverlayMenu.propTypes = {
  windowId: PropTypes.number.isRequired,
  testId: PropTypes.string.isRequired,
};

export default OverlayMenu;
