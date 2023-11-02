import debouce from 'lodash.debounce';
import { useCallback, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { SearchInputStyledProps } from './SearchInput.types';
import type { InputProps } from '../Input/Input';
import type { InputChangeHandler } from '../Input/Input.types';

import { noop } from '../../utils/toolbox';

import * as S from './SearchInput.styled';

interface SearchInputProps extends SearchInputStyledProps, InputProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: InputChangeHandler;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onChange = noop, fullWidth, placeholder, ...inputProps }, ref) => {
    const { t } = useTranslation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onChangeDebounced = useCallback(debouce(onChange, 250), [onChange]);

    const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
      (event) => {
        event.persist();
        onChangeDebounced(event);
      },
      [onChangeDebounced],
    );

    return (
      <S.Container role="search" fullWidth={fullWidth} className={className}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <S.TextInput
          fullWidth
          ref={ref}
          onChange={handleChange as InputChangeHandler}
          placeholder={placeholder || t('searchInput.defaultPlaceholder', 'Search...')}
          name="search"
          aria-label="search"
          {...inputProps}
        />
        <S.SearchIcon />
      </S.Container>
    );
  },
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
