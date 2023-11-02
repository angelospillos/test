import React, { Suspense } from 'react';
import ShadowRoot from 'react-shadow/styled-components';

const App = React.lazy(() =>
  import(
    /* webpackMode: "eager" */
    '~/content/components/App'
  ),
);

const Root = ({ windowId, hiddenOverlay }) => (
  // eslint-disable-next-line react/jsx-pascal-case
  <ShadowRoot.div className="angelos-app">
    <Suspense fallback={<div />}>
      <App windowId={windowId} hiddenOverlay={hiddenOverlay} />
    </Suspense>
  </ShadowRoot.div>
);

export default Root;
