import PropTypes from 'prop-types';
import React, { useLayoutEffect, useCallback, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { REFRESH_TIME } from './Countdown.constants';
import { Container } from './Countdown.styled';

const Countdown = memo(({ className, value, running, inversed }) => {
  const containerRef = useRef();
  const time = useRef(value);
  const { t } = useTranslation();

  const refreshTime = useCallback(() => {
    containerRef.current.textContent = Math.max(0, time.current);
  }, []);

  useLayoutEffect(() => {
    time.current = value;
    refreshTime();
  }, [value, refreshTime]);

  useLayoutEffect(() => {
    let timer;

    if (running) {
      timer = setInterval(() => {
        if (inversed) {
          time.current -= 1;
        } else {
          time.current += 1;
        }
        refreshTime();
      }, REFRESH_TIME);
    }

    return () => {
      clearInterval(timer);
    };
  }, [t, running, value, refreshTime, inversed]);

  return <Container ref={containerRef} role="timer" className={className} />;
});

Countdown.displayName = 'Countdown';

Countdown.defaultProps = {
  className: null,
  value: null,
  running: false,
  inversed: false,
};

Countdown.propTypes = {
  className: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  running: PropTypes.bool,
  inversed: PropTypes.bool,
};

export default Countdown;
