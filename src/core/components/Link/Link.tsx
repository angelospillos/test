import { useCallback } from 'react';
import { Link as BaseLink } from 'react-router-dom';

import type React from 'react';

interface LinkProps {
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
  disabled?: boolean;
  download?: string | boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  openNewTab?: boolean;
  to?: string;
}

const Link = ({
  className,
  to = '/',
  children,
  onClick,
  'data-testid': dataTestId = 'Link',
  openNewTab,
  download,
  ...props
}: LinkProps) => {
  const isExternal = openNewTab || to.startsWith?.('http') || to.startsWith?.('mailto');

  const handleClick = useCallback(
    (event) => {
      event.stopPropagation();
      if (!isExternal) {
        event.preventDefault();
        event.persist();
      }

      onClick?.(event);
    },
    [onClick, isExternal],
  );

  if (isExternal || onClick) {
    return (
      <a
        data-testid={dataTestId}
        onClick={handleClick}
        className={className}
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        download={download}
      >
        {children}
      </a>
    );
  }

  return (
    <BaseLink data-testid={dataTestId} className={className} to={to} {...props}>
      {children}
    </BaseLink>
  );
};

export default Link;
