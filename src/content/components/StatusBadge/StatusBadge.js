import { renderWhenTrue } from '@angelos/core/utils/rendering';
import React from 'react';

import {
  STATUS_CONTINUE_ON_FAILURE,
  STATUS_ICON,
  STATUS_LABEL,
  STATUS_PASSED_WITH_WARNING,
} from './StatusBadge.constants';
import { Container, IconContainer, Label, Tooltip } from './StatusBadge.styled';

const StatusBadge = React.memo(
  ({ className, status, extended, warning, continueOnFailure, hiddenStatusLabel, errorCode }) => {
    const computedStatus = (() => {
      if (continueOnFailure) {
        return STATUS_CONTINUE_ON_FAILURE;
      }
      if (warning) {
        return STATUS_PASSED_WITH_WARNING;
      }
      return status;
    })();

    const label = STATUS_LABEL[computedStatus];
    const renderLabel = renderWhenTrue(() => <Label>{label}</Label>);

    const Icon = STATUS_ICON[computedStatus] || STATUS_ICON.DEFAULT;

    return (
      <Tooltip content={errorCode}>
        <Container data-testid="StatusBadge" className={className} status={computedStatus}>
          <IconContainer title={!errorCode ? computedStatus : null}>
            <Icon />
          </IconContainer>
          {renderLabel(extended && !hiddenStatusLabel && !!label)}
        </Container>
      </Tooltip>
    );
  },
);

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
