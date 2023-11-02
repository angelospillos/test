import { renderWhenTrue } from '../../utils/rendering';

import * as S from './EmptyState.styled';

interface EmptyStateProps {
  className?: string;
  text?: string;
  action?: {
    text: string;
    onClick: () => void;
  };
  isVisible?: boolean;
  small?: boolean;
  inline?: boolean;
  Icon?: React.FC;
}

const EmptyState = ({
  className,
  text,
  action,
  isVisible,
  inline = false,
  small = false,
  Icon = S.CoffeePixelIcon,
}: EmptyStateProps) => {
  const renderAction = renderWhenTrue(() => (
    <S.ActionButton data-testid="EmptyState.Action" onClick={action?.onClick}>
      {action?.text}
    </S.ActionButton>
  ));

  if (!isVisible) {
    return null;
  }

  return (
    <S.Container className={className} data-testid="EmptyState" inline={inline} small={small}>
      <S.IconWrapper small={small}>
        <Icon />
      </S.IconWrapper>
      <S.TextWrapper small={small}>
        <S.Text data-testid="EmptyState.Text">{text}</S.Text>
        {renderAction(!!action)}
      </S.TextWrapper>
    </S.Container>
  );
};

export default EmptyState;
