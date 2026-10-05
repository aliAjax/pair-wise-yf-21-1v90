import type { State } from "../domain/types.ts";

const KIND_LABEL: Record<string, string> = {
  layout: "排布",
  conflict: "冲突",
  queue: "等料",
  zone: "登记",
  material: "毯料",
  confirm: "确认",
};

/** 台账动态：排布、冲突、等料、登记变更按时间倒序 */
export function LogPanel({ state }: { state: State }) {
  return (
    <ul className="log-list">
      {state.log.map((e) => (
        <li key={e.id}>
          <span className={`log-kind log-${e.kind}`}>{KIND_LABEL[e.kind] ?? e.kind}</span>
          <span className="log-time">{e.time}</span>
          <span className="log-text">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}
