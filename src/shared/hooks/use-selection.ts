import { useCallback, useState } from "react";

export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: string[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const replace = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, setMany, replace, clear };
}
