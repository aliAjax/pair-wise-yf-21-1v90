import type { State } from "../domain/types.ts";
import { carpetProgress } from "../domain/store.ts";

interface Props {
  state: State;
}

function stageOf(placed: number, total: number, pending: number): { label: string; cls: string } {
  if (pending > 0) return { label: "登记待确认", cls: "badge-pending" };
  if (total > 0 && placed === total) return { label: "排布完成·可裁剪", cls: "badge-ok" };
  if (placed > 0) return { label: "部分排布·有等料", cls: "badge-warn" };
  return { label: "等料中", cls: "badge-warn" };
}

/** 进度跟着排布走：每次排布变动，这里同步重算 */
export function ProgressPanel({ state }: Props) {
  return (
    <div className="progress-list">
      {state.carpets.map((c) => {
        const p = carpetProgress(state, c.id);
        const pct = p.total ? Math.round((p.placed / p.total) * 100) : 0;
        const stage = stageOf(p.placed, p.total, p.pending);
        return (
          <div key={c.id} className="progress-row">
            <div className="progress-head">
              <b>{c.id}</b>
              <span>{c.name}</span>
              <em className={`badge ${stage.cls}`}>{stage.label}</em>
              {p.pending > 0 && <em className="badge badge-pending">{p.pending} 区待确认</em>}
            </div>
            <div className="bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <small>
              已排布 {p.placed}/{p.total} 块补块 · {pct}%
            </small>
          </div>
        );
      })}
    </div>
  );
}
