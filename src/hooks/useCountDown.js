import { useEffect, useState } from 'react';

const TIME_LEFT_CHECK_INTERVAL_MS = 1000;

const getTimeLeftInSeconds = (finishTimestamp) => {
  const currentTime = Date.now();
  return Math.ceil(Math.max(0, (finishTimestamp - currentTime) / TIME_LEFT_CHECK_INTERVAL_MS));
};

export function useCountDown(finishTimestamp = 0) {
  const [time, setTime] = useState(getTimeLeftInSeconds(finishTimestamp));
  useEffect(() => {
    setTime(getTimeLeftInSeconds(finishTimestamp));
    const interval = finishTimestamp
      ? setInterval(() => {
          const timeLeft = getTimeLeftInSeconds(finishTimestamp);
          if (!timeLeft) {
            clearInterval(interval);
          }
          setTime(timeLeft);
        }, TIME_LEFT_CHECK_INTERVAL_MS)
      : 0;

    return () => {
      clearInterval(interval);
      setTime(0);
    };
  }, [finishTimestamp]);

  return time;
}
