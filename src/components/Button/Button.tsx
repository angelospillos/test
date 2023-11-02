import ButtonBase from '@angelos/core/components/Button';
import { forwardRef, useRef, useImperativeHandle } from 'react';

import type { ButtonProps } from '@angelos/core/components/Button';
import { useCustomMouseEvents } from '~/hooks/useCustomMouseEvents';

const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement, []);

  const customMouseEventProps = useCustomMouseEvents(buttonRef, {
    onMouseDown: props.onMouseDown,
    onMouseUp: props.onMouseUp,
    onClick: props.onClick,
  });

  return <ButtonBase ref={buttonRef} {...props} {...customMouseEventProps} />;
});

Button.displayName = 'Button';

export default Button;
