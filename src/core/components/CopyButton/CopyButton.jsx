import copy from 'copy-to-clipboard';
import PropTypes from 'prop-types';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { CopyIcon, CheckIcon } from '../../theme/icons';

import { Button, IconButton } from './CopyButton.styled';

const CopyButton = ({ className, value, small }) => {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const messageTimeout = useRef();

  const handleClick = useCallback(() => {
    copy(value);
    setIsCopied(true);

    messageTimeout.current = setTimeout(() => setIsCopied(false), 2000);
  }, [value]);

  useEffect(
    () => () => {
      clearTimeout(messageTimeout.current);
    },
    [],
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  if (small) {
    return (
      <IconButton
        className={className}
        data-testid="CopyButton"
        onClick={handleClick}
        disabled={isCopied}
      >
        <Icon />
      </IconButton>
    );
  }

  const label = isCopied
    ? t('copyButton.message', 'Copied!')
    : t('copyButton.label', 'Copy to clipboard');

  return (
    <Button
      className={className}
      data-testid="CopyButton"
      Icon={isCopied ? CheckIcon : CopyIcon}
      onClick={handleClick}
      disabled={isCopied}
    >
      {label}
    </Button>
  );
};

CopyButton.defaultProps = {
  className: null,
  small: false,
  value: null,
};

CopyButton.propTypes = {
  className: PropTypes.string,
  small: PropTypes.bool,
  value: PropTypes.string,
};

export default CopyButton;
