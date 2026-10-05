// 旧毯料套裁图：毯料幅面、已有补块（避开）、候选补块预览、冲突位置红框

import type { DamageRecord, LayoutInfo, Material } from "../types";

interface Props {
  material: Material;
  selectedDamage: DamageRecord | null;
  /** 候选位置（能放下时）：绿色虚线预览 */
  preview: { x: number; y: number; w: number; h: number } | null;
  /** 当前破损在这块毯料上的冲突排布（后到者看到的冲突位置） */
  conflictLayout: LayoutInfo | null;
}

function dirArrow(x: number, y: number, w: number, h: number, dir: number, color: string) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const len = Math.min(w, h) * 0.28;
  const rad = (dir * Math.PI) / 180;
  return (
    <line
      x1={cx - len * Math.cos(rad)}
      y1={cy - len * Math.sin(rad)}
      x2={cx + len * Math.cos(rad)}
      y2={cy + len * Math.sin(rad)}
      stroke={color}
      strokeWidth="1.6"
      markerEnd={`url(#arrow-${color === "#0f766e" ? "g" : color === "#b45309" ? "o" : "r"})`}
    />
  );
}

export default function MaterialCanvas({ material, selectedDamage, preview, conflictLayout }: Props) {
  const { width: W, height: H } = material;

  return (
    <div className="canvas-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="canvas material-canvas">
        <defs>
          <pattern id="matGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
          <marker id="arrow-g" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#0f766e" />
          </marker>
          <marker id="arrow-o" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#b45309" />
          </marker>
          <marker id="arrow-r" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
          </marker>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#matGrid)" />
        <rect x="0" y="0" width={W} height={H} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

        {/* 毯料绒头方向（跟着原毯走） */}
        <g transform="translate(14,14)">
          <line
            x1="0"
            y1="0"
            x2={18 * Math.cos((material.pileDirection * Math.PI) / 180)}
            y2={18 * Math.sin((material.pileDirection * Math.PI) / 180)}
            stroke="#0f766e"
            strokeWidth="2.4"
            markerEnd="url(#arrow-g)"
          />
          <text x="0" y="-6" fontSize="7" fill="#0f766e">绒头 {material.pileDirection}°</text>
        </g>

        {/* 已有补块（选料时要避开） */}
        {material.patches.map((p) => {
          const isRival = p.worker === "工位B";
          const isOld = p.damageId === "DMG-OLD";
          const fill = isOld
            ? "rgba(100,116,139,0.14)"
            : isRival
              ? "rgba(180,83,9,0.16)"
              : "rgba(15,118,110,0.13)";
          const stroke = isOld ? "#94a3b8" : isRival ? "#b45309" : "#0f766e";
          const isConflict = conflictLayout?.conflictPatchId === p.id;
          return (
            <g key={p.id}>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill={fill}
                stroke={isConflict ? "#dc2626" : stroke}
                strokeWidth={isConflict ? 2.4 : 1.4}
                strokeDasharray={isConflict ? "5 3" : undefined}
                className={isConflict ? "pulse-rect" : undefined}
              />
              {dirArrow(p.x, p.y, p.w, p.h, p.pileDirection, isConflict ? "#dc2626" : stroke)}
              <text
                x={p.x + 4}
                y={p.y + 10}
                fontSize="7"
                fill={isConflict ? "#dc2626" : "#475569"}
              >
                {p.carpetId}
                {isRival ? " · 工位B" : ""}
              </text>
            </g>
          );
        })}

        {/* 候选补块预览（绿色虚线 = 可排） */}
        {preview && !conflictLayout && (
          <rect
            x={preview.x}
            y={preview.y}
            width={preview.w}
            height={preview.h}
            fill="rgba(15,118,110,0.10)"
            stroke="#0f766e"
            strokeWidth="1.8"
            strokeDasharray="6 3"
          >
            <title>{selectedDamage?.carpetId} 候选位置</title>
          </rect>
        )}

        {/* 冲突位置（后到者看到的红框） */}
        {conflictLayout && (
          <g>
            <rect
              x={conflictLayout.x}
              y={conflictLayout.y}
              width={conflictLayout.w}
              height={conflictLayout.h}
              fill="rgba(220,38,38,0.10)"
              stroke="#dc2626"
              strokeWidth="2.2"
              strokeDasharray="7 3"
              className="pulse-rect"
            />
            <text
              x={conflictLayout.x + conflictLayout.w / 2}
              y={conflictLayout.y - 6}
              textAnchor="middle"
              fontSize="8"
              fill="#dc2626"
            >
              冲突位置：工位B 已占用
            </text>
          </g>
        )}
      </svg>

      <div className="canvas-legend">
        <span><i className="swatch" style={{ background: "rgba(15,118,110,0.13)", border: "1px solid #0f766e" }} />已有补块（避开）</span>
        <span><i className="swatch" style={{ background: "rgba(180,83,9,0.16)", border: "1px solid #b45309" }} />工位B 同时提交</span>
        <span><i className="swatch" style={{ background: "rgba(15,118,110,0.10)", border: "1px dashed #0f766e" }} />候选位置</span>
        <span><i className="swatch" style={{ background: "rgba(220,38,38,0.10)", border: "1px dashed #dc2626" }} />冲突位置</span>
      </div>
    </div>
  );
}
