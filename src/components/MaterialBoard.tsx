import type { ConflictInfo, Material, Patch, StagedPlan } from "../domain/types.ts";
import { DirectionArrow } from "./DirectionArrow.tsx";

interface Props {
  material: Material;
  patches: Patch[];
  staged: StagedPlan | null;
  conflicts: ConflictInfo[];
  colorOf: (zoneId: string) => string;
  zoneName: (zoneId: string) => string;
}

/** 毯料排布图：已有补块（灰斜纹）、已排补块（带绒头箭头）、暂存预览（青虚线）、冲突位置（红虚线） */
export function MaterialBoard({ material, patches, staged, conflicts, colorOf, zoneName }: Props) {
  const hatchId = `hatch-${material.id}`;
  const stagedHere = staged?.materialId === material.id ? staged.proposals : [];
  return (
    <figure className="board-card">
      <svg viewBox={`-2 -2 ${material.w + 4} ${material.h + 4}`} className="board-svg" role="img">
        <defs>
          <pattern id={hatchId} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="3" fill="#e8edf4" />
            <line x1="0" y1="0" x2="0" y2="3" stroke="#b6c2d2" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={material.w} height={material.h} className="sheet-body" />
        {material.existing.map((b) => (
          <g key={b.id}>
            <rect x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} fill={`url(#${hatchId})`} stroke="#94a3b8" strokeWidth="0.4">
              <title>{b.label}（已有补块，排布需避开）</title>
            </rect>
            <text x={b.rect.x + b.rect.w / 2} y={b.rect.y + b.rect.h / 2} className="sheet-label" textAnchor="middle" dominantBaseline="central">
              {b.label}
            </text>
          </g>
        ))}
        {patches.map((p) => {
          const pl = p.placement!;
          const color = colorOf(p.zoneId);
          const cx = pl.rect.x + pl.rect.w / 2;
          const cy = pl.rect.y + pl.rect.h / 2;
          return (
            <g key={p.id}>
              <rect
                x={pl.rect.x}
                y={pl.rect.y}
                width={pl.rect.w}
                height={pl.rect.h}
                fill={color}
                fillOpacity={0.24}
                stroke={color}
                strokeWidth={0.6}
              >
                <title>
                  {p.id}（{zoneName(p.zoneId)}）绒头 {p.requiredDirection}° · 旋转 {pl.rotation}° · 基于 v{pl.materialVersion}
                </title>
              </rect>
              <DirectionArrow x={cx} y={cy} dir={p.requiredDirection} len={Math.min(pl.rect.w, pl.rect.h) * 0.7} color={color} strokeWidth={0.8} />
              <text x={pl.rect.x + 1} y={pl.rect.y + 2.6} className="patch-tag" fill={color}>
                {p.id} 旋{pl.rotation}°
              </text>
            </g>
          );
        })}
        {stagedHere.map((s) => (
          <g key={`staged-${s.patchId}`}>
            <rect x={s.rect.x} y={s.rect.y} width={s.rect.w} height={s.rect.h} className="staged-rect">
              <title>暂存方案：{s.patchId}（未提交）</title>
            </rect>
            <text x={s.rect.x + 1} y={s.rect.y + 2.6} className="staged-tag">
              {s.patchId} 暂
            </text>
          </g>
        ))}
        {conflicts.map((c) => (
          <g key={`conflict-${c.patchId}`}>
            <rect x={c.rect.x} y={c.rect.y} width={c.rect.w} height={c.rect.h} className="conflict-rect">
              <title>冲突位置：{c.patchId} ↔ {c.overlaps.join("、")}</title>
            </rect>
            <text x={c.rect.x + 1} y={c.rect.y + c.rect.h - 1.2} className="conflict-tag">
              冲突
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <b>{material.id}</b> {material.name} · {material.origin} · {material.w}×{material.h}cm · 绒头 {material.direction}° ·{" "}
        <span className="ver">v{material.version}</span>
      </figcaption>
    </figure>
  );
}
