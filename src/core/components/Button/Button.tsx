import { memo, forwardRef, Fragment } from 'react';

import type { ButtonStyledProps } from './Button.types';
import type { IconName } from '../../types/icons';
import type React from 'react';

import Icon from '../Icon';
import { PointerEventsCatcher } from '../Tooltip';

import * as S from './Button.styled';

export interface ButtonProps
  extends React.HTMLAttributes<HTMLButtonElement>,
    Omit<ButtonStyledProps, 'withIcon'> {
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  'data-testid'?: string;
  Icon?: React.FC;
  iconName?: IconName;
  children?: React.ReactNode;
  wrappedByTooltip?: boolean;
  disabled?: boolean;
  noContentWrapper?: boolean;
}

const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
    const {
      variant = 'default',
      children,
      'data-testid': dataTestId = 'Button',
      // this is deprecated; please, use iconName instead
      Icon: DeprecatedIcon,
      iconName,
      bordered,
      noContentWrapper,
      wrappedByTooltip,
      iconPosition = 'left',
      type = 'button',
      ...buttonProps
    } = props;

    const renderIcon = () =>
      (DeprecatedIcon || iconName) && (
        <S.IconContainer iconPosition={iconPosition}>
          {DeprecatedIcon && <DeprecatedIcon />}
          {iconName && <Icon name={iconName} />}
        </S.IconContainer>
      );

    const ButtonComponent = bordered ? S.BorderedButtonContainer : S.ButtonContainer;
    const ContentWrapper = noContentWrapper ? Fragment : S.Content;
    const Wrapper = wrappedByTooltip && buttonProps.disabled ? PointerEventsCatcher : Fragment;
    const isLeftIcon = iconPosition === 'left';

    return (
      <Wrapper>
        <ButtonComponent
          ref={ref}
          data-testid={dataTestId}
          variant={variant}
          bordered={bordered}
          withIcon={!!Icon}
          type={type}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...buttonProps}
        >
          {isLeftIcon && renderIcon()}
          <ContentWrapper>{children}</ContentWrapper>
          {!isLeftIcon && renderIcon()}
        </ButtonComponent>
      </Wrapper>
    );
  }),
);

Button.displayName = 'Button';

export default Button;
