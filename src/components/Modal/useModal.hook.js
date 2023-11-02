import { useCallback } from 'react';

import usePortal from '~/hooks/usePortal';

import ModalBase from './Modal';
import ModalContext from './Modal.context';
import { Header, Content, Footer } from './Modal.styled';

const useModal = (props) => {
  const { Portal, ...rest } = usePortal({
    containerId: 'modal',
    disableOnOutsideClick: true,
    ...props,
  });

  const Modal = useCallback(
    (modalProps) => (
      <Portal>
        <ModalContext.Provider value={rest}>
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <ModalBase {...modalProps} />
        </ModalContext.Provider>
      </Portal>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rest.isShow],
  );

  return {
    ...rest,
    Modal,
    ModalHeader: Header,
    ModalContent: Content,
    ModalFooter: Footer,
  };
};

export default useModal;
