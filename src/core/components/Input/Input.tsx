/* eslint-disable react/jsx-props-no-spreading */
import { is } from 'ramda';
import { memo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

import type { InputChangeHandler, InputStyledProps } from './Input.types';
import type React from 'react';

import { KEY_CODES_BINDINGS, NUMBERS_KEY_CODES } from '../../constants/keyBindings';

import {
  Container,
  InputBase,
  ErrorMessage,
  StartAdornment,
  EndAdornment,
  InputWrapper,
} from './Input.styled';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, InputStyledProps {
  className?: string;
  min?: string;
  autoComplete?: 'email' | 'current-password' | 'off';
  startAdornment?: string | React.ReactNode;
  endAdornment?: string | React.ReactNode;
  fullWidth?: boolean;
  autoFocus?: boolean;
  error?: boolean | string | string[];
  clearOnFocus?: boolean;
  onChange?: InputChangeHandler;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
}

const Input = memo(
  forwardRef<HTMLInputElement | null, InputProps>((props, ref) => {
    const {
      className,
      autoFocus,
      value,
      error = '',
      readOnly,
      disabled,
      startAdornment,
      endAdornment,
      fullWidth,
      clearOnFocus,
      autoComplete = 'off',
      ...inputProps
    } = props;
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.value = value?.toString() || '';
      }
    }, [value]);

    useEffect(() => {
      if (inputRef.current && autoFocus) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [autoFocus]);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    const handleClick = useCallback((event) => event.stopPropagation(), []);
    const handleKeyDown = useCallback(
      (e) => {
        if (inputProps.type === 'number' && inputProps.min && parseInt(inputProps.min, 10) >= 0) {
          if (
            ![...NUMBERS_KEY_CODES, KEY_CODES_BINDINGS.BACKSPACE].includes(e.keyCode) &&
            !(e.metaKey || e.ctrlKey)
          ) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      },
      [inputProps.min, inputProps.type],
    );
    const invalid = !!error && !readOnly;

    const handleFocus = useCallback<React.FocusEventHandler<HTMLInputElement>>(
      (event) => {
        if (clearOnFocus) {
          // eslint-disable-next-line no-param-reassign
          event.target.value = '';
          inputProps.onChange?.({ target: event.target });
        }
        inputProps.onFocus?.(event);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [clearOnFocus, inputProps.onChange, inputProps.onFocus],
    );

    return (
      <Container>
        <InputWrapper
          className={className}
          disabled={disabled}
          readOnly={readOnly}
          invalid={invalid}
          fullWidth={fullWidth}
          aria-invalid={invalid}
          aria-required={!!inputProps.required}
        >
          {startAdornment && <StartAdornment>{startAdornment}</StartAdornment>}
          <InputBase
            {...inputProps}
            autoComplete={autoComplete}
            onFocus={handleFocus}
            disabled={disabled}
            ref={inputRef}
            onClick={handleClick}
            data-testid={inputProps['data-testid'] || 'Input'}
            readOnly={readOnly}
            onKeyDown={handleKeyDown}
            aria-invalid={invalid}
            aria-required={!!inputProps.required}
          />
          {endAdornment && <EndAdornment>{endAdornment}</EndAdornment>}
        </InputWrapper>
        {is(String, error) && !readOnly && <ErrorMessage>{error}</ErrorMessage>}
        {is(Array, error) &&
          !readOnly &&
          error.map((row) => <ErrorMessage key={row}>{row}</ErrorMessage>)}
      </Container>
    );
  }),
);

Input.displayName = 'Input';

export default Input;
