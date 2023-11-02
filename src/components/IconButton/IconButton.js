import Loader from '@angelos/core/components/Loader';
import Tooltip from '@angelos/core/components/Tooltip';
import { renderWhenTrue } from '@angelos/core/utils/rendering';
import PropTypes from 'prop-types';
import React, { useImperativeHandle, useRef, forwardRef } from 'react';

import { useCustomMouseEvents } from '~/hooks/useCustomMouseEvents';

import { Container } from './IconButton.styled';

const IconButton = forwardRef((props, ref) => {
  const { children, pending, 'data-testid': dataTestId, tooltip, ...buttonProps } = props;
  const buttonRef = useRef();

  useImperativeHandle(ref, () => buttonRef.current, []);

  const customMouseEventProps = useCustomMouseEvents(buttonRef, buttonProps);

  const renderLoader = renderWhenTrue(() => <Loader />);

  const renderButton = () => (
    <Container
      ref={buttonRef}
      data-testid={dataTestId}
      pending={pending}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...buttonProps}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...customMouseEventProps}
    >
      {renderLoader(pending)}
      {children}
    </Container>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{renderButton()}</Tooltip>;
  }

  return renderButton();
});

IconButton.displayName = 'IconButton';

IconButton.defaultProps = {
  className: null,
  disabled: false,
  pending: false,
  onClick: null,
  tooltip: '',
  type: 'button',
  'data-testid': 'IconButton',
};

IconButton.propTypes = {
  className: PropTypes.string,
  tooltip: PropTypes.string,
  type: PropTypes.string,
  disabled: PropTypes.bool,
  pending: PropTypes.bool,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  'data-testid': PropTypes.string,
};

export default IconButton;
