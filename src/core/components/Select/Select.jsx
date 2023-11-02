import PropTypes from 'prop-types';
import { cond, equals, is, path, T } from 'ramda';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent, useUnmount } from 'react-use';

import { KEY_CODES_BINDINGS } from '../../constants/keyBindings';
import { ErrorMessage } from '../../theme/typography';
import { renderWhenTrue } from '../../utils/rendering';
import EmptyState from '../EmptyState';

import SelectOption from './components/SelectOption';
import { SELECT_ALL_OPTION_VALUE, SELECT_ANCHOR, SELECT_VARIANT } from './Select.constants';
import {
  addOrRemoveMultipleOptions,
  callForChildren,
  extractSelectOptions,
} from './Select.helpers';
import * as S from './Select.styled';

const Select = (props) => {
  const {
    className,
    selectAllOptionVisible,
    variant,
    'data-testid': dataTestId,
    children,
    Icon,
    label,
    placeholder,
    onChange,
    name,
    value: defaultValue,
    groupAsValue,
    rounded,
    fullWidth,
    disabled,
    error,
    showSearch,
    anchor,
    multiple,
    maxChips,
    renderSelectedOption,
    'aria-labelledby': ariaLabelledBy,
    selectAllOptionLabel,
  } = props;
  const { t } = useTranslation();
  const searchInputRef = useRef();
  const optionsContainerRef = useRef();
  const [searchQuery, setSearchQuery] = useState('');
  const query = useRef('');
  const queryTimeout = useRef();
  const queryElement = useRef();

  const [groupName, setGroupName] = useState();

  const availableSelectOptions = useMemo(() => extractSelectOptions(children), [children]);

  const [selectedOptions, setSelectedOptions] = useState([]);

  useEffect(() => {
    if (multiple) {
      setSelectedOptions(
        defaultValue?.includes?.(SELECT_ALL_OPTION_VALUE)
          ? [
              {
                value: SELECT_ALL_OPTION_VALUE,
                label: selectAllOptionLabel || t('select.selectAll.label', 'All'),
              },
            ]
          : availableSelectOptions.filter((row) => defaultValue?.includes?.(row.value)),
      );
    } else {
      const selectedValue = availableSelectOptions.filter(
        (row) => String(defaultValue) === String(row.value),
      );
      setSelectedOptions(
        selectedValue.length
          ? selectedValue
          : [
              {
                value: defaultValue,
                label: placeholder,
              },
            ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    availableSelectOptions,
    defaultValue,
    multiple,
    setSelectedOptions,
    placeholder,
    selectAllOptionLabel,
  ]);

  const handleOptionClick = useCallback(
    (event) => {
      setGroupName(event.currentTarget.parentNode.getAttribute('value'));
      const value = event.currentTarget.getAttribute('value');
      const optionLabel = event.currentTarget.textContent;

      let newSelectedOption = [];

      if (multiple) {
        event.stopPropagation();
        newSelectedOption = addOrRemoveMultipleOptions(
          selectedOptions,
          { value, label: optionLabel },
          availableSelectOptions,
          selectAllOptionLabel || t('select.selectAll.label', 'All'),
        );
      } else {
        newSelectedOption = [{ value, label: optionLabel }];
      }

      setSelectedOptions(newSelectedOption);
      onChange({
        target: { value: multiple ? newSelectedOption.map((row) => row.value) : value, name },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, name, multiple, selectedOptions, availableSelectOptions],
  );

  const prepareChild = useCallback(
    (child) => {
      const equalsQuery = (text) => (text || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (
        searchQuery.length > 0 &&
        !equalsQuery(child.props.children) &&
        !equalsQuery(child.props.value)
      ) {
        return null;
      }

      if (child.type === 'option' || child.type.displayName === SelectOption.displayName) {
        return React.cloneElement(child, {
          onClick: handleOptionClick,
          active: selectedOptions.some(
            ({ value }) => value === `${child.props.value}` || value === SELECT_ALL_OPTION_VALUE,
          ),
        });
      }
      return child;
    },
    [handleOptionClick, searchQuery, selectedOptions],
  );

  const checkAndSetDefaultValue = useCallback(
    (child, parent) => {
      const hasProperType =
        child.type === 'option' || child.type.displayName === SelectOption.displayName;
      const childValue = `${child.props.value}`;
      const hasProperValue = childValue === `${defaultValue}`;

      if (hasProperType && hasProperValue) {
        setGroupName(path(['props', 'label'], parent));
        setSelectedOptions([
          {
            value: childValue,
            label: child.props.label || child.props.children || childValue,
          },
        ]);
      }
    },
    [defaultValue],
  );

  useLayoutEffect(() => {
    callForChildren(React.Children.forEach, children, checkAndSetDefaultValue);
  }, [children, defaultValue, label, checkAndSetDefaultValue]);

  const focusOnOption = (option) => {
    if (option) {
      option.scrollIntoView();
      option.focus();
      queryElement.current = option;
    } else if (queryElement.current) {
      queryElement.current.blur();
    }
  };

  const handleSearch = (event) => {
    if (optionsContainerRef.current) {
      clearTimeout(queryTimeout.current);
      query.current += event.key;
      const option = optionsContainerRef.current.querySelector(`[aria-label^="${query.current}"]`);
      focusOnOption(option);

      queryTimeout.current = setTimeout(() => {
        query.current = '';
      }, 500);
    }
  };

  const handleQueryChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleArrowUp = (event) => {
    if (queryElement.current) {
      event.preventDefault();
      focusOnOption(queryElement.current.previousElementSibling || queryElement.current);
    }
  };

  const handleArrowDown = (event) => {
    if (queryElement.current) {
      event.preventDefault();
      focusOnOption(queryElement.current.nextElementSibling || queryElement.current);
    }
  };

  const handleKeyEvent = (event) =>
    cond([
      [equals(KEY_CODES_BINDINGS.ARROW_DOWN), () => handleArrowDown(event)],
      [equals(KEY_CODES_BINDINGS.ARROW_UP), () => handleArrowUp(event)],
      [equals(KEY_CODES_BINDINGS.ENTER), Function.prototype],
      [T, () => (showSearch ? Function.prototype : handleSearch(event))],
    ])(event.keyCode);

  useEvent('keydown', handleKeyEvent);
  useEvent('mousemove', () => {
    if (optionsContainerRef.current && queryElement.current) {
      queryElement.current.blur();
    }
  });

  useUnmount(() => {
    clearTimeout(queryTimeout.current);
  });

  const scrollToSelectedItem = useCallback(() => {
    if (!optionsContainerRef.current) {
      return;
    }

    const selectedItem = optionsContainerRef.current.querySelector('[aria-selected="true"]');
    if (selectedItem) {
      selectedItem.scrollIntoView();
    }
  }, []);

  const handleOpen = useCallback(() => {
    scrollToSelectedItem();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [scrollToSelectedItem]);

  const handleClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  useEffect(() => {
    if (searchQuery.length === 0) {
      scrollToSelectedItem();
    }
  }, [scrollToSelectedItem, searchQuery]);

  const onDeleteChip = useCallback(
    (item) => {
      onChange({
        target: {
          value: selectedOptions.filter((row) => row.value !== item.value).map((row) => row.value),
          name,
        },
      });
    },
    [name, selectedOptions, onChange],
  );

  const shouldShowChips = useMemo(
    () => multiple && !selectedOptions.every(({ value }) => value === SELECT_ALL_OPTION_VALUE),
    [multiple, selectedOptions],
  );

  const valueLabel = useMemo(() => {
    if (groupAsValue && groupName) {
      return groupName;
    }

    if (shouldShowChips) {
      return (
        <S.SelectOptionChips
          onDelete={onDeleteChip}
          maxChips={maxChips}
          selectedOptions={selectedOptions}
        />
      );
    }

    if (renderSelectedOption) {
      return renderSelectedOption(selectedOptions[0] || {});
    }
    if (selectedOptions?.at(0)) {
      return selectedOptions[0].label || String(selectedOptions[0].value);
    }
    return t('select.none.label', 'None');
  }, [
    onDeleteChip,
    groupName,
    selectedOptions,
    groupAsValue,
    renderSelectedOption,
    maxChips,
    shouldShowChips,
    t,
  ]);

  const renderSearch = renderWhenTrue(() => (
    <S.SearchContainer>
      <S.SearchInput
        ref={searchInputRef}
        value={searchQuery}
        onChange={handleQueryChange}
        fullWidth
      />
    </S.SearchContainer>
  ));

  const mappedChildren = callForChildren(React.Children.map, children, prepareChild);
  const isEmptyStateVisible = showSearch && searchQuery.length > 0 && mappedChildren.length === 0;
  const invalid = is(String, error) && !disabled;

  return (
    <>
      <S.SelectContainer
        role="listbox"
        className={className}
        variant={variant}
        label={valueLabel}
        Icon={Icon}
        data-testid={dataTestId}
        rounded={rounded}
        fullWidth={fullWidth}
        disabled={disabled}
        onOpen={handleOpen}
        onClose={handleClose}
        anchor={anchor}
        touched={placeholder !== selectedOptions.label}
        aria-labelledby={ariaLabelledBy}
        withChips={shouldShowChips}
      >
        {renderSearch(showSearch)}
        <S.OptionsContainer ref={optionsContainerRef}>
          <EmptyState
            inline
            small
            text={t('select.emptyState.text', 'Could not find any matching item')}
            isVisible={isEmptyStateVisible}
          />
          {!isEmptyStateVisible && selectAllOptionVisible && (
            <SelectOption
              borderBottom
              value={SELECT_ALL_OPTION_VALUE}
              multiple
              onClick={handleOptionClick}
              active={selectedOptions.some(({ value }) => value === SELECT_ALL_OPTION_VALUE)}
            >
              {selectAllOptionLabel || t('select.selectAll.label', 'All')}
            </SelectOption>
          )}
          {mappedChildren}
        </S.OptionsContainer>
      </S.SelectContainer>
      {invalid && <ErrorMessage>{error}</ErrorMessage>}
    </>
  );
};

Select.defaultProps = {
  className: null,
  'data-testid': 'Select',
  variant: SELECT_VARIANT.DEFAULT,
  name: 'select',
  Icon: null,
  label: '',
  placeholder: '',
  error: false,
  onChange: Function.prototype,
  value: null,
  groupAsValue: false,
  rounded: false,
  fullWidth: true,
  disabled: false,
  showSearch: false,
  anchor: SELECT_ANCHOR.BOTTOM_CENTER,
  renderSelectedOption: null,
  'aria-labelledby': null,
  selectAllOptionVisible: false,
};

Select.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(Object.values(SELECT_VARIANT)),
  anchor: PropTypes.oneOf(Object.values(SELECT_ANCHOR)),
  'data-testid': PropTypes.string,
  'aria-labelledby': PropTypes.string,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  name: PropTypes.string,
  Icon: PropTypes.oneOfType([PropTypes.element, PropTypes.node, PropTypes.func]),
  children: PropTypes.node.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.arrayOf(PropTypes.string, PropTypes.number, PropTypes.bool),
  ]),
  groupAsValue: PropTypes.bool,
  rounded: PropTypes.bool,
  fullWidth: PropTypes.bool,
  disabled: PropTypes.bool,
  showSearch: PropTypes.bool,
  renderSelectedOption: PropTypes.func,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  multiple: PropTypes.bool,
  selectAllOptionVisible: PropTypes.bool,
  maxChips: PropTypes.number,
  selectAllOptionLabel: PropTypes.string,
};

export default Select;
