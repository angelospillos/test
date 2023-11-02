import { SettingsIcon, ExternalLinkIcon } from '@angelos/core/theme/icons';
import { THEME_MODE } from '@angelos/core/theme/modes';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeProvider } from 'styled-components';

import { ExtensionActions } from '~/modules/extension/extension.redux';
import { selectExtensionSettings } from '~/modules/extension/extension.selectors';
import { selectWebsocketIsConnected } from '~/modules/websocket/websocket.selectors';
import { GlobalStyle } from '~/theme/global';

import {
  PopupWrapper,
  Logo,
  Button,
  Header,
  Content,
  Footer,
  GotoButton,
  Details,
  Text,
} from './PopupApp.styled';

const PopupApp = () => {
  const { t } = useTranslation();
  const theme = useMemo(() => ({ mode: THEME_MODE.LIGHT }), []);
  const dispatch = useDispatch();
  const extensionSettings = useSelector(selectExtensionSettings);
  const isConnected = useSelector(selectWebsocketIsConnected);

  const handleOpenSettings = () => {
    dispatch(ExtensionActions.openSettingsRequested());
  };

  const handleGoTo = () => {
    window.open(process.env.WEBAPP_HOME_URL, '_blank');
  };
  return (
    <>
      <GlobalStyle />
      <ThemeProvider theme={theme}>
        <PopupWrapper>
          <Header>
            <Logo />
          </Header>
          <Content>
            <Details>
              <Text>
                {t('popup.details.version', 'Version: {{ version }}', {
                  version: process.env.VERSION,
                })}
              </Text>
              <Text>
                {t('popup.details.browser', 'Browser: {{ name }} {{ version }}', {
                  name: extensionSettings.browserName,
                  version: extensionSettings.browserVersion,
                })}
              </Text>
              <Text>
                {isConnected
                  ? t('popup.details.status.connected', 'Status: Connected')
                  : t('popup.details.status.dusconnected', 'Status: Disconnected')}
              </Text>
            </Details>
            <Button onClick={handleOpenSettings}>
              <SettingsIcon />
              {t('popup.settings', 'Extension settings')}
            </Button>
          </Content>
          <Footer>
            <GotoButton onClick={handleGoTo}>
              <ExternalLinkIcon />
              {t('popup.goTo', 'Go to angelos')}
            </GotoButton>
          </Footer>
        </PopupWrapper>
      </ThemeProvider>
    </>
  );
};

export default PopupApp;
