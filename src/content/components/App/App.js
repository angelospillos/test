import { THEME_MODE } from '@angelos/core/theme/modes';
import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { setGlobalContainer } from 'react-laag';
import { useSelector } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import localStorage from '~/content/services/localStorage';
import AppContext from '~/contexts/App';
import useContentScriptConnected from '~/hooks/useContentScriptConnected';
import { selectWindowTestId, selectWindowTestRunId } from '~/modules/extension/extension.selectors';
import { selectIsRunningTestRun } from '~/modules/runner/runner.selectors';
import { selectUserId } from '~/modules/user/user.selectors';

import CustomCursor from '../CustomCursor';
import Modals from '../Modals';
import OverlayMenu from '../OverlayMenu';

import { Container } from './App.styled';

const App = ({ windowId, hiddenOverlay }) => {
  const testId = useSelector(selectWindowTestId(windowId));
  const [isMounted, setIsMounted] = useState(false);
  const modalContainerRef = useRef();
  const tooltipContainerRef = useRef();
  const testRunId = useSelector(selectWindowTestRunId(windowId));
  const userId = useSelector(selectUserId);
  const isRunning = useSelector(selectIsRunningTestRun(testRunId));
  const isContentScriptConnected = useContentScriptConnected();

  useEffect(() => {
    if (modalContainerRef.current) {
      setIsMounted(true);
    }
  }, [modalContainerRef]);

  useEffect(() => {
    if (tooltipContainerRef.current) {
      setGlobalContainer(tooltipContainerRef.current);
    }
  }, [tooltipContainerRef]);

  useLayoutEffect(() => {
    localStorage.setUser(userId);
  }, [userId]);

  const theme = useMemo(() => ({ mode: THEME_MODE.LIGHT }), []);

  const MemoizedModals = useMemo(
    () => (isMounted ? <Modals container={modalContainerRef.current} /> : null),
    [modalContainerRef, isMounted],
  );

  // eslint-disable-next-line react/jsx-no-constructed-context-values
  const appContext = {
    modalContainer: modalContainerRef.current,
  };

  return (
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <AppContext.Provider value={appContext}>
          <Container ref={modalContainerRef}>
            {isContentScriptConnected && !hiddenOverlay && (
              <OverlayMenu windowId={windowId} testId={testId} />
            )}
            {isContentScriptConnected && isRunning && <CustomCursor />}
            <div id="angelos-tooltip-container" ref={tooltipContainerRef} />
          </Container>
          {isMounted && MemoizedModals}
        </AppContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
};

export default App;
