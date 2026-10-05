import { useState } from "react";
import type { State } from "../domain/types.ts";
import { store } from "../domain/runtime.ts";

interface Props {
  state: State;
  zoneName: (zoneId: string) => string;
}

/** 排队等料 + 双人同时提交：暂存基于版本快照，后到者提交时看到冲突位置 */
export function QueuePanel({ state, zoneName }: Props) {
  const [materialId, setMaterialId] = useState(state.materials[0]?.id ?? "");
  const material = state.materials.find((m) => m.id === materialId) ?? state.materials[0];
  const queued = state.queue
    .map((id) => state.patches.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const last = state.lastSubmit;

  return (
    <div className="queue-panel">
      <div className="queue-list">
        {queued.length === 0 && <p className="empty">队列已清空，没有等料的补块。</p>}
        {queued.map((p, i) => (
          <div key={p.id} className="queue-row">
            <b className="queue-no">{i + 1}</b>
            <div>
              <b>{p.id}</b>（{zoneName(p.zoneId)}）需求 {p.needW}×{p.needH}cm · 绒头 {p.requiredDirection}°
              {p.note && <em className="badge badge-conflict">{p.note}</em>}
            </div>
          </div>
        ))}
      </div>

      <div className="stage-box">
        <p className="stage-title">双人同时提交模拟（版本号乐观锁）</p>
        <div className="stage-controls">
          <label>
            <span>目标毯料</span>
            <select value={material?.id ?? ""} onChange={(e) => setMaterialId(e.target.value)}>
              {state.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} {m.name}（v{m.version}）
                </option>
              ))}
            </select>
          </label>
          <div className="stage-buttons">
            <button disabled={queued.length === 0 || !material} onClick={() => store.stagePlan(material!.id)}>
              ① 暂存我的排布
            </button>
            <button disabled={!material} onClick={() => store.simulateColleague(material!.id)}>
              ② 同事抢先提交
            </button>
            <button className="primary" disabled={!state.staged} onClick={() => store.submitStaged()}>
              ③ 提交我的方案
            </button>
          </div>
        </div>
        {state.staged && (
          <p className="staged-info">
            已暂存（基于 {state.materials.find((m) => m.id === state.staged!.materialId)?.name} v
            {state.staged.baseVersion}）：
            {state.staged.proposals.map((p) => `${p.patchId} @(${p.rect.x},${p.rect.y})`).join("、")}
            {state.staged.proposals.some((p) => p.crossOrigin) && (
              <em className="badge badge-warn">含跨产区用料·需大师傅确认</em>
            )}
          </p>
        )}
        {last && !last.ok && (
          <div className="conflict-report">
            <b>
              提交被拒：{last.reason}（v{last.baseVersion}→v{last.currentVersion}）
            </b>
            <ul>
              {last.conflicts.map((c) => (
                <li key={c.patchId}>
                  {c.patchId} 拟排 @({c.rect.x},{c.rect.y}) {c.rect.w}×{c.rect.h} ↔ 冲突：{c.overlaps.join("、")}
                </li>
              ))}
            </ul>
            <p>冲突补块已退回排队等料，可重新暂存或等新毯料。</p>
          </div>
        )}
        {last && last.ok && <p className="ok-report">提交成功，方案已落到毯料（v{last.currentVersion}）。</p>}
      </div>
    </div>
  );
}
