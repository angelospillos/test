import styled from 'styled-components';

import { Content as ContentBase } from '~/components/Modal';

export const Container = styled.div`
  width: 520px;
`;

export const Content = styled(ContentBase)`
  display: flex;
  padding-top: 15px;

  svg {
    color: rgb(250, 205, 29);
    width: 69px;
    height: 74px;
    margin-left: 0px;
    margin-right: 20px;
    margin-top: -6px;
    flex-shrink: 1;
  }

  p:last-child {
    margin: 0;
  }

  > div {
    flex-grow: 1;
  }
`;
