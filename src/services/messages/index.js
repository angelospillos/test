import i18n from '~/translations';

import styles from './messages.scss';

const isInternalUrl = () => window.location.href === process.env.BLANK_PAGE_URL;

const callWhenDocumentIsReady = (fn) =>
  new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!document.body) {
        return;
      }

      clearInterval(interval);
      if (isInternalUrl()) {
        resolve();
        return;
      }

      if (fn) {
        fn(resolve);
      }
      resolve();
    }, 50);
  });

export const removeMessage = () =>
  callWhenDocumentIsReady((resolve) => {
    const element = document.querySelector('.angelos-message-wrapper');
    if (element) {
      element.remove();
    }
    resolve();
  });

const defaultOptions = { showLoader: true, timeout: null, showOverlay: false };

const getMessageWrapper = () => {
  const currentWrapper = document.querySelector('.angelos-message-wrapper');
  if (currentWrapper) {
    return currentWrapper.shadowRoot;
  }

  const messageWrapper = document.createElement('div');
  document.body.parentElement.appendChild(messageWrapper);
  messageWrapper.classList.add('angelos');
  messageWrapper.classList.add('angelos-message-wrapper');

  return messageWrapper.attachShadow({ mode: 'open' });
};

export const showMessage = (message, options = {}) =>
  callWhenDocumentIsReady((resolve) => {
    const { timeout, showOverlay, showLoader } = { ...defaultOptions, ...options };
    const messageWrapper = getMessageWrapper();
    messageWrapper.innerHTML = `
        <style>${styles}</style>
        <div class="angelos angelos-message${
          showOverlay ? ' angelos-message-wrapper--with-overlay' : ''
        }">
          <div class="angelos angelos-message__inner">&nbsp;</div>
          <div class="angelos angelos-message__message">
            ${showLoader ? '<div class="loader"></div>' : ''}
            <span>${message}</span>
          </div>
        </div>
      `;
    resolve();

    if (timeout) {
      setTimeout(removeMessage, timeout);
    }
  });

export const showFileSizeMessage = () =>
  showMessage(
    i18n.t('messages.toBigFile', 'Step ignored: uploaded file size should be less than 10MB.'),
    { showLoader: false, timeout: 5000 },
  );

export const showInvalidElementTypeMessage = () =>
  showMessage(
    i18n.t(
      'messages.invalidType',
      'Make sure you click an input element, for example a text field.',
    ),
    {
      showLoader: false,
      timeout: 5000,
    },
  );

export const showPageLoadingMessage = () =>
  showMessage(i18n.t('messages.pageLoader', 'Page is loading, please wait...'), {
    showOverlay: true,
  });
