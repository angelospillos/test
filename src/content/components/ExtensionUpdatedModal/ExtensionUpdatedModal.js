import { RefreshIcon } from '@angelos/core/theme/icons';
import PropTypes from 'prop-types';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Header } from '~/components/Modal';

import { Container, Content } from './ExtensionUpdatedModal.styled';

const ExtensionUpdatedModal = ({ className }) => {
  const { t } = useTranslation();

  return (
    <Container className={className} data-testid="ExtensionUpdatedModal">
      <Content>
        <RefreshIcon />
        <div>
          <Header>{t('extensionUpdatedModal.title', 'Extension has been updated')}</Header>
          <p>
            {t(
              'extensionUpdatedModal.description1',
              'The angelos Chrome extension has been updated.',
            )}
          </p>
          <p>
            <Trans i18nKey="extensionUpdatedModal.description2">
              Please <b>close the window</b> since it is no longer connected to an application.
            </Trans>
          </p>
        </div>
      </Content>
    </Container>
  );
};

ExtensionUpdatedModal.defaultProps = {
  className: null,
};

ExtensionUpdatedModal.propTypes = {
  className: PropTypes.string,
};

export default ExtensionUpdatedModal;
