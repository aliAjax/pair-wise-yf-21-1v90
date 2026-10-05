import type {
  ConflictInfo,
  DamageZone,
  Direction,
  LogKind,
  Material,
  Patch,
  Proposal,
  Rect,
  State,
} from "./types.ts";
import { SEAM_ALLOWANCE } from "./types.ts";
import { firstFit, overlaps, requiredRotation, rotatedSize } from "./nesting.ts";
import type { OccupiedRect } from "./nesting.ts";

function now(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

const SEAM_ALLOWED_TEXT = `每侧 ${SEAM_ALLOWANCE}cm`;

export interface MaterialInput {
  name: string;
  origin: string;
  w: number;
  h: number;
  direction: Direction;
}

/**
 * 工作室排布台账。
 * 状态不可变更新：每次动作深拷贝一份草稿，改完整体替换并通知订阅者。
 */
export class WorkshopStore {
  private state: State;
  private listeners = new Set<() => void>();
  private patchSeq = 1;
  private matSeq = 3; // 已有 MAT-A / MAT-B
  private extSeq = 1;
  private logSeq = 1;
  private lastQueueKey = "";

  constructor(seed: State) {
    this.state = seed;
    this.mutate((d) => {
      for (const z of d.zones) {
        if (z.status === "registered" && z.direction !== null) this.enqueueNewPatch(d, z, false);
      }
      this.log(d, "layout", `开账：已登记破损生成补块需求（含拼缝余量 ${SEAM_ALLOWED_TEXT}），开始初始排布`);
      this.allocate(d, "初始排布");
      const pending = d.zones.filter((z) => z.status === "pending");
      for (const z of pending) {
        this.log(d, "zone", `${z.id} ${z.label}：老档案缺绒头方向记录，先挂待确认`);
      }
    });
  }

  getState = (): State => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private mutate(fn: (draft: State) => void): void {
    const draft = structuredClone(this.state);
    fn(draft);
    this.state = draft;
    this.listeners.forEach((l) => l());
  }

  private log(d: State, kind: LogKind, text: string): void {
    d.log.unshift({ id: this.logSeq++, time: now(), kind, text });
    if (d.log.length > 80) d.log.length = 80;
  }

  /** 毯料当前全部占用：已有补块 + 已排布补块 */
  private occupied(d: State, materialId: string): OccupiedRect[] {
    const m = d.materials.find((x) => x.id === materialId);
    if (!m) return [];
    const fromExisting: OccupiedRect[] = m.existing.map((e) => ({ ...e.rect, label: e.label }));
    const fromPatches: OccupiedRect[] = d.patches
      .filter((p) => p.status === "placed" && p.placement?.materialId === materialId)
      .map((p) => ({ ...p.placement!.rect, label: p.id }));
    return [...fromExisting, ...fromPatches];
  }

  private enqueueNewPatch(d: State, zone: DamageZone, front: boolean): Patch {
    const patch: Patch = {
      id: `P-${String(this.patchSeq++).padStart(2, "0")}`,
      zoneId: zone.id,
      needW: zone.outline.w + SEAM_ALLOWANCE * 2,
      needH: zone.outline.h + SEAM_ALLOWANCE * 2,
      requiredDirection: zone.direction!,
      zoneRevision: zone.revision,
      status: "queued",
      placement: null,
      note: null,
    };
    d.patches.push(patch);
    if (front) d.queue.unshift(patch.id);
    else d.queue.push(patch.id);
    return patch;
  }

  /**
   * 按队列顺序自动排布：同产区选料，方向决定旋转角，避开已有占用。
   * 放不下的留在队列里等料。
   */
  private allocate(d: State, trigger: string): void {
    const still: string[] = [];
    const placedMsgs: string[] = [];
    const touched = new Set<string>();
    for (const pid of d.queue) {
      const patch = d.patches.find((p) => p.id === pid);
      if (!patch || patch.status !== "queued") continue;
      const zone = d.zones.find((z) => z.id === patch.zoneId)!;
      const carpet = d.carpets.find((c) => c.id === zone.carpetId)!;
      let placed = false;
      for (const m of d.materials) {
        if (m.origin !== carpet.origin) continue; // 同产区选料
        const rot = requiredRotation(m.direction, patch.requiredDirection);
        const size = rotatedSize(patch.needW, patch.needH, rot);
        const rect = firstFit(m, this.occupied(d, m.id), size.w, size.h);
        if (rect) {
          patch.status = "placed";
          patch.note = null;
          patch.placement = { materialId: m.id, rect, rotation: rot, materialVersion: m.version + 1 };
          touched.add(m.id);
          placedMsgs.push(
            `${patch.id}（${zone.label}）→ ${m.name} @(${rect.x},${rect.y}) 旋转${rot}°`
          );
          placed = true;
          break;
        }
      }
      if (!placed) still.push(pid);
    }
    d.queue = still;
    for (const m of d.materials) if (touched.has(m.id)) m.version += 1;
    if (placedMsgs.length) this.log(d, "layout", `${trigger}：${placedMsgs.join("；")}`);
    const key = still.join(",");
    if (still.length > 0 && key !== this.lastQueueKey) {
      this.log(d, "queue", `容量不够，${still.length} 块排队等料：${still.join("、")}`);
    }
    this.lastQueueKey = key;
  }

  /** 轮廓或方向改动：原位置立刻失效，按新版重算 */
  updateZone(zoneId: string, change: { outline?: Rect; direction?: Direction | null }): void {
    this.mutate((d) => {
      const zone = d.zones.find((z) => z.id === zoneId);
      if (!zone) return;
      const outChanged =
        change.outline !== undefined && JSON.stringify(change.outline) !== JSON.stringify(zone.outline);
      const dirChanged = change.direction !== undefined && change.direction !== zone.direction;
      if (!outChanged && !dirChanged) return;
      if (outChanged) zone.outline = change.outline!;
      if (dirChanged) zone.direction = change.direction!;
      zone.revision += 1;
      // 方向被清空 → 挂待确认；待确认区域选好角度后仍须「确认方向」才登记
      if (zone.direction === null) zone.status = "pending";

      const freed = new Set<string>();
      let invalidated = 0;
      for (const p of d.patches) {
        if (p.zoneId === zone.id && p.status !== "invalid") {
          p.status = "invalid";
          p.note = `第 ${zone.revision - 1} 版位置失效（轮廓/方向变更）`;
          if (p.placement) freed.add(p.placement.materialId);
          p.placement = null;
          invalidated += 1;
        }
      }
      d.queue = d.queue.filter((pid) => {
        const p = d.patches.find((x) => x.id === pid);
        return p !== undefined && p.status === "queued";
      });
      for (const m of d.materials) if (freed.has(m.id)) m.version += 1;
      d.staged = null;
      d.lastSubmit = null;

      const what = [outChanged ? "轮廓" : "", dirChanged ? "方向" : ""].filter(Boolean).join("与");
      this.log(
        d,
        "zone",
        `${zone.id} ${zone.label} ${what}变更（第 ${zone.revision} 版）→ ${invalidated} 处原位置立刻失效，重算`
      );
      if (zone.status === "registered") {
        this.enqueueNewPatch(d, zone, true);
      } else {
        this.log(d, "zone", `${zone.id} ${zone.label} 缺绒头方向记录，先挂待确认`);
      }
      this.allocate(d, "变更重算");
    });
  }

  /** 老档案补录绒头方向：确认后生成补块需求并排布 */
  confirmDirection(zoneId: string, direction: Direction): void {
    this.mutate((d) => {
      const zone = d.zones.find((z) => z.id === zoneId);
      if (!zone || zone.status !== "pending") return;
      zone.direction = direction;
      zone.status = "registered";
      zone.revision += 1;
      d.staged = null;
      d.lastSubmit = null;
      this.log(d, "confirm", `老档案方向确认：${zone.id} ${zone.label} 绒头 ${direction}°（第 ${zone.revision} 版），生成补块需求`);
      this.enqueueNewPatch(d, zone, true);
      this.allocate(d, "方向确认");
    });
  }

  /** 新毯料入库：自动尝试排空等料队列 */
  addMaterial(input: MaterialInput): void {
    this.mutate((d) => {
      const material: Material = {
        ...input,
        id: `MAT-${String.fromCharCode(64 + this.matSeq++)}`,
        version: 1,
        existing: [],
      };
      d.materials.push(material);
      d.staged = null;
      d.lastSubmit = null;
      this.log(
        d,
        "material",
        `新毯料入库：${material.id} ${material.name}（${material.origin}，${material.w}×${material.h}cm，绒头 ${material.direction}°）`
      );
      this.allocate(d, "新毯料入库");
    });
  }

  /** 暂存排布方案：基于毯料当前版本快照计算，不落地 */
  stagePlan(materialId: string): void {
    this.mutate((d) => {
      const m = d.materials.find((x) => x.id === materialId);
      if (!m) return;
      const occ = this.occupied(d, m.id);
      const proposals: Proposal[] = [];
      for (const pid of d.queue) {
        const patch = d.patches.find((p) => p.id === pid);
        if (!patch) continue;
        const zone = d.zones.find((z) => z.id === patch.zoneId)!;
        const carpet = d.carpets.find((c) => c.id === zone.carpetId)!;
        const rot = requiredRotation(m.direction, patch.requiredDirection);
        const size = rotatedSize(patch.needW, patch.needH, rot);
        const rect = firstFit(m, occ, size.w, size.h);
        if (rect) {
          proposals.push({ patchId: pid, rect, rotation: rot, crossOrigin: m.origin !== carpet.origin });
          occ.push({ ...rect, label: pid });
        }
      }
      if (!proposals.length) {
        this.log(d, "layout", `暂存失败：队列中的补块在 ${m.name} 上没有可排位置`);
        return;
      }
      d.staged = { materialId, baseVersion: m.version, proposals, createdAt: now() };
      d.lastSubmit = null;
      const cross = proposals.some((p) => p.crossOrigin) ? "（含跨产区用料，需大师傅确认）" : "";
      this.log(
        d,
        "layout",
        `已暂存排布方案（基于 ${m.name} v${m.version}）：${proposals.map((p) => p.patchId).join("、")}${cross}`
      );
    });
  }

  /** 模拟另一修复师向同一毯料抢先提交补块（版本号 +1） */
  simulateColleague(materialId: string): void {
    this.mutate((d) => {
      const m = d.materials.find((x) => x.id === materialId);
      if (!m) return;
      const rect = firstFit(m, this.occupied(d, m.id), 20, 16);
      if (!rect) {
        this.log(d, "conflict", `另一修复师在 ${m.name} 上未找到空位，未提交`);
        return;
      }
      const label = `同事补块·${m.id}`;
      m.existing.push({ id: `EXT-${this.extSeq++}`, rect: { ...rect, w: 20, h: 16 }, label });
      const v = m.version;
      m.version += 1;
      this.log(d, "conflict", `另一修复师向 ${m.name} 提交补块 @(${rect.x},${rect.y}) 20×16（v${v}→v${m.version}）`);
    });
  }

  /** 提交暂存方案：版本不一致则整单退回，报告冲突位置 */
  submitStaged(): void {
    this.mutate((d) => {
      const s = d.staged;
      if (!s) return;
      const m = d.materials.find((x) => x.id === s.materialId)!;
      const occ = this.occupied(d, m.id);
      const conflicts: ConflictInfo[] = s.proposals
        .map((p) => ({
          patchId: p.patchId,
          rect: p.rect,
          rotation: p.rotation,
          overlaps: occ.filter((o) => overlaps(o, p.rect)).map((o) => o.label),
        }))
        .filter((c) => c.overlaps.length > 0);

      if (m.version !== s.baseVersion || conflicts.length > 0) {
        for (const c of conflicts) {
          const patch = d.patches.find((p) => p.id === c.patchId);
          if (patch) patch.note = "提交冲突，退回排队等料";
        }
        const reason = m.version !== s.baseVersion ? "毯料已被他人更新" : "位置已被占用";
        d.lastSubmit = {
          ok: false,
          reason,
          materialId: m.id,
          baseVersion: s.baseVersion,
          currentVersion: m.version,
          conflicts,
        };
        d.staged = null;
        const detail = conflicts.length
          ? `，冲突位置：${conflicts
              .map((c) => `${c.patchId} @(${c.rect.x},${c.rect.y}) ↔ ${c.overlaps.join("/")}`)
              .join("；")}`
          : "";
        this.log(
          d,
          "conflict",
          `提交被拒：${m.name} ${reason}（v${s.baseVersion}→v${m.version}）${detail}，整单退回排队等料`
        );
        return;
      }

      for (const p of s.proposals) {
        const patch = d.patches.find((x) => x.id === p.patchId)!;
        patch.status = "placed";
        patch.note = null;
        patch.placement = {
          materialId: m.id,
          rect: p.rect,
          rotation: p.rotation,
          materialVersion: m.version + 1,
        };
        occ.push({ ...p.rect, label: patch.id });
      }
      d.queue = d.queue.filter((pid) => !s.proposals.some((pp) => pp.patchId === pid));
      m.version += 1;
      d.lastSubmit = {
        ok: true,
        reason: null,
        materialId: m.id,
        baseVersion: s.baseVersion,
        currentVersion: m.version,
        conflicts: [],
      };
      d.staged = null;
      this.lastQueueKey = d.queue.join(",");
      this.log(
        d,
        "layout",
        `提交成功：${s.proposals.map((p) => p.patchId).join("、")} 排入 ${m.name}（v${m.version}）`
      );
    });
  }
}

export function selectMetrics(s: State) {
  const active = s.patches.filter((p) => p.status !== "invalid");
  const placed = active.filter((p) => p.status === "placed").length;
  return {
    pendingZones: s.zones.filter((z) => z.status === "pending").length,
    queued: s.queue.length,
    placed,
    total: active.length,
    donePct: active.length ? Math.round((placed / active.length) * 100) : 0,
  };
}

export function carpetProgress(s: State, carpetId: string) {
  const zoneIds = new Set(s.zones.filter((z) => z.carpetId === carpetId).map((z) => z.id));
  const patches = s.patches.filter((p) => zoneIds.has(p.zoneId) && p.status !== "invalid");
  const placed = patches.filter((p) => p.status === "placed").length;
  const pending = s.zones.filter((z) => z.carpetId === carpetId && z.status === "pending").length;
  return { placed, total: patches.length, pending };
}
