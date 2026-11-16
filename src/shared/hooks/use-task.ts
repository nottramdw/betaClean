import { useCallback, useState } from "react";
import { errorText } from "../format";

export function useTask<T>() {
  const [data, setData] = useState<T | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (task: () => Promise<T>): Promise<T | null> => {
    setRunning(true);
    setError(null);
    try {
      const result = await task();
      setData(result);
      return result;
    } catch (e) {
      setError(errorText(e));
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  return { data, setData, running, error, setError, run };
}
