import { Checkbox } from "./table";

export function SelectAll({
  ids,
  selected,
  onChange,
}: {
  ids: string[];
  selected: ReadonlySet<string>;
  onChange: (ids: string[], on: boolean) => void;
}) {
  const count = ids.filter((id) => selected.has(id)).length;
  return (
    <Checkbox
      label="Chọn tất cả"
      checked={ids.length > 0 && count === ids.length}
      indeterminate={count > 0}
      disabled={ids.length === 0}
      onChange={(on) => onChange(ids, on)}
    />
  );
}
