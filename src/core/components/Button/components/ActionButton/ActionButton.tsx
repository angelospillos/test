import { useState, useEffect, useRef, useMemo } from 'react';

import type { ButtonProps } from '../../Button';

import { noop } from '../../../../utils/toolbox';

import {
  Container,
  IconWrapper,
  LoaderWrapper,
  Loader,
  SuccessIcon,
  Content,
  Wrapper,
  SuccessBackground,
} from './ActionButton.styled';

interface ActionButtonProps extends ButtonProps {
  pending?: boolean;
  succeeded?: boolean | null;
}

const ActionButton = ({
  pending = false,
  succeeded = null,
  children,
  ...buttonProps
}: ActionButtonProps) => {
  const wasPending = useRef(false);
  const loaderVariant = buttonProps.bordered ? 'dark' : 'light';
  const [succeededDelayed, setSucceededDelayed] = useState(false);

  useEffect(() => {
    if (succeeded && wasPending.current) {
      setSucceededDelayed(true);
      const timeout = setTimeout(() => setSucceededDelayed(false), 2000);
      return () => clearTimeout(timeout);
    }

    if (pending) {
      setSucceededDelayed(false);
      wasPending.current = true;
    }

    return noop;
  }, [succeeded, pending]);

  const actionStateFlags = useMemo(
    () => ({ pending, success: succeededDelayed }),
    [pending, succeededDelayed],
  );

  return (
    <Container
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...buttonProps}
      {...actionStateFlags}
      noContentWrapper
      disabled={buttonProps.disabled || pending}
    >
      <SuccessBackground bordered={buttonProps.bordered} />
      <Wrapper>
        <LoaderWrapper {...actionStateFlags}>
          <Loader variant={loaderVariant} />
        </LoaderWrapper>
        <IconWrapper {...actionStateFlags}>
          <SuccessIcon />
        </IconWrapper>
        <Content {...actionStateFlags}>{children}</Content>
      </Wrapper>
    </Container>
  );
};

export default ActionButton;
