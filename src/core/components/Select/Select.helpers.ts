import * as React from 'react';

import type { SelectOptionItem } from './Select.types';
import type { ReactNode } from 'react';

import SelectGroup from './components/SelectGroup';
import SelectOption from './components/SelectOption';
import { SELECT_ALL_OPTION_VALUE } from './Select.constants';

export const callForChildren = (
  callMethod: (
    children: React.ReactNode,
    callback: (nestedChild: React.ReactNode) => void,
  ) => React.ReactNode,
  children: React.ReactNode,
  callback: (nestedChild: React.ReactNode, child?: React.ReactNode) => React.ReactNode,
) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callMethod(children, (child: any) => {
    if (!child) {
      return child;
    }

    if (child.type.displayName === SelectGroup.displayName) {
      const preparedChildren = callMethod(child.props.children, (nestedChild: React.ReactNode) =>
        callback(nestedChild, child),
      );
      return React.cloneElement(child, { children: preparedChildren });
    }
    return callback(child);
  });

export const addOrRemoveMultipleOptions = (
  selectedOptions: SelectOptionItem[],
  option: SelectOptionItem,
  availableValues: SelectOptionItem[],
  allLabel: string,
): SelectOptionItem[] => {
  const hasAllSelected = selectedOptions.some((row) => row.value === SELECT_ALL_OPTION_VALUE);

  if (option.value === SELECT_ALL_OPTION_VALUE) {
    if (!hasAllSelected) {
      return [option];
    }
    return [];
  }

  if (hasAllSelected) {
    return availableValues.filter((row) => row.value !== option.value);
  }

  const isAlreadySelected = selectedOptions.some((row) => row.value === option.value);
  if (isAlreadySelected) {
    return selectedOptions.filter((row) => row.value !== option.value);
  }

  const result = [...selectedOptions, option];

  if (result.length === availableValues.length || hasAllSelected) {
    return [{ value: SELECT_ALL_OPTION_VALUE, label: allLabel }];
  }

  return result;
};

export const extractSelectOptions = (children: Iterable<ReactNode>): SelectOptionItem[] => {
  const options: SelectOptionItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  React.Children.forEach(children, (child: any) => {
    if (child && child.type) {
      if (child.type.displayName === SelectOption.displayName) {
        options.push({
          value: child.props.value,
          label: child.props.label || child.props.children || child.props.value,
        });
      } else if (child.type.displayName === SelectGroup.displayName) {
        options.push(...extractSelectOptions(child.props.children));
      }
    }
  });

  return options;
};
