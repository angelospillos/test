import Tooltip from '@angelos/core/components/Tooltip';
import { renderWhenTrue } from '@angelos/core/utils/rendering';

import { Container, Label, Description, HelperIcon, LabelWithHelper } from './FormField.styled';

const FormField = ({ className, children, label, description, helperText, labelId, disabled }) => {
  const renderLabel = renderWhenTrue(() => <Label id={labelId}>{label}</Label>);

  const renderLabelWithHelper = renderWhenTrue(() => (
    <Tooltip content={disabled ? '' : helperText}>
      <LabelWithHelper>
        {renderLabel(true)}
        <HelperIcon />
      </LabelWithHelper>
    </Tooltip>
  ));

  const renderDescription = renderWhenTrue(() => <Description>{description}</Description>);

  return (
    <Container className={className} data-testid="FormField" data-disabled={disabled}>
      {renderLabel(!!label && !helperText)}
      {renderLabelWithHelper(!!label && !!helperText)}
      {renderDescription(!!description)}
      {children}
    </Container>
  );
};

FormField.defaultProps = {
  className: null,
  label: '',
  labelId: null,
  description: '',
  helperText: '',
};

export default FormField;
