import PropTypes from 'prop-types';
import React from 'react';

class ErrorBoundary extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    const { onError } = this.props;
    onError(error);
  }

  render() {
    const { children } = this.props;
    const { hasError } = this.state;
    if (hasError) {
      return null;
    }

    return children;
  }
}

ErrorBoundary.defaultProps = {
  onError: Function.prototype,
};

ErrorBoundary.propTypes = {
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.element]).isRequired,
  onError: PropTypes.func,
};

export default ErrorBoundary;
