import * as Icons from '@angelos/core/theme/icons';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Route, Switch, useHistory, useLocation } from 'react-router-dom';

import IconButton from '~/components/IconButton';
import { RECORDING_MODE } from '~/constants/test';
import views from '~/content/views';
import { RecorderActions } from '~/modules/recorder/recorder.redux';

import * as OverlayStyled from '../../OverlayMenu.styled';

import InsertVariableMenu from './InsertVariableMenu';
import SetVariableView from './SetVariableView';
import * as S from './VariablesMenu.styled';

const VariablesMenu = ({ onBackClick }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    switch (location.pathname) {
      case views.variables: {
        dispatch(RecorderActions.lockNativeMouseInteractionsRequested());
        dispatch(RecorderActions.setPendingLocalVariableEventSucceeded(null));
        dispatch(RecorderActions.getVariablesListRequested());
        break;
      }
      case views.setVariable: {
        dispatch(RecorderActions.unlockNativeMouseInteractionsRequested());
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.SET_LOCAL_VARIABLE));
        break;
      }
      case views.insertVariable: {
        dispatch(RecorderActions.unlockNativeMouseInteractionsRequested());
        dispatch(RecorderActions.modeSwitched(RECORDING_MODE.INSERT_LOCAL_VARIABLE));
        break;
      }
      default:
        break;
    }
  }, [location.pathname, dispatch]);

  const handleBackToMain = useCallback(() => history.push(views.variables), [history]);

  const handleGoToSetVariable = useCallback(() => {
    history.push(views.setVariable);
  }, [history]);

  const handleGoToInsertVariable = useCallback(() => {
    history.push(views.insertVariable);
  }, [history]);

  const renderMain = useCallback(
    () => (
      <>
        <OverlayStyled.Headline>
          <IconButton onClick={onBackClick}>
            <Icons.ArrowLeftIcon />
          </IconButton>
          {t('variablesMenu.title', 'Variables')}
        </OverlayStyled.Headline>
        <S.Content>
          <OverlayStyled.Buttons>
            <OverlayStyled.Button Icon={Icons.SaveIcon} onClick={handleGoToSetVariable}>
              {t('variablesMenu.main.setButton', 'Save variable for later')}
            </OverlayStyled.Button>
            <OverlayStyled.Button Icon={Icons.VariablesIcon} onClick={handleGoToInsertVariable}>
              {t('variablesMenu.main.insertButton', 'Insert variable')}
            </OverlayStyled.Button>
            <OverlayStyled.BackButton onClick={onBackClick}>
              {t('variablesMenu.back', 'Go back')}
            </OverlayStyled.BackButton>
          </OverlayStyled.Buttons>
        </S.Content>
      </>
    ),
    [t, onBackClick, handleGoToSetVariable, handleGoToInsertVariable],
  );

  const renderSetVariable = useCallback(
    () => <SetVariableView onBackClick={handleBackToMain} onFinish={onBackClick} />,
    [handleBackToMain, onBackClick],
  );

  const renderInsertVariable = useCallback(
    () => <InsertVariableMenu onBackClick={handleBackToMain} onFinish={onBackClick} />,
    [handleBackToMain, onBackClick],
  );

  return (
    <Switch>
      <Route exact path={views.variables} render={renderMain} />
      <Route path={views.setVariable} render={renderSetVariable} />
      <Route path={views.insertVariable} render={renderInsertVariable} />
    </Switch>
  );
};

export default VariablesMenu;
