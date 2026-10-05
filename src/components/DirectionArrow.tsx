import { useId } from "react";
import type { Direction } from "../domain/types.ts";

interface Props {
  x: number;
  y: number;
  dir: Direction;
  /** 箭头长度（viewBox 单位） */
  len: number;
  color: string;
  strokeWidth?: number;
}

/** 绒头方向箭头：0°=倒向毯尾（屏幕下方），顺时针计 */
export function DirectionArrow({ x, y, dir, len, color, strokeWidth = 0.7 }: Props) {
  const markerId = useId();
  const half = len / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${dir})`} pointerEvents="none">
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={0}
        y1={-half}
        x2={0}
        y2={half}
        stroke={color}
        strokeWidth={strokeWidth}
        markerEnd={`url(#${markerId})`}
      />
    </g>
  );
}
