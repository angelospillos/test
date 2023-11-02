import { render } from 'react-dom';
import { Provider } from 'react-redux';

import proxyStore from '~/popup/store';
import * as sentryUtils from '~/utils/sentry';

import PopupApp from './PopupApp';

import '~/translations';

if (process.env.SENTRY_DSN) {
  sentryUtils.init('popup');
}

proxyStore.ready().then(() => {
  render(
    <Provider store={proxyStore}>
      <PopupApp />
    </Provider>,
    document.getElementById('app'),
  );
});
