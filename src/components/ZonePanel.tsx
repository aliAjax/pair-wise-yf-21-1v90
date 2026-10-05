import type { DamageZone, Direction } from "../domain/types.ts";
import { DIRECTIONS, SEAM_ALLOWANCE } from "../domain/types.ts";
import { store } from "../domain/runtime.ts";

interface Props {
  zones: DamageZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function num(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** 破损登记：轮廓与绒头方向一改即提交，原位置立刻失效重算 */
export function ZonePanel({ zones, selectedId, onSelect }: Props) {
  return (
    <div className="zone-list">
      {zones.map((z) => {
        const key = `${z.id}:${z.revision}`;
        const commitOutline = (field: "x" | "y" | "w" | "h") => (e: React.FocusEvent<HTMLInputElement>) => {
          const v = num(e.target.value, z.outline[field]);
          const next = { ...z.outline, [field]: field === "w" || field === "h" ? Math.max(1, v) : Math.max(0, v) };
          store.updateZone(z.id, { outline: next });
        };
        return (
          <div
            key={key}
            className={`zone-row ${z.status === "pending" ? "is-pending" : ""} ${selectedId === z.id ? "is-selected" : ""}`}
            onClick={() => onSelect(z.id)}
          >
            <div className="zone-head">
              <b>{z.id}</b>
              <span>{z.label}</span>
              {z.status === "pending" ? (
                <em className="badge badge-pending">缺方向·待确认</em>
              ) : (
                <em className="badge badge-registered">已登记·第{z.revision}版</em>
              )}
            </div>
            <div className="zone-fields" onClick={(e) => e.stopPropagation()}>
              <span className="field-label">轮廓 x/y/w/h</span>
              {(["x", "y", "w", "h"] as const).map((f) => (
                <input
                  key={f}
                  type="number"
                  defaultValue={z.outline[f]}
                  min={f === "w" || f === "h" ? 1 : 0}
                  onBlur={commitOutline(f)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  aria-label={`${z.id} 轮廓 ${f}`}
                />
              ))}
              <span className="field-label">绒头方向</span>
              <select
                value={z.direction === null ? "" : String(z.direction)}
                onChange={(e) =>
                  store.updateZone(z.id, {
                    direction: e.target.value === "" ? null : (Number(e.target.value) as Direction),
                  })
                }
                aria-label={`${z.id} 绒头方向`}
              >
                <option value="">无记录</option>
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}°
                  </option>
                ))}
              </select>
              {z.status === "pending" && z.direction !== null && (
                <button
                  className="primary small"
                  onClick={() => store.confirmDirection(z.id, z.direction!)}
                >
                  确认方向
                </button>
              )}
            </div>
            <p className="zone-note">
              {z.status === "pending"
                ? "老档案缺绒头方向记录，先挂待确认；选好角度后点「确认方向」生成补块需求。"
                : `补块需求 ${z.outline.w + SEAM_ALLOWANCE * 2}×${z.outline.h + SEAM_ALLOWANCE * 2}cm（含每侧 ${SEAM_ALLOWANCE}cm 拼缝余量）· 改动即失效重算`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
