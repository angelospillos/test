import PropTypes from 'prop-types';
import React, { forwardRef, useCallback } from 'react';

import { renderWhenTrue } from '../../utils/rendering';

import { Container, Input, Checkmark, Label } from './RadioButton.styled';

const RadioButton = forwardRef((props, ref) => {
  const { className, checked, children, onChange, disabled, name, value } = props;
  const handleChange = useCallback(onChange, [onChange]);
  const renderLabel = renderWhenTrue(() => <Label>{children}</Label>);

  return (
    <Container className={className} data-testid="RadioButton">
      <Input
        name={name}
        onChange={handleChange}
        ref={ref}
        checked={!!checked}
        disabled={disabled}
        value={value}
      />
      <Checkmark />
      {renderLabel(!!children)}
    </Container>
  );
});

RadioButton.displayName = 'RadioButton';

RadioButton.defaultProps = {
  className: null,
  checked: false,
  disabled: false,
  children: null,
  onChange: Function.prototype,
  name: null,
  value: false,
};

RadioButton.propTypes = {
  className: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  children: PropTypes.node,
  onChange: PropTypes.func,
};

export default RadioButton;
