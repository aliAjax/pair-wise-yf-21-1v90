import type { Direction, Rect } from "./types.ts";

export interface OccupiedRect extends Rect {
  label: string;
}

/**
 * 方向跟着原毯走：补块绒头必须与原毯一致，
 * 所以补块在毯料上的旋转角由「毯料绒头 → 原毯绒头」唯一确定（90° 步进）。
 */
export function requiredRotation(materialDir: Direction, required: Direction): Direction {
  return (((required - materialDir) % 360) + 360) % 360 as Direction;
}

/** 旋转 90°/270° 时补块在毯料上的宽高互换 */
export function rotatedSize(w: number, h: number, rot: Direction): { w: number; h: number } {
  return rot === 90 || rot === 270 ? { w: h, h: w } : { w, h };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function fitsInside(sheet: { w: number; h: number }, r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= sheet.w && r.y + r.h <= sheet.h;
}

export function collides(occupied: Rect[], r: Rect): boolean {
  return occupied.some((o) => overlaps(o, r));
}

/**
 * 左下优先首次适配：候选点取 0 与已占用矩形的右边/顶边，
 * 自动避开已有补块；需求尺寸已含拼缝余量，贴边排即可。
 */
export function firstFit(
  sheet: { w: number; h: number },
  occupied: Rect[],
  w: number,
  h: number
): Rect | null {
  const xs = Array.from(new Set([0, ...occupied.map((o) => o.x + o.w)])).sort((a, b) => a - b);
  const ys = Array.from(new Set([0, ...occupied.map((o) => o.y + o.h)])).sort((a, b) => a - b);
  for (const y of ys) {
    for (const x of xs) {
      const r = { x, y, w, h };
      if (fitsInside(sheet, r) && !collides(occupied, r)) return r;
    }
  }
  return null;
}
