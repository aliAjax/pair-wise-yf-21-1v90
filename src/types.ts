// 地毯修复档案 —— 领域模型

/** 绒头方向（角度，0-359°，0° 朝东、90° 朝南，与毯面坐标系一致） */
export type PileDirection = number;

/**
 * 破损状态：
 * - 待确认：老档案缺绒头方向记录，先挂起，不能排布
 * - 待排料：轮廓与方向齐全，等待选料套裁
 * - 等料：没有容量合适的旧毯料，排队等料
 * - 冲突：两人同时提交同一块毯料，后到者看到冲突位置
 * - 已排布：补块已在毯料上排好，可进刀
 * - 已修补：修复完工
 */
export type DamageStatus =
  | "待确认"
  | "待排料"
  | "等料"
  | "冲突"
  | "已排布"
  | "已修补";

export interface Point {
  x: number;
  y: number;
}

/** 毯料上已排好的补块（含历史补块） */
export interface PlacedPatch {
  id: string;
  /** 所属破损记录；历史补块可能查不到档案，用地毯编号占位 */
  damageId: string;
  carpetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pileDirection: PileDirection;
  worker: string;
  placedAt: number;
}

export interface Material {
  id: string;
  name: string;
  /** 毯料幅宽 / 幅高（cm） */
  width: number;
  height: number;
  pileDirection: PileDirection;
  patches: PlacedPatch[];
  /** 版本号：并发提交时比对，后到者据此发现冲突 */
  version: number;
}

export type LayoutStatus = "placed" | "queued" | "conflict";

/** 一条排布结果：补块在某块毯料上的位置，或排队/冲突状态 */
export interface LayoutInfo {
  status: LayoutStatus;
  materialId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 排布依据的破损记录版本；轮廓/方向改动后即失效重算 */
  computedAtVersion: number;
  /** 冲突时占用该位置的补块 id */
  conflictPatchId?: string;
}

export interface DamageRecord {
  id: string;
  carpetId: string;
  /** 破损轮廓（多边形，毯面坐标，单位 cm） */
  outline: Point[];
  /** 绒头方向；null 表示老档案缺方向记录，挂待确认 */
  pileDirection: PileDirection | null;
  /** 拼缝余量（cm），补块外扩的缝份 */
  seamAllowance: number;
  status: DamageStatus;
  /** 进度 0-100，与排布状态在同一次更新里联动 */
  progress: number;
  /** 记录版本号：轮廓或方向一旦改动立刻 +1，已有排布作废 */
  version: number;
  layout: LayoutInfo | null;
  createdAt: number;
}

export interface DB {
  damages: DamageRecord[];
  materials: Material[];
}

/** 排布计算的返回结果，用于向界面反馈 */
export interface PlaceOutcome {
  ok: boolean;
  reason?: "direction" | "queued" | "conflict" | "no-direction";
  damage?: DamageRecord;
  conflictPatch?: PlacedPatch;
}
