import { ErrorTriangleIcon } from '@angelos/core/theme/icons';
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Header } from '~/components/Modal';

import { Container, Content } from './MissingTestRunModal.styled';

const MissingTestRunModal = ({ className }) => {
  const { t } = useTranslation();

  return (
    <Container className={className} data-testid="MissingTestRunModal">
      <Content>
        <ErrorTriangleIcon />
        <div>
          <Header>{t('missingTestRunModal.title', 'Action aborted')}</Header>
          <p>
            {t(
              'missingTestRunModal.description',
              'The action cannot be performed because your session data has been lost. The test run was probably removed during the session.',
            )}
          </p>
        </div>
      </Content>
    </Container>
  );
};

MissingTestRunModal.defaultProps = {
  className: null,
};

MissingTestRunModal.propTypes = {
  className: PropTypes.string,
};

export default MissingTestRunModal;
