import type { Carpet, DamageZone } from "../domain/types.ts";
import { DirectionArrow } from "./DirectionArrow.tsx";

interface Props {
  carpet: Carpet;
  zones: DamageZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 毯面标记图：破损轮廓 + 绒头方向；缺方向的挂「？」待确认 */
export function CarpetMap({ carpet, zones, selectedId, onSelect }: Props) {
  return (
    <svg
      className="carpet-map"
      viewBox={`-3 -3 ${carpet.w + 6} ${carpet.h + 6}`}
      role="img"
      aria-label={`${carpet.name} 破损标记图`}
    >
      <rect x={0} y={0} width={carpet.w} height={carpet.h} className="carpet-body" />
      {zones.map((z) => {
        const selected = z.id === selectedId;
        const cls = [
          "zone-rect",
          z.status === "pending" ? "zone-pending" : "zone-registered",
          selected ? "zone-selected" : "",
        ].join(" ");
        const cx = z.outline.x + z.outline.w / 2;
        const cy = z.outline.y + z.outline.h / 2;
        return (
          <g key={z.id} onClick={() => onSelect(z.id)} style={{ cursor: "pointer" }}>
            <rect
              x={z.outline.x}
              y={z.outline.y}
              width={z.outline.w}
              height={z.outline.h}
              className={cls}
            >
              <title>
                {z.id} {z.label} · 第{z.revision}版
                {z.direction === null ? " · 绒头方向待确认" : ` · 绒头 ${z.direction}°`}
              </title>
            </rect>
            {z.direction !== null ? (
              <DirectionArrow
                x={cx}
                y={cy}
                dir={z.direction}
                len={Math.min(z.outline.w, z.outline.h) * 0.8 + 3}
                color={selected ? "#0f766e" : "#7c2d12"}
              />
            ) : (
              <text x={cx} y={cy} className="zone-pending-mark" textAnchor="middle" dominantBaseline="central">
                ?
              </text>
            )}
            <text x={z.outline.x + 1} y={z.outline.y - 1.2} className="zone-tag">
              {z.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
