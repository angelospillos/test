import PropTypes from 'prop-types';
import { equals, cond } from 'ramda';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { useModal } from '~/components/Modal';
import { MODAL_TYPE } from '~/constants/modal';
import useContentScriptConnected from '~/hooks/useContentScriptConnected';
import { selectUIStateForComponent } from '~/modules/uistate/uistate.selectors';

import ExtensionConnectionModal from '../ExtensionConnectionModal';
import ExtensionUpdatedModal from '../ExtensionUpdatedModal';
import MissingTestRunModal from '../MissingTestRunModal';
import RuntimeErrorModal from '../RuntimeErrorModal';

const Modals = ({ container }) => {
  const { currentModal } = useSelector(selectUIStateForComponent('Modals'));
  const isContentScriptConnected = useContentScriptConnected();

  const { Modal, ...modalProps } = useModal({
    context: container,
  });

  useEffect(() => {
    if (currentModal || !isContentScriptConnected) {
      modalProps.show();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModal, isContentScriptConnected]);

  const renderExtensionConnectionModal = () => <ExtensionConnectionModal />;
  const renderRuntimeErrorModal = () => <RuntimeErrorModal />;
  const renderExtensionUpdatedModal = () => <ExtensionUpdatedModal />;
  const renderMissingTestRunModal = () => <MissingTestRunModal />;

  const currentModalType = isContentScriptConnected
    ? currentModal
    : MODAL_TYPE.EXTENSION_UPDATE_ERROR;

  const renderModalContent = cond([
    [equals(MODAL_TYPE.CONNECTION_ERROR), renderExtensionConnectionModal],
    [equals(MODAL_TYPE.EXTENSION_UPDATE_ERROR), renderExtensionUpdatedModal],
    [equals(MODAL_TYPE.RUNTIME_ERROR), renderRuntimeErrorModal],
    [equals(MODAL_TYPE.TEST_RUN_DOES_NOT_EXIST), renderMissingTestRunModal],
  ]);

  return <Modal>{renderModalContent(currentModalType)}</Modal>;
};

Modals.defaultProps = {
  container: undefined,
};

Modals.propTypes = {
  container: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.node,
    PropTypes.func,
    PropTypes.object,
  ]),
};

export default Modals;
