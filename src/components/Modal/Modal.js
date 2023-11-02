import React, { useContext, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import ModalContext from './Modal.context';
import { Container, Backdrop, CloseButton, CloseIcon } from './Modal.styled';

const Modal = ({ className = null, children = null }) => {
  const { hide } = useContext(ModalContext);
  const { t } = useTranslation();

  useEffect(
    () => () => {
      hide();
    },
    [hide],
  );

  const handleClick = useCallback((event) => event.stopPropagation(), []);

  return (
    <Backdrop data-testid="Backdrop">
      <Container role="dialog" className={className} data-testid="Modal" onClick={handleClick}>
        <CloseButton
          aria-label={t('modal.closeButton', 'Close')}
          data-testid="Modal.CloseButton"
          onClick={hide}
        >
          <CloseIcon />
        </CloseButton>
        {children}
      </Container>
    </Backdrop>
  );
};

export default Modal;
