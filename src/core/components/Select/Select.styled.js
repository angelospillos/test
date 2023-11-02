import { prop, complement } from 'ramda';
import styled, { css } from 'styled-components';

import { COLOR } from '../../theme';
import { ErrorMessage } from '../../theme/typography';
import { styleWhenTrue } from '../../utils/rendering';
import Dropdown, { ToggleButton } from '../Dropdown';
import SearchInputBase, { TextInput, SearchIcon } from '../SearchInput';

import SelectOptionChipsBase from './components/SelectOptionChips';

export const SelectOptionChips = styled(SelectOptionChipsBase)``;

export const SelectContainer = styled(Dropdown)`
  background-color: ${COLOR.WHITE};

  && button {
    color: ${COLOR.DARK_GRAY};
  }

  ${styleWhenTrue(
    complement(prop('touched')),
    css`
      && button {
        color: #979797;
      }
    `,
  )}

  ${ToggleButton} {
    height: auto;
    min-height: 38px;

    ${styleWhenTrue(
      prop('withChips'),
      css`
        padding-left: 8px;
      `,
    )}
  }

  button:disabled {
    border-color: ${COLOR.GRAY_9};
    background-color: ${COLOR.GRAY_28};
    opacity: 0.8;
  }

  + ${ErrorMessage} {
    margin-top: 0;
  }
`;

export const OptionsContainer = styled.div.attrs(() => ({
  role: 'listbox',
}))`
  display: flex;
  flex-direction: column;
  max-height: 350px;
  overflow: auto;

  svg {
    margin-right: 6px;
    left: -1px;
  }
`;

export const SearchContainer = styled.div``;

export const SearchInput = styled(SearchInputBase)`
  width: 100%;

  ${TextInput} {
    padding: 7px 11px 4px 28px;
  }

  ${SearchIcon} {
    left: 8px;
  }
`;
