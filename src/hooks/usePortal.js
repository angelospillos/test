import { KEY_CODES_BINDINGS } from '@angelos/core/constants/keyBindings';
import * as Sentry from '@sentry/browser';
import { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { getElement } from '~/utils/dom';

export const DEFAULT_CONTAINER_ID = 'portal';

const usePortal = (props = {}) => {
  const {
    containerId = DEFAULT_CONTAINER_ID,
    context,
    onShow = Function.prototype,
    onHide = Function.prototype,
    disableOnOutsideClick = false,
  } = props;
  const [isShow, setIsShow] = useState(false);

  const containerRef = useRef(
    getElement(
      `#${containerId}`,
      {
        width: '100%',
        height: '100%',
        position: 'absolute',
        zIndex: -1,
        top: 0,
        left: 0,
        opacity: 1,
      },
      false,
      context,
    ),
  );

  const show = useCallback(
    (event) => {
      if (containerRef.current) {
        containerRef.current.style.zIndex = 10;
        containerRef.current.style.opacity = 1;
        setIsShow(true);
        onShow(event);

        Sentry.addBreadcrumb({
          category: 'ui.additional',
          message: `Show ${containerRef.current.id}"`,
          level: 'info',
          type: 'user',
        });
      }
    },
    [onShow],
  );

  const hide = useCallback(
    (event) => {
      if (!isShow) return;
      containerRef.current.style.zIndex = -1;
      containerRef.current.style.opacity = 0;
      setIsShow(false);
      onHide(event);
    },
    [isShow, onHide],
  );

  const toggle = useCallback(
    (event) => {
      if (isShow) {
        hide(event);
      } else {
        show(event);
      }
    },
    [isShow, hide, show],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.keyCode === KEY_CODES_BINDINGS.ESC) {
        hide(event);
      }
    },
    [hide],
  );

  useEffect(() => {
    const container = containerRef.current;
    const handlePortalClick = (e) => {
      if (e.target === container) {
        hide(e);
      }
    };

    if (isShow) {
      if (!disableOnOutsideClick) {
        container.addEventListener('click', handlePortalClick);
      }
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (isShow) {
        if (!disableOnOutsideClick) {
          container.removeEventListener('click', handlePortalClick);
        }
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [containerId, hide, isShow, handleKeyDown, disableOnOutsideClick]);

  const Portal = useCallback(
    ({ children }) => isShow && ReactDOM.createPortal(children, containerRef.current),
    [isShow],
  );

  return { Portal, isShow, show, hide, toggle };
};

export default usePortal;
