/** 绒头方向：按毯面顺时针计，0° = 倒向毯尾（屏幕下方）。补块只允许 90° 步进旋转。 */
export type Direction = 0 | 90 | 180 | 270;
export const DIRECTIONS: readonly Direction[] = [0, 90, 180, 270];

/** 拼缝余量（cm，每侧）。补块需求尺寸 = 破损轮廓 + 两侧余量。 */
export const SEAM_ALLOWANCE = 2;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Carpet {
  id: string;
  name: string;
  origin: string;
  era: string;
  knotDensity: string;
  material: string;
  dye: string;
  w: number;
  h: number;
}

export type ZoneStatus = "registered" | "pending";

export interface DamageZone {
  id: string;
  carpetId: string;
  label: string;
  /** 破损轮廓（毯面坐标，cm） */
  outline: Rect;
  /** 绒头方向；null = 老档案缺记录，先挂待确认 */
  direction: Direction | null;
  status: ZoneStatus;
  /** 轮廓或方向每次改动 +1，旧版位置随之失效 */
  revision: number;
}

export type PatchStatus = "queued" | "placed" | "invalid";

export interface Placement {
  materialId: string;
  /** 在毯料上的占用（含拼缝余量） */
  rect: Rect;
  /** 相对毯料的旋转角，使补块绒头与原毯一致 */
  rotation: Direction;
  /** 提交时基于的毯料版本 */
  materialVersion: number;
}

export interface Patch {
  id: string;
  zoneId: string;
  needW: number;
  needH: number;
  requiredDirection: Direction;
  zoneRevision: number;
  status: PatchStatus;
  placement: Placement | null;
  note: string | null;
}

export interface ExistingBlock {
  id: string;
  rect: Rect;
  label: string;
}

export interface Material {
  id: string;
  name: string;
  origin: string;
  w: number;
  h: number;
  direction: Direction;
  /** 乐观锁版本：每次成功提交（排布/他人补块/失效释放）+1 */
  version: number;
  /** 毯料上已有补块，选料排布时必须避开 */
  existing: ExistingBlock[];
}

export interface Proposal {
  patchId: string;
  rect: Rect;
  rotation: Direction;
  /** 跨产区用料（自动排布不允许，人工暂存可特批） */
  crossOrigin: boolean;
}

export interface StagedPlan {
  materialId: string;
  baseVersion: number;
  proposals: Proposal[];
  createdAt: string;
}

export interface ConflictInfo {
  patchId: string;
  rect: Rect;
  rotation: Direction;
  overlaps: string[];
}

export interface SubmitResult {
  ok: boolean;
  reason: string | null;
  materialId: string;
  baseVersion: number;
  currentVersion: number;
  conflicts: ConflictInfo[];
}

export type LogKind = "layout" | "conflict" | "queue" | "zone" | "material" | "confirm";

export interface LogEntry {
  id: number;
  time: string;
  kind: LogKind;
  text: string;
}

export interface State {
  carpets: Carpet[];
  zones: DamageZone[];
  patches: Patch[];
  materials: Material[];
  /** 排队等料的补块 id，FIFO */
  queue: string[];
  staged: StagedPlan | null;
  lastSubmit: SubmitResult | null;
  log: LogEntry[];
}
