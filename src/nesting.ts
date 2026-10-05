// 套裁排布算法：在旧毯料上给补块找位置
// 铁律：绒头方向必须与原毯一致，补块不能旋转（转了灯下泛白）

import type { DamageRecord, Material, PileDirection, Point, PlacedPatch } from "./types";

export function bbox(points: Point[]): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const c = bbox(points);
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
}

/** 补块尺寸 = 破损轮廓外接框 + 四周拼缝余量 */
export function patchRect(damage: DamageRecord): { x: number; y: number; w: number; h: number } {
  const b = bbox(damage.outline);
  const a = damage.seamAllowance;
  return { x: b.x - a, y: b.y - a, w: b.w + a * 2, h: b.h + a * 2 };
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 绒头方向是否一致（容差 5°，方向跟着原毯走，不允许旋转补块） */
export function directionMatches(a: PileDirection | null, b: PileDirection): boolean {
  if (a == null) return false;
  const d = ((a - b) % 360 + 360) % 360;
  return Math.min(d, 360 - d) <= 5;
}

/**
 * 最低左靠（bottom-left）套裁：
 * 候选点 = 毯料原点 + 每块已有补块的右边、下边，
 * 选不越界、不压补块的最靠下、再靠左的位置。
 */
export function findPlacement(
  material: Material,
  w: number,
  h: number
): Point | null {
  if (w > material.width || h > material.height) return null;
  const candidates: Point[] = [{ x: 0, y: 0 }];
  for (const p of material.patches) {
    candidates.push({ x: p.x + p.w, y: p.y });
    candidates.push({ x: p.x, y: p.y + p.h });
  }
  let best: Point | null = null;
  for (const c of candidates) {
    if (c.x < 0 || c.y < 0) continue;
    if (c.x + w > material.width || c.y + h > material.height) continue;
    if (material.patches.some((p) => rectsOverlap({ x: c.x, y: c.y, w, h }, p))) continue;
    if (best === null || c.y < best.y || (c.y === best.y && c.x < best.x)) best = c;
  }
  return best;
}

/** 方向不一致时的提示文案 */
export function directionMismatchReason(
  damage: DamageRecord,
  material: Material
): string | null {
  if (damage.pileDirection == null) return "缺绒头方向记录，先挂待确认";
  if (!directionMatches(damage.pileDirection, material.pileDirection)) {
    return `绒头方向不一致（原毯 ${damage.pileDirection}° / 毯料 ${material.pileDirection}°），补上去灯下泛白`;
  }
  return null;
}

/** 在毯料上落一块补块，返回新毯料（不改原对象） */
export function withPatch(
  material: Material,
  patch: PlacedPatch
): Material {
  return {
    ...material,
    patches: [...material.patches, patch],
    version: material.version + 1,
  };
}
