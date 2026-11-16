import { useEffect, useState } from "react";

export function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      window.clearInterval(timer);
      setSeconds(0);
    };
  }, [active]);

  return seconds;
}
