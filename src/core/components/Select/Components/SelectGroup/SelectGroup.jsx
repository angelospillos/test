import PropTypes from 'prop-types';
import React from 'react';

import { Container, Label } from './SelectGroup.styled';

const SelectGroup = ({ className, label, children }) => (
  <Container value={label} className={className} data-testid="SelectGroup">
    {label && <Label>{label}</Label>}
    {children}
  </Container>
);

SelectGroup.displayName = 'SelectGroup';

SelectGroup.defaultProps = {
  className: null,
  children: null,
  label: '',
};

SelectGroup.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  children: PropTypes.node,
};

export default SelectGroup;
