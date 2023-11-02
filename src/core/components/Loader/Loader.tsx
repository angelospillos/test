import type { LoaderStyledProps } from './Loader.types';
import type React from 'react';

import { LoaderBase } from './Loader.styled';

export interface LoaderProps extends Partial<LoaderStyledProps> {
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({
  className,
  size = 'regular',
  variant = 'dark',
  stopped = false,
}) => (
  <LoaderBase
    variant={variant}
    size={size}
    className={className}
    data-testid="Loader"
    stopped={stopped}
  />
);

export default Loader;
