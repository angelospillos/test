import styled from 'styled-components';

import { Content as ContentBase } from '~/components/Modal';

export const Container = styled.div`
  width: 520px;
`;

export const Content = styled(ContentBase)`
  display: flex;
  padding-top: 15px;

  svg {
    color: #6d6d6d;
    width: 110px;
    height: 74px;
    margin-left: 5px;
    margin-right: 25px;
    margin-top: -6px;
    flex-shrink: 1;
  }

  p:first-child {
    margin-bottom: 0;
  }

  p:last-child {
    margin: 0;
    margin-bottom: 20px;
  }

  > div {
    flex-grow: 1;
  }
`;
