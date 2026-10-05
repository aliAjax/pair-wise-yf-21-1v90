// 毯面轮廓图：登记破损多边形轮廓 + 绒头方向转盘
// 可编辑模式下：点击毯面加轮廓点、拖动顶点改轮廓、拖动箭头转盘改方向

import { useRef, useState } from "react";
import type { PileDirection, Point } from "../types";
import { centroid } from "../nesting";

const W = 200;
const H = 150;

interface Props {
  outline: Point[];
  pileDirection: PileDirection | null;
  seamAllowance: number;
  editable?: boolean;
  onChange?: (outline: Point[]) => void;
  onDirectionChange?: (dir: number) => void;
}

type DragMode = "vertex" | "dir" | null;

export default function CarpetCanvas({
  outline,
  pileDirection,
  seamAllowance,
  editable = false,
  onChange,
  onDirectionChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const [vertexIndex, setVertexIndex] = useState<number>(-1);

  const toSvgPoint = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * W),
      y: Math.round(((clientY - rect.top) / rect.height) * H),
    };
  };

  const angleFromCentroid = (p: Point): number => {
    const c = centroid(outline);
    const deg = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
    return Math.round((deg + 360) % 360);
  };

  const handlePointerDown = (e: React.PointerEvent, mode: DragMode, index = -1) => {
    if (!editable) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag(mode);
    setVertexIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag || !editable) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (drag === "vertex" && vertexIndex >= 0) {
      const next = outline.map((pt, i) => (i === vertexIndex ? p : pt));
      onChange?.(next);
    } else if (drag === "dir") {
      onDirectionChange?.(angleFromCentroid(p));
    }
  };

  const handlePointerUp = () => {
    setDrag(null);
    setVertexIndex(-1);
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!editable || drag === "vertex") return;
    if ((e.target as Element).tagName === "circle") return;
    const p = toSvgPoint(e.clientX, e.clientY);
    onChange?.([...outline, p]);
  };

  const c = centroid(outline);
  const knobR = 26;
  const knobPos =
    pileDirection == null
      ? null
      : {
          x: c.x + knobR * Math.cos((pileDirection * Math.PI) / 180),
          y: c.y + knobR * Math.sin((pileDirection * Math.PI) / 180),
        };

  const polyPoints = outline.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="canvas carpet-canvas"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleSvgClick}
      >
        <defs>
          <pattern id="carpetGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e7e0d5" strokeWidth="0.6" />
          </pattern>
          <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#0f766e" />
          </marker>
          <marker id="arrowHeadDim" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#carpetGrid)" />
        <rect x="0" y="0" width={W} height={H} fill="none" stroke="#d6cdbd" strokeWidth="1.5" />

        {/* 拼缝余量（破损轮廓外接框外扩） */}
        {outline.length >= 3 &&
          (() => {
            const xs = outline.map((p) => p.x);
            const ys = outline.map((p) => p.y);
            const a = seamAllowance;
            return (
              <rect
                x={Math.min(...xs) - a}
                y={Math.min(...ys) - a}
                width={Math.max(...xs) - Math.min(...xs) + a * 2}
                height={Math.max(...ys) - Math.min(...ys) + a * 2}
                fill="none"
                stroke="#b45309"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            );
          })()}

        {/* 破损轮廓 */}
        {outline.length >= 3 && (
          <polygon
            points={polyPoints}
            fill="rgba(124, 45, 18, 0.12)"
            stroke="#7c2d12"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        )}
        {outline.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={editable ? 3.5 : 2.5}
            fill="#7c2d12"
            stroke="#fff"
            strokeWidth="1.2"
            style={editable ? { cursor: "move" } : undefined}
            onPointerDown={(e) => handlePointerDown(e, "vertex", i)}
          />
        ))}

        {/* 绒头方向箭头 */}
        {outline.length >= 3 && pileDirection != null && knobPos && (
          <g>
            <line
              x1={c.x}
              y1={c.y}
              x2={knobPos.x}
              y2={knobPos.y}
              stroke="#0f766e"
              strokeWidth="2.2"
              markerEnd="url(#arrowHead)"
            />
            {editable && (
              <circle
                cx={knobPos.x}
                cy={knobPos.y}
                r="6"
                fill="#0f766e"
                stroke="#fff"
                strokeWidth="1.5"
                style={{ cursor: "grab" }}
                onPointerDown={(e) => handlePointerDown(e, "dir")}
              />
            )}
          </g>
        )}
        {outline.length >= 3 && pileDirection == null && (
          <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
            缺方向记录
          </text>
        )}

        {/* 未闭合提示 */}
        {editable && outline.length > 0 && outline.length < 3 && (
          <text x="10" y="14" fontSize="9" fill="#b45309">
            再点 {3 - outline.length} 处闭合轮廓
          </text>
        )}
      </svg>

      <div className="canvas-legend">
        <span><i className="swatch swatch-damage" />破损轮廓</span>
        <span><i className="swatch swatch-allowance" />拼缝余量</span>
        <span><i className="swatch swatch-dir" />绒头方向{editable && "（拖动箭头转盘调整）"}</span>
      </div>
    </div>
  );
}
