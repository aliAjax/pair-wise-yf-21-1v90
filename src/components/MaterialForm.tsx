import { useState } from "react";
import type { Direction } from "../domain/types.ts";
import { DIRECTIONS } from "../domain/types.ts";
import { store } from "../domain/runtime.ts";

interface Props {
  origins: string[];
}

/** 新毯料入库：入库后自动尝试排空等料队列 */
export function MaterialForm({ origins }: Props) {
  const [name, setName] = useState("安纳托利亚边料·丙");
  const [origin, setOrigin] = useState(origins[1] ?? origins[0] ?? "波斯");
  const [w, setW] = useState(30);
  const [h, setH] = useState(30);
  const [direction, setDirection] = useState<Direction>(0);

  const submit = () => {
    if (!name.trim() || w < 5 || h < 5) return;
    store.addMaterial({ name: name.trim(), origin, w, h, direction });
  };

  return (
    <div className="material-form">
      <label>
        <span>毯料名称</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span>产区</span>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
          {origins.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label>
        <span>宽 cm</span>
        <input type="number" min={5} value={w} onChange={(e) => setW(Number(e.target.value) || 5)} />
      </label>
      <label>
        <span>高 cm</span>
        <input type="number" min={5} value={h} onChange={(e) => setH(Number(e.target.value) || 5)} />
      </label>
      <label>
        <span>绒头方向</span>
        <select value={direction} onChange={(e) => setDirection(Number(e.target.value) as Direction)}>
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d}°
            </option>
          ))}
        </select>
      </label>
      <button className="primary" onClick={submit}>
        入库并排布
      </button>
    </div>
  );
}
