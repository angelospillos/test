import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

import { ReactComponent as Cursor } from '~/images/angelos-cursor.svg';
import {
  selectLastMousePosition,
  selectIsCursorVisible,
} from '~/modules/extension/extension.selectors';
import domLayer from '~/services/domLayer';

import { CursorContainer } from './CustomCursor.styled';

const CustomCursor = () => {
  const cursorRef = useRef();
  const mousePosition = useSelector(selectLastMousePosition);
  const isVisible = useSelector(selectIsCursorVisible);

  const handleMouseMove = useCallback((event) => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    }
  }, []);

  useEffect(() => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${mousePosition.x || 0}px, ${
        mousePosition.y || 0
      }px)`;
      cursorRef.current.style.display = isVisible ? 'block' : 'none';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mousePosition, isVisible]);

  useEffect(() => {
    const args = ['mousemove', handleMouseMove, { passive: true, capture: true }];
    domLayer.addEventListener(...args);

    return () => {
      domLayer.removeEventListener(...args);
    };
  }, [handleMouseMove]);

  return (
    <CursorContainer data-testid="angelos-cursor" ref={cursorRef}>
      <Cursor />
    </CursorContainer>
  );
};

export default CustomCursor;
