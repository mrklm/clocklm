import { useEffect, useState } from 'react';

function getDelayToNextSecond() {
  const now = Date.now();
  return 1000 - (now % 1000);
}

export function useSystemTime() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      setCurrentTime(new Date());

      intervalId = window.setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }, getDelayToNextSecond());

    return () => {
      window.clearTimeout(timeoutId);

      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  return currentTime;
}
