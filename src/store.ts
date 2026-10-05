// 修复档案数据层：localStorage 持久化 + 版本级并发控制
// 规则：
// 1. 破损登记轮廓与绒头方向；缺方向记录挂「待确认」
// 2. 选料避开已有补块、留拼缝余量，方向跟着原毯走
// 3. 轮廓/方向改动 → 原排布立即失效重算
// 4. 两人同时提交同一块毯料 → 后到者看到冲突位置（毯料版本号比对）
// 5. 容量不够 → 排队等料，新毯料入库后 FIFO 自动排布
// 6. 排布状态与进度在同一次更新里联动

import { useCallback, useEffect, useState } from "react";
import type {
  DamageRecord,
  DB,
  Material,
  PlaceOutcome,
  PlacedPatch,
  Point,
} from "./types";
import {
  directionMatches,
  findPlacement,
  patchRect,
  rectsOverlap,
  withPatch,
} from "./nesting";

const STORAGE_KEY = "carpet-repair-archive-v1";

const DAY = 86400000;

function seedDB(): DB {
  const t = Date.now();
  const materials: Material[] = [
    {
      id: "M-01",
      name: "旧毯料 M-01（波斯毯余料）",
      width: 120,
      height: 80,
      pileDirection: 90,
      version: 1,
      patches: [
        {
          id: "P-SEED-1",
          damageId: "DMG-001",
          carpetId: "CAR-092",
          x: 10,
          y: 10,
          w: 61,
          h: 56,
          pileDirection: 90,
          worker: "工位A",
          placedAt: t - DAY * 2,
        },
        {
          id: "P-SEED-OLD",
          damageId: "DMG-OLD",
          carpetId: "CAR-064（旧补块）",
          x: 80,
          y: 10,
          w: 30,
          h: 60,
          pileDirection: 90,
          worker: "工位B",
          placedAt: t - DAY * 20,
        },
      ],
    },
    {
      id: "M-02",
      name: "旧毯料 M-02（安纳托利亚余料）",
      width: 100,
      height: 90,
      pileDirection: 0,
      version: 1,
      patches: [],
    },
    {
      id: "M-03",
      name: "旧毯料 M-03（小块余料）",
      width: 50,
      height: 50,
      pileDirection: 0,
      version: 1,
      patches: [],
    },
  ];

  const damages: DamageRecord[] = [
    {
      id: "DMG-001",
      carpetId: "CAR-092",
      outline: [
        { x: 30, y: 40 },
        { x: 70, y: 35 },
        { x: 80, y: 70 },
        { x: 45, y: 85 },
        { x: 25, y: 65 },
      ],
      pileDirection: 90,
      seamAllowance: 3,
      status: "已排布",
      progress: 70,
      version: 1,
      layout: {
        status: "placed",
        materialId: "M-01",
        x: 10,
        y: 10,
        w: 61,
        h: 56,
        computedAtVersion: 1,
      },
      createdAt: t - DAY * 3,
    },
    {
      id: "DMG-002",
      carpetId: "CAR-117",
      outline: [
        { x: 20, y: 20 },
        { x: 60, y: 25 },
        { x: 55, y: 60 },
        { x: 25, y: 55 },
      ],
      pileDirection: 0,
      seamAllowance: 3,
      status: "待排料",
      progress: 10,
      version: 1,
      layout: null,
      createdAt: t - DAY * 2,
    },
    {
      // 老档案：缺绒头方向记录，先挂待确认
      id: "DMG-003",
      carpetId: "CAR-138",
      outline: [
        { x: 10, y: 10 },
        { x: 40, y: 15 },
        { x: 35, y: 45 },
        { x: 12, y: 40 },
      ],
      pileDirection: null,
      seamAllowance: 3,
      status: "待确认",
      progress: 0,
      version: 1,
      layout: null,
      createdAt: t - DAY * 40,
    },
    {
      // 容量不够排队等料：M-01 排满、M-03 方向不一致
      id: "DMG-004",
      carpetId: "CAR-205",
      outline: [
        { x: 60, y: 60 },
        { x: 95, y: 65 },
        { x: 90, y: 100 },
        { x: 65, y: 95 },
      ],
      pileDirection: 90,
      seamAllowance: 3,
      status: "等料",
      progress: 25,
      version: 1,
      layout: null,
      createdAt: t - DAY,
    },
  ];

  return { damages, materials };
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    // 解析失败则重建种子
  }
  return seedDB();
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/**
 * 尝试为一条破损记录自动套裁：
 * 方向一致 → 找最低左靠位置 → 排下（已排布，进度 70）；
 * 所有毯料都放不下 → 进等料队列（进度 25）。
 * 纯函数，返回新对象。
 */
function tryPlace(
  damage: DamageRecord,
  materials: Material[]
): { damage: DamageRecord; materials: Material[] } {
  if (damage.pileDirection == null) {
    return { damage, materials };
  }
  const rect = patchRect(damage);
  for (const mat of materials) {
    if (!directionMatches(damage.pileDirection, mat.pileDirection)) continue;
    if (rect.w > mat.width || rect.h > mat.height) continue;
    const pos = findPlacement(mat, rect.w, rect.h);
    if (!pos) continue;
    const patch: PlacedPatch = {
      id: nextId("P"),
      damageId: damage.id,
      carpetId: damage.carpetId,
      x: pos.x,
      y: pos.y,
      w: rect.w,
      h: rect.h,
      pileDirection: damage.pileDirection,
      worker: "工位A",
      placedAt: Date.now(),
    };
    const placed: DamageRecord = {
      ...damage,
      status: "已排布",
      progress: 70,
      layout: {
        status: "placed",
        materialId: mat.id,
        x: pos.x,
        y: pos.y,
        w: rect.w,
        h: rect.h,
        computedAtVersion: damage.version,
      },
    };
    return { damage: placed, materials: materials.map((m) => (m.id === mat.id ? withPatch(m, patch) : m)) };
  }
  return {
    damage: { ...damage, status: "等料", progress: 25, layout: null },
    materials,
  };
}

/** 新毯料入库后，FIFO 处理等料队列 */
function processQueue(
  damages: DamageRecord[],
  materials: Material[]
): { damages: DamageRecord[]; materials: Material[] } {
  let nextMaterials = materials;
  const nextDamages = damages.map((d) => {
    if (d.status !== "等料") return d;
    const result = tryPlace(d, nextMaterials);
    nextMaterials = result.materials;
    return result.damage;
  });
  return { damages: nextDamages, materials: nextMaterials };
}

/** 撤掉某条破损记录已排的补块（轮廓/方向改动时作废排布） */
function removePatch(
  damageId: string,
  materials: Material[]
): Material[] {
  return materials.map((m) => ({
    ...m,
    patches: m.patches.filter((p) => p.damageId !== damageId),
  }));
}

export interface DamageInput {
  carpetId: string;
  outline: Point[];
  pileDirection: number | null;
  seamAllowance: number;
}

export function useRepairStore() {
  const [db, setDb] = useState<DB>(loadDB);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }, [db]);

  /** 登记破损：轮廓 + 绒头方向；缺方向先挂待确认，否则自动套裁。返回新档案 id */
  const addDamage = useCallback((input: DamageInput): string => {
    const id = nextId("DMG");
    setDb((prev) => {
      const noDirection = input.pileDirection == null;
      const damage: DamageRecord = {
        id,
        carpetId: input.carpetId.trim() || "未命名地毯",
        outline: input.outline,
        pileDirection: input.pileDirection,
        seamAllowance: input.seamAllowance,
        status: noDirection ? "待确认" : "待排料",
        progress: noDirection ? 0 : 10,
        version: 1,
        layout: null,
        createdAt: Date.now(),
      };
      let materials = prev.materials;
      let placed = damage;
      if (!noDirection) {
        const result = tryPlace(damage, materials);
        placed = result.damage;
        materials = result.materials;
      }
      return { damages: [...prev.damages, placed], materials };
    });
    return id;
  }, []);

  /** 轮廓改动：版本 +1，原排布立即失效，撤下补块重算 */
  const updateOutline = useCallback((damageId: string, outline: Point[]) => {
    setDb((prev) => {
      const target = prev.damages.find((d) => d.id === damageId);
      if (!target) return prev;
      const bumped: DamageRecord = {
        ...target,
        outline,
        version: target.version + 1,
        layout: null,
        status: target.pileDirection == null ? "待确认" : "待排料",
        progress: target.pileDirection == null ? 0 : 10,
      };
      const materials = removePatch(damageId, prev.materials);
      if (bumped.pileDirection == null) {
        return {
          damages: prev.damages.map((d) => (d.id === damageId ? bumped : d)),
          materials,
        };
      }
      const result = tryPlace(bumped, materials);
      return {
        damages: prev.damages.map((d) => (d.id === damageId ? result.damage : d)),
        materials: result.materials,
      };
    });
  }, []);

  /** 方向改动（含待确认补录方向）：版本 +1，失效重算 */
  const updateDirection = useCallback((damageId: string, direction: number | null) => {
    setDb((prev) => {
      const target = prev.damages.find((d) => d.id === damageId);
      if (!target) return prev;
      const bumped: DamageRecord = {
        ...target,
        pileDirection: direction,
        version: target.version + 1,
        layout: null,
        status: direction == null ? "待确认" : "待排料",
        progress: direction == null ? 0 : 10,
      };
      const materials = removePatch(damageId, prev.materials);
      if (direction == null) {
        return {
          damages: prev.damages.map((d) => (d.id === damageId ? bumped : d)),
          materials,
        };
      }
      const result = tryPlace(bumped, materials);
      return {
        damages: prev.damages.map((d) => (d.id === damageId ? result.damage : d)),
        materials: result.materials,
      };
    });
  }, []);

  /**
   * 手动提交排布（选了具体毯料）。
   * 提交时携带界面渲染时的毯料版本号；
   * 若期间另一工位已提交（版本变大），后到者看到冲突位置。
   */
  const submitLayout = useCallback(
    (damageId: string, materialId: string, expectedVersion: number): PlaceOutcome => {
      let outcome: PlaceOutcome = { ok: false };
      setDb((prev) => {
        const damage = prev.damages.find((d) => d.id === damageId);
        const material = prev.materials.find((m) => m.id === materialId);
        if (!damage || !material) return prev;
        if (damage.pileDirection == null) {
          outcome = { ok: false, reason: "no-direction" };
          return prev;
        }
        if (!directionMatches(damage.pileDirection, material.pileDirection)) {
          outcome = { ok: false, reason: "direction" };
          return prev;
        }
        // 候选位置（先算好，冲突红框要落在这个位置上）
        const rect = patchRect(damage);
        const pos = findPlacement(material, rect.w, rect.h);
        // 并发冲突：后到者提交时版本已被对方改掉
        if (material.version !== expectedVersion) {
          const conflictPatch =
            pos &&
            material.patches.find(
              (p) =>
                p.worker === "工位B" &&
                rectsOverlap({ x: pos.x, y: pos.y, w: rect.w, h: rect.h }, p)
            );
          const conflict: DamageRecord = {
            ...damage,
            status: "冲突",
            progress: 40,
            layout: pos
              ? {
                  status: "conflict",
                  materialId,
                  x: pos.x,
                  y: pos.y,
                  w: rect.w,
                  h: rect.h,
                  computedAtVersion: damage.version,
                  conflictPatchId: conflictPatch?.id,
                }
              : damage.layout,
          };
          outcome = { ok: false, reason: "conflict", damage: conflict, conflictPatch };
          return {
            damages: prev.damages.map((d) => (d.id === damageId ? conflict : d)),
            materials: prev.materials,
          };
        }
        // 空位不足 → 排队等料
        if (!pos) {
          const queued: DamageRecord = {
            ...damage,
            status: "等料",
            progress: 25,
            layout: null,
          };
          outcome = { ok: false, reason: "queued", damage: queued };
          return {
            damages: prev.damages.map((d) => (d.id === damageId ? queued : d)),
            materials: prev.materials,
          };
        }
        const patch: PlacedPatch = {
          id: nextId("P"),
          damageId: damage.id,
          carpetId: damage.carpetId,
          x: pos.x,
          y: pos.y,
          w: rect.w,
          h: rect.h,
          pileDirection: damage.pileDirection,
          worker: "工位A",
          placedAt: Date.now(),
        };
        const placed: DamageRecord = {
          ...damage,
          status: "已排布",
          progress: 70,
          layout: {
            status: "placed",
            materialId,
            x: pos.x,
            y: pos.y,
            w: rect.w,
            h: rect.h,
            computedAtVersion: damage.version,
          },
        };
        outcome = { ok: true, damage: placed };
        return {
          damages: prev.damages.map((d) => (d.id === damageId ? placed : d)),
          materials: prev.materials.map((m) => (m.id === materialId ? withPatch(m, patch) : m)),
        };
      });
      return outcome;
    },
    []
  );

  /**
   * 模拟「另一工位同时提交同一块毯料」：
   * 工位B 抢先在候选位置落一块补块，毯料版本 +1；
   * 随后工位A 再提交（携带旧版本）→ 冲突，界面红框标出冲突位置。
   */
  const simulateConcurrentSubmit = useCallback(
    (damageId: string, materialId: string): PlaceOutcome => {
      let outcome: PlaceOutcome = { ok: false };
      setDb((prev) => {
        const damage = prev.damages.find((d) => d.id === damageId);
        const material = prev.materials.find((m) => m.id === materialId);
        if (!damage || !material || damage.pileDirection === null) return prev;
        if (!directionMatches(damage.pileDirection, material.pileDirection)) {
          outcome = { ok: false, reason: "direction" };
          return prev;
        }
        // 候选位置（先算好，冲突红框要落在这个位置上）
        const rect = patchRect(damage);
        const pos = findPlacement(material, rect.w, rect.h);
        if (!pos) {
          // 没有空位，抢料也无从抢起
          outcome = { ok: false, reason: "queued" };
          return prev;
        }
        // 工位B 抢先提交
        const rival: PlacedPatch = {
          id: nextId("P"),
          damageId: "DMG-RIVAL",
          carpetId: "CAR-另一工位",
          x: pos.x,
          y: pos.y,
          w: rect.w,
          h: rect.h,
          pileDirection: damage.pileDirection,
          worker: "工位B",
          placedAt: Date.now(),
        };
        const materialAfterB = withPatch(material, rival);
        // 工位A 后到，仍拿旧版本号提交 → 冲突
        const conflict: DamageRecord = {
          ...damage,
          status: "冲突",
          progress: 40,
          layout: {
            status: "conflict",
            materialId,
            x: pos.x,
            y: pos.y,
            w: rect.w,
            h: rect.h,
            computedAtVersion: damage.version,
            conflictPatchId: rival.id,
          },
        };
        outcome = { ok: false, reason: "conflict", damage: conflict, conflictPatch: rival };
        return {
          damages: prev.damages.map((d) => (d.id === damageId ? conflict : d)),
          materials: prev.materials.map((m) => (m.id === materialId ? materialAfterB : m)),
        };
      });
      return outcome;
    },
    []
  );

  /** 新毯料入库：先落下，再 FIFO 处理等料队列 */
  const addMaterial = useCallback((input: { name: string; width: number; height: number; pileDirection: number }) => {
    setDb((prev) => {
      const material: Material = {
        id: nextId("M"),
        name: input.name.trim() || "新入库旧毯料",
        width: input.width,
        height: input.height,
        pileDirection: input.pileDirection,
        patches: [],
        version: 1,
      };
      const { damages, materials } = processQueue(prev.damages, [...prev.materials, material]);
      return { damages, materials };
    });
  }, []);

  /** 冲突/排队解除后重新排布（自动选第一块方向匹配且有空位的毯料） */
  const retryLayout = useCallback((damageId: string) => {
    setDb((prev) => {
      const target = prev.damages.find((d) => d.id === damageId);
      if (!target) return prev;
      const cleared: DamageRecord = { ...target, status: "待排料", progress: 10, layout: null };
      const result = tryPlace(cleared, prev.materials);
      return {
        damages: prev.damages.map((d) => (d.id === damageId ? result.damage : d)),
        materials: result.materials,
      };
    });
  }, []);

  /** 完工：排布状态 → 已修补，进度 100 */
  const finishRepair = useCallback((damageId: string) => {
    setDb((prev) => ({
      damages: prev.damages.map((d) =>
        d.id === damageId ? { ...d, status: "已修补", progress: 100 } : d
      ),
      materials: prev.materials,
    }));
  }, []);

  return {
    db,
    actions: {
      addDamage,
      updateOutline,
      updateDirection,
      submitLayout,
      simulateConcurrentSubmit,
      addMaterial,
      retryLayout,
      finishRepair,
    },
  };
}

export type RepairStore = ReturnType<typeof useRepairStore>;
