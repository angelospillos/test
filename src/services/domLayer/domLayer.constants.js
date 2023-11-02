export const SCROLL_INTO_VIEW_VARIANT_TYPE = {
    NEAREST: 'NEAREST',
    CENTER: 'CENTER',
    TOP_CENTER: 'TOP_CENTER',
    BOTTOM_CENTER: 'BOTTOM_CENTER',
    CENTER_LEFT: 'CENTER_LEFT',
    CENTER_RIGHT: 'CENTER_RIGHT',
    NOT_SMOOTH: 'NOT_SMOOTH',
  };
  
  export const SCROLL_INTO_VIEW_VARIANT = {
    [SCROLL_INTO_VIEW_VARIANT_TYPE.NEAREST]: {
      block: 'nearest',
      inline: 'nearest',
    },
    [SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER]: {
      block: 'center',
      inline: 'center',
    },
    [SCROLL_INTO_VIEW_VARIANT_TYPE.TOP_CENTER]: {
      block: 'start',
      inline: 'center',
    },
    [SCROLL_INTO_VIEW_VARIANT_TYPE.BOTTOM_CENTER]: {
      block: 'end',
      inline: 'center',
    },
    [SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER_LEFT]: {
      block: 'center',
      inline: 'start',
    },
    [SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER_RIGHT]: {
      block: 'center',
      inline: 'end',
    },
    [SCROLL_INTO_VIEW_VARIANT_TYPE.NOT_SMOOTH]: {
      behavior: 'auto',
    },
  };
  
  export const SCROLL_INTO_VIEW_MOVEMENT = {
    [SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER]: SCROLL_INTO_VIEW_VARIANT_TYPE.TOP_CENTER,
    [SCROLL_INTO_VIEW_VARIANT_TYPE.TOP_CENTER]: SCROLL_INTO_VIEW_VARIANT_TYPE.BOTTOM_CENTER,
    [SCROLL_INTO_VIEW_VARIANT_TYPE.BOTTOM_CENTER]: SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER_LEFT,
    [SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER_LEFT]: SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER_RIGHT,
    [SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER_RIGHT]: SCROLL_INTO_VIEW_VARIANT_TYPE.NOT_SMOOTH,
    [SCROLL_INTO_VIEW_VARIANT_TYPE.NOT_SMOOTH]: null,
  };
  
  export const SCROLL_INTO_VIEW_DEFAULT_TYPE = SCROLL_INTO_VIEW_VARIANT_TYPE.CENTER;
  
  export const SCROLL_END_DEBOUNCE_TIME = 250;
  
  export const DOCUMENT_READY_CHECK_INTERVAL = 250;
  
  export const EVENTS_LISTENERS_DATA_TTL = 500;
  
  export const DEFAULT_SCROLL_OPTIONS = { passive: true, capture: true };
  
  export const REQUESTED_ELEMENT_DATA_DEFAULT = { isCovered: false, isInViewport: false };
  
  export const DEFAULT_CSS_ZOOM = '1';
  
  export const EMPTY_RECT = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    centroid: [0, 0],
    zoom: parseFloat(DEFAULT_CSS_ZOOM),
  };
  