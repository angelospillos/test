import { STATUS, RUN_STATUS_COLOR } from '@angelos/core/constants';
import { COLOR } from '@angelos/core/theme/colors';
import * as Icons from '@angelos/core/theme/icons';

import { RUN_STATUS_LABEL } from '~/constants/test';
import i18n from '~/translations';

export const STATUS_PASSED_WITH_WARNING = 'passed-warning';

export const STATUS_CONTINUE_ON_FAILURE = 'continue-on-failure';

export const STATUS_COLOR = {
  ...RUN_STATUS_COLOR,
  [STATUS_PASSED_WITH_WARNING]: RUN_STATUS_COLOR[STATUS.PASSED],
  [STATUS_CONTINUE_ON_FAILURE]: COLOR.ORANGE,
};

export const STATUS_ICON = {
  [STATUS.PASSED]: Icons.SmallDotIcon,
  [STATUS.FAILED]: Icons.ThumbDownIcon,
  [STATUS.STOPPED]: Icons.StopIcon,
  [STATUS.RUNNING]: Icons.SmallDotIcon,
  [STATUS.ERROR]: Icons.ErrorIcon,
  [STATUS.INITIALIZED]: Icons.CircleIcon,
  [STATUS_PASSED_WITH_WARNING]: Icons.CircleIcon,
  [STATUS_CONTINUE_ON_FAILURE]: Icons.CircleIcon,
  DEFAULT: Icons.SmallDotIcon,
};

export const STATUS_LABEL = {
  ...RUN_STATUS_LABEL,
  [STATUS.RUNNING]: i18n.t('statusBadge.running.label', 'Running...'),
  [STATUS.QUEUED]: i18n.t('statusBadge.queued.label', 'Queued...'),
  [STATUS_PASSED_WITH_WARNING]: i18n.t('statusBadge.softPassed.label', 'Passed with some issues'),
  [STATUS_CONTINUE_ON_FAILURE]: i18n.t(
    'statusBadge.failedButIgnored.label',
    'Step failed but the issue was ignored',
  ),
};
