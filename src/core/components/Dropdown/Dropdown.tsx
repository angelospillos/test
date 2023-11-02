import { useCallback, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { useLayer } from 'react-laag';
import { useUpdateEffect } from 'react-use';

import type { DropdownProps, DropdownRef } from './Dropdown.types';
import type { SideEffect } from '../../types/base';
import type React from 'react';

import { renderWhenTrue } from '../../utils/rendering';
import { noop } from '../../utils/toolbox';
import IconButton from '../IconButton';

import { DROPDOWN_CONTAINER_ID } from './Dropdown.constants';
import * as S from './Dropdown.styled';

const Dropdown = forwardRef<DropdownRef, DropdownProps>((props, ref) => {
  const {
    'aria-labelledby': ariaLabelledBy,
    'data-testid': dataTestId = 'Dropdown',
    anchor = 'bottom-end',
    children,
    className,
    condensed = false,
    container,
    disabled = false,
    error = false,
    fullWidth = false,
    hideExpander = false,
    label = '',
    onClose = noop,
    onOpen = noop,
    open = false,
    rounded = false,
    variant = 'default',
    Icon,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setOpen] = useState<boolean>(open);
  const { layerProps, triggerProps, renderLayer, triggerBounds } = useLayer({
    auto: true,
    container,
    isOpen,
    placement: anchor,
    possiblePlacements: [
      'bottom-end',
      'bottom-center',
      'top-end',
      'top-center',
      'left-center',
      'right-center',
    ],
  });

  useUpdateEffect(() => {
    if (isOpen) {
      onOpen();
    } else {
      onClose();
    }
  }, [isOpen]);

  const handleOpen = useCallback<SideEffect>(() => setOpen(true), []);

  useImperativeHandle(
    ref,
    () => ({
      open: handleOpen,
      container: containerRef?.current,
    }),
    [handleOpen],
  );

  const handleToggleButtonClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (event) => {
      event.stopPropagation();
      event.preventDefault();
      handleOpen();
    },
    [handleOpen],
  );

  const renderItems = (): React.ReactNode => {
    if (!isOpen) {
      return null;
    }

    const close: React.MouseEventHandler<HTMLDivElement> = (event) => {
      event.stopPropagation();
      setOpen(false);
    };
    const style = { ...layerProps.style };

    if (fullWidth) {
      style.width = triggerBounds?.width;
    }

    return renderLayer(
      <S.Backdrop data-testid={`${dataTestId}.Backdrop`} onClick={close} id={DROPDOWN_CONTAINER_ID}>
        <S.ItemsContainer data-testid={`${dataTestId}.Items`} {...layerProps} style={style}>
          {children}
        </S.ItemsContainer>
      </S.Backdrop>,
    );
  };

  const renderIconButton = renderWhenTrue(() => (
    // @ts-expect-error IconButton does not accept children; fix by migration to TS
    <IconButton
      {...triggerProps}
      data-testid={`${dataTestId}.IconButton`}
      onClick={handleToggleButtonClick}
      disabled={disabled}
      condensed={condensed}
    >
      {/* @ts-expect-error Icon is enforced but the rendercondition, but it's not visible for the TS */}
      <Icon />
    </IconButton>
  ));

  const renderToggleButton = renderWhenTrue(() => (
    <S.ToggleButton
      {...triggerProps}
      data-testid={`${dataTestId}.Button`}
      onClick={handleToggleButtonClick}
      variant={variant !== 'icon' ? variant : undefined}
      Icon={Icon}
      bordered
      withExpander={!hideExpander}
      rounded={rounded}
      condensed={condensed}
      disabled={disabled}
      error={error}
      aria-disabled={disabled}
      aria-invalid={!!error}
      aria-expanded={isOpen}
      aria-labelledby={ariaLabelledBy}
    >
      {label && <S.ToggleButtonLabel>{label}</S.ToggleButtonLabel>}
      {!hideExpander && <S.ExpandIcon variant={variant} />}
    </S.ToggleButton>
  ));

  return (
    <S.Container ref={containerRef} className={className} role="menu" data-testid={dataTestId}>
      {renderIconButton(props.variant === 'icon')}
      {renderToggleButton(props.variant !== 'icon')}
      {renderItems()}
    </S.Container>
  );
});

Dropdown.displayName = 'Dropdown';

export default Dropdown;
