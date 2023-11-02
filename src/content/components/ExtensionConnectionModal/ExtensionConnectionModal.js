import UnorganizedList from '@angelos/core/components/UnorganizedList';
import { ErrorTriangleIcon } from '@angelos/core/theme/icons';
import PropTypes from 'prop-types';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import Button, { BUTTON_VARIANT } from '~/components/Button';
import { Header, Footer, ModalContext } from '~/components/Modal';
import useCloseWindowsDispatch from '~/hooks/useCloseWindowsDispatch';

import { Container, Content } from './ExtensionConnectionModal.styled';

const ExtensionConnectionModal = ({ className }) => {
  const { t } = useTranslation();
  const { hide } = useContext(ModalContext);
  const handleCloseWindows = useCloseWindowsDispatch();

  return (
    <Container className={className} data-testid="ExtensionConnectionModal">
      <Content>
        <ErrorTriangleIcon />
        <div>
          <Header>{t('extensionConnectionModal.title', 'Connection error')}</Header>
          <p>
            {t('extensionConnectionModal.description', 'Connection to angelos.io servers is lost.')}
          </p>
          <UnorganizedList>
            <li>
              {t(
                'extensionConnectionModal.option1',
                'Check the stability of your internet connection',
              )}
            </li>
            <li>
              {t(
                'extensionConnectionModal.option2',
                "Check what you've just done and make sure it's correct",
              )}
            </li>
            <li>{t('extensionConnectionModal.option3', 'Close this session and start again')}</li>
          </UnorganizedList>
        </div>
      </Content>
      <Footer>
        <Button onClick={hide}>{t('extensionConnectionModal.cancel', 'Continue anyway')}</Button>
        <Button onClick={handleCloseWindows} variant={BUTTON_VARIANT.PRIMARY}>
          {t('extensionConnectionModal.confirmButton', 'Close window')}
        </Button>
      </Footer>
    </Container>
  );
};

ExtensionConnectionModal.defaultProps = {
  className: null,
};

ExtensionConnectionModal.propTypes = {
  className: PropTypes.string,
};

export default ExtensionConnectionModal;
