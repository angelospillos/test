import { ErrorTriangleIcon } from '@angelos/core/theme/icons';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import Button, { BUTTON_VARIANT } from '~/components/Button';
import { Header, Footer, ModalContext } from '~/components/Modal';
import useCloseWindowsDispatch from '~/hooks/useCloseWindowsDispatch';

import { Container, Content } from './RuntimeErrorModal.styled';

const RuntimeErrorModal = ({ className = null }) => {
  const { t } = useTranslation();
  const { hide } = useContext(ModalContext);
  const handleCloseWindows = useCloseWindowsDispatch();

  return (
    <Container className={className} data-testid="RuntimeErrorModal">
      <Content>
        <ErrorTriangleIcon />
        <div>
          <Header>{t('runtimeErrorModal.title', 'An error occured')}</Header>
          <p>
            {t(
              'runtimeErrorModal.description',
              'An unexpected, critical error has occured. Information has been sent to administrators.',
            )}
          </p>
        </div>
      </Content>
      <Footer>
        <Button onClick={hide}>{t('runtimeErrorModal.cancel', 'Continue anyway')}</Button>
        <Button onClick={handleCloseWindows} variant={BUTTON_VARIANT.PRIMARY}>
          {t('runtimeErrorModal.confirmButton', 'Close window')}
        </Button>
      </Footer>
    </Container>
  );
};

export default RuntimeErrorModal;
