import styled from 'styled-components';

export const Container = styled.div`
  pointer-events: none;
  font-size: 13px;

  *,
  *::before,
  *::after {
    font-family: 'NeueFrutiger';
    box-sizing: border-box;
  }

  #modal:not(:empty) {
    pointer-events: all;
  }
`;
