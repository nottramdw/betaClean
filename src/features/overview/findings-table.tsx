import { Info } from "lucide-react";
import { formatBytes } from "../../shared/format";
import { SafetyBadge } from "../../shared/ui/badge";
import { SelectAll } from "../../shared/ui/select-all";
import { Checkbox, Table, Td, Th } from "../../shared/ui/table";
import { CopyPath, RevealName } from "../../shared/ui/path-actions";
import { CATEGORY_LABEL, type Finding } from "./api";
import { isSelectable } from "./full-scan";

export function FindingsTable({
  findings,
  selected,
  onToggle,
  onSetMany,
}: {
  findings: Finding[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-12">
            <SelectAll
              ids={findings.filter(isSelectable).map((f) => f.id)}
              selected={selected}
              onChange={onSetMany}
            />
          </Th>
          <Th>Mục</Th>
          <Th className="w-36">Mức an toàn</Th>
          <Th className="w-28 text-right">Dung lượng</Th>
        </tr>
      </thead>
      <tbody>
        {findings.map((finding) => (
          <tr key={finding.id} className="hover:bg-slate-50">
            <Td>
              {isSelectable(finding) ? (
                <Checkbox
                  label={finding.title}
                  checked={selected.has(finding.id)}
                  onChange={() => onToggle(finding.id)}
                />
              ) : (
                <Info size={16} className="text-info" />
              )}
            </Td>
            <Td>
              <div className="flex min-w-0 items-baseline gap-2">
                <RevealName path={finding.path} className="min-w-0">
                  {finding.title}
                </RevealName>
                <span className="shrink-0 text-xs text-slate-400">
                  {CATEGORY_LABEL[finding.category]}
                </span>
              </div>
              <CopyPath path={finding.path} />
              <p className="mt-0.5 text-xs text-slate-500">
                {finding.reason}{" "}
                <span className={finding.safety === "chi-thong-bao" ? "font-medium text-info" : ""}>
                  {finding.action}
                </span>
              </p>
            </Td>
            <Td>
              <SafetyBadge safety={finding.safety} />
            </Td>
            <Td className="text-right font-medium tabular-nums text-slate-700">
              {formatBytes(finding.size)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
