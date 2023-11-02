import debounce from 'lodash.debounce';
import { useCallback, useEffect } from 'react';

interface UseCustomMouseEventsOptions<T> {
  onMouseDown?: React.MouseEventHandler<T>;
  onMouseUp?: React.MouseEventHandler<T>;
  onClick?: React.MouseEventHandler<T>;
}

export function useCustomMouseEvents<T>(
  ref,
  { onMouseDown, onMouseUp, onClick }: UseCustomMouseEventsOptions<T>,
) {
  const handleMouseDown = useCallback(
    (event) => {
      // We have to handle button click in this way because of some websites
      // which force to set focus on own elements after each click eg. google on privacy modal.
      if (!ref.current?.disabled) {
        event.preventDefault();
        onMouseDown?.(event);
        onMouseUp?.(event);
        onClick?.(event);
      }
    },
    [ref, onMouseDown, onMouseUp, onClick],
  );

  useEffect(() => {
    // We have to handle button click in this way because of some websites
    // which block "click" event on document level.
    // document.addEventListener('click', listener, true) + e.stopPropagation
    const handleClick = debounce((event) => {
      const pathToElement = event.composedPath();
      if (pathToElement[0] === ref.current || pathToElement[1] === ref.current) {
        handleMouseDown(event);
      }
    }, 150);
    window.addEventListener('mousedown', handleClick, true);

    return () => {
      window.removeEventListener('mousedown', handleClick, true);
    };
  }, [ref, handleMouseDown]);

  return {
    onMouseDown: handleMouseDown,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onClick: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onMouseUp: () => {},
  };
}
