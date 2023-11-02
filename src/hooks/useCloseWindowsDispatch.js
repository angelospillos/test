import { useDispatch } from 'react-redux';

import { ExtensionActions } from '~/modules/extension/extension.redux';

const useCloseWindowsDispatch = () => {
  const dispatch = useDispatch();

  const handleCloseWindows = () => {
    if (chrome.runtime.id) {
      dispatch(ExtensionActions.closeWindowsRequested());
    } else {
      window.close();
    }
  };

  return handleCloseWindows;
};

export default useCloseWindowsDispatch;
