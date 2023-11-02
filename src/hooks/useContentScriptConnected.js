import { useEffect, useState } from 'react';

const useContentScriptConnected = () => {
  const [isConnected, setIsConnected] = useState(!!chrome.runtime.id);

  const handleDisconnection = () => setIsConnected(false);

  useEffect(() => {
    if (chrome.runtime.id) {
      // eslint-disable-next-line no-undef
      chrome.runtime.connect().onDisconnect.addListener(handleDisconnection);
    }
  }, []);

  return isConnected;
};

export default useContentScriptConnected;
