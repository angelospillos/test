import {
    CheckRegularIcon,
    HoverIcon,
    PauseIcon,
    EyeIcon,
    EmailIcon,
    VariablesExtensionIcon,
  } from '@angelos/core/theme/icons';
  import { useCallback, useEffect, useState } from 'react';
  import { useTranslation } from 'react-i18next';
  import { useDispatch, useSelector } from 'react-redux';
  import { Route, Switch, useHistory, useLocation } from 'react-router';
  import { useMount } from 'react-use';
  
  import { RECORDING_MODE } from '~/constants/test';
  import localStorage from '~/content/services/localStorage';
  import views from '~/content/views';
  import { BackgroundActions } from '~/modules/background/background.redux';
  import { RecorderActions } from '~/modules/recorder/recorder.redux';
  import {
    selectIsRecordingToClipboard,
    selectRecordingMode,
  } from '~/modules/recorder/recorder.selectors';
  import { addStyleOverride, removeStyleOverride } from '~/utils/dom';
  
  import { Button, PrimaryButton } from '../OverlayMenu.styled';
  
  import AssertMenu from './AssertMenu';
  import HoverMenu from './HoverMenu';
  import InboxMenu from './InboxMenu';
  import { STORAGE_KEYS } from './RecorderMenu.constants';
  import VariablesMenu from './VariablesMenu';
  
  const RecorderMenu = ({ testId, testRunId, windowId, onFinish, isSaving }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const recordingMode = useSelector(selectRecordingMode);
    const isClipboard = useSelector(selectIsRecordingToClipboard);
    const [multipleAssert, setMultipleAssert] = useState(false);
    const [multipleHover, setMultipleHover] = useState(false);
    const [initialized, setInitialized] = useState(false);
  
    useEffect(() => {
      if (recordingMode === RECORDING_MODE.ASSERT) {
        addStyleOverride('assert');
      } else {
        removeStyleOverride('assert');
      }
  
      if (recordingMode === RECORDING_MODE.EVENT) {
        history.push(views.recorder);
      }
    }, [history, recordingMode]);
  
    useMount(() => {
      if (location.pathname === views.recorder) {
        dispatch(RecorderActions.getVariablesListRequested());
      }
    }, [location.pathname, dispatch]);
  
    useEffect(() => {
      Promise.all([
        localStorage.getUserItem(STORAGE_KEYS.MULTIPLE_ASSERT),
        localStorage.getUserItem(STORAGE_KEYS.MULTIPLE_HOVER),
      ])
        .then((values) => {
          setMultipleAssert(values[0]);
          setMultipleHover(values[1]);
        })
        .finally(() => {
          setInitialized(true);
        });
    }, []);
  
    const handleAssertionMode = useCallback(
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        dispatch(BackgroundActions.captureTabScreenshotRequested());
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.ASSERT, multipleAssert));
        history.push(views.assert);
      },
      [dispatch, history, multipleAssert],
    );
  
    const handleHoverMode = useCallback(
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        dispatch(BackgroundActions.captureTabScreenshotRequested());
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.HOVER, multipleHover));
        dispatch(RecorderActions.lockNativeMouseInteractionsRequested());
        history.push(views.hover);
      },
      [dispatch, history, multipleHover],
    );
  
    const handleEventMode = useCallback(
      (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.EVENT));
        dispatch(RecorderActions.unlockNativeMouseInteractionsRequested());
        history.push(views.recorder);
      },
      [dispatch, history],
    );
  
    const handleStopRecording = () => {
      if (isClipboard) {
        dispatch(RecorderActions.stopToClipboardRequested(testId));
      } else {
        dispatch(RecorderActions.stopRequested(true));
      }
    };
  
    const handleHoverMultipleChange = useCallback(
      (event) => {
        localStorage.setUserItem(STORAGE_KEYS.MULTIPLE_HOVER, event.target.checked);
        setMultipleHover(event.target.checked);
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.HOVER, event.target.checked));
      },
      [dispatch],
    );
  
    const handleAssertMultipleChange = useCallback(
      (event) => {
        localStorage.setUserItem(STORAGE_KEYS.MULTIPLE_ASSERT, event.target.checked);
        setMultipleAssert(event.target.checked);
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.ASSERT, event.target.checked));
      },
      [dispatch],
    );
  
    const handleOpenInbox = useCallback(() => {
      history.push(views.inbox);
    }, [history]);
  
    const handleOpenVariables = useCallback(() => {
      history.push(views.variables);
    }, [history]);
  
    const renderMainMenu = () => (
      <>
        <Button Icon={EyeIcon} onClick={handleAssertionMode} disabled={isSaving}>
          {t('overlayMenu.addAssertion', 'Add assert')}
        </Button>
        <Button Icon={HoverIcon} onClick={handleHoverMode} disabled={isSaving}>
          {t('overlayMenu.addHover', 'Add hover')}
        </Button>
        <Button Icon={EmailIcon} onClick={handleOpenInbox} disabled={isSaving}>
          {t('overlayMenu.inbox', 'Inbox')}
        </Button>
        <Button Icon={VariablesExtensionIcon} onClick={handleOpenVariables} disabled={isSaving}>
          {t('overlayMenu.variables', 'Variables')}
        </Button>
        <Button Icon={PauseIcon} onClick={handleStopRecording} disabled={isSaving}>
          {t('overlayMenu.stopRecording', 'Pause recording')}
        </Button>
        <PrimaryButton Icon={CheckRegularIcon} onClick={onFinish} disabled={isSaving}>
          {t('overlayMenu.closeWindows', 'Finish and close')}
        </PrimaryButton>
      </>
    );
  
    if (!initialized) {
      return null;
    }
  
    return (
      <Switch>
        <Route exact path={views.recorder} render={renderMainMenu} />
        <Route
          path={views.assert}
          render={() => (
            <AssertMenu
              onBackClick={handleEventMode}
              onMulitpleChange={handleAssertMultipleChange}
              multiple={multipleAssert}
            />
          )}
        />
        <Route
          path={views.hover}
          render={() => (
            <HoverMenu
              onBackClick={handleEventMode}
              onMulitpleChange={handleHoverMultipleChange}
              multiple={multipleHover}
            />
          )}
        />
        <Route
          path={views.inbox}
          render={() => (
            <InboxMenu
              onBackClick={handleEventMode}
              testId={testId}
              testRunId={testRunId}
              windowId={windowId}
            />
          )}
        />
        <Route
          path={views.variables}
          render={() => <VariablesMenu onBackClick={handleEventMode} />}
        />
      </Switch>
    );
  };
  
  export default RecorderMenu;
  