import { PLACEMENT_TYPES } from 'react-laag';

import type { DropdownVariant } from './Dropdown.types';
import type { Placement } from 'react-laag';

import { BUTTON_VARIANT } from '../Button';

export const DROPDOWN_CONTAINER_ID = 'dropdown';

export const DROPDOWN_VARIANT: Record<string, DropdownVariant> = {
  ...BUTTON_VARIANT,
  ICON: 'icon',
};

export const DROPDOWN_ANCHOR: Record<string, Placement> = {
  BOTTOM_START: PLACEMENT_TYPES[0],
  BOTTOM_END: PLACEMENT_TYPES[1],
  BOTTOM_CENTER: PLACEMENT_TYPES[2],
  TOP_START: PLACEMENT_TYPES[3],
  TOP_CENTER: PLACEMENT_TYPES[4],
  TOP_END: PLACEMENT_TYPES[5],
  LEFT_END: PLACEMENT_TYPES[6],
  LEFT_CENTER: PLACEMENT_TYPES[7],
  LEFT_START: PLACEMENT_TYPES[8],
  RIGHT_END: PLACEMENT_TYPES[9],
  RIGHT_CENTER: PLACEMENT_TYPES[10],
  RIGHT_START: PLACEMENT_TYPES[11],
  CENTER: PLACEMENT_TYPES[12],
};
