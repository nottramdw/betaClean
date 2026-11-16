import { fileName, parentDir } from "../../shared/format";
import { ThreatBadge } from "../../shared/ui/badge";
import { SelectAll } from "../../shared/ui/select-all";
import { Checkbox, PathCell, Table, Td, Th } from "../../shared/ui/table";
import { ENGINE_LABEL } from "./api";
import type { MergedThreat } from "./engine";

export function ThreatTable({
  threats,
  selected,
  onToggle,
  onSetMany,
}: {
  threats: MergedThreat[];
  selected: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onSetMany: (paths: string[], on: boolean) => void;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-12">
            <SelectAll ids={threats.map((t) => t.path)} selected={selected} onChange={onSetMany} />
          </Th>
          <Th>Tệp</Th>
          <Th className="w-64">Mối đe doạ</Th>
          <Th className="w-40">Công cụ</Th>
        </tr>
      </thead>
      <tbody>
        {threats.map((threat) => (
          <tr key={threat.path} className="hover:bg-slate-50">
            <Td>
              <Checkbox
                label={threat.path}
                checked={selected.has(threat.path)}
                onChange={() => onToggle(threat.path)}
              />
            </Td>
            <Td>
              <PathCell title={fileName(threat.path)} path={parentDir(threat.path)} />
            </Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {threat.names.map((name) => (
                  <ThreatBadge key={name}>{name}</ThreatBadge>
                ))}
              </div>
            </Td>
            <Td className="text-xs text-slate-600">
              {threat.engines.map((e) => ENGINE_LABEL[e]).join(", ")}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
