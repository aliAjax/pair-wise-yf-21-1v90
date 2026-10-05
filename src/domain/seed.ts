import type { State } from "./types.ts";

/**
 * 开账数据：
 * - CAR-138 的 Z-04 是老档案，缺绒头方向 → 待确认；
 * - MAT-B 容量有限，Z-05 的补块排不下 → 初始即在排队等料；
 * - 两块毯料上都已有旧补块，排布必须避开。
 */
export function buildSeed(): State {
  return {
    carpets: [
      {
        id: "CAR-092",
        name: "波斯喀山纹毯",
        origin: "波斯",
        era: "约1960s",
        knotDensity: "42 结/cm²",
        material: "羊毛",
        dye: "植物染",
        w: 200,
        h: 140,
      },
      {
        id: "CAR-117",
        name: "安纳托利亚祈祷毯",
        origin: "安纳托利亚",
        era: "约1950s",
        knotDensity: "36 结/cm²",
        material: "羊毛",
        dye: "植物染",
        w: 180,
        h: 120,
      },
      {
        id: "CAR-138",
        name: "藏毯·莲花纹",
        origin: "藏毯",
        era: "老档案·年代待考",
        knotDensity: "30 结/cm²",
        material: "牦牛毛",
        dye: "靛蓝植物染",
        w: 160,
        h: 90,
      },
    ],
    zones: [
      {
        id: "Z-01",
        carpetId: "CAR-092",
        label: "左上边缘磨损",
        outline: { x: 8, y: 6, w: 14, h: 8 },
        direction: 90,
        status: "registered",
        revision: 1,
      },
      {
        id: "Z-02",
        carpetId: "CAR-092",
        label: "中心奖章缺口",
        outline: { x: 90, y: 60, w: 8, h: 8 },
        direction: 90,
        status: "registered",
        revision: 1,
      },
      {
        id: "Z-03",
        carpetId: "CAR-117",
        label: "主纹缺口",
        outline: { x: 60, y: 40, w: 18, h: 16 },
        direction: 0,
        status: "registered",
        revision: 1,
      },
      {
        id: "Z-04",
        carpetId: "CAR-138",
        label: "肩部褪色区",
        outline: { x: 40, y: 30, w: 10, h: 8 },
        direction: null,
        status: "pending",
        revision: 1,
      },
      {
        id: "Z-05",
        carpetId: "CAR-117",
        label: "右缘裂口",
        outline: { x: 150, y: 20, w: 8, h: 22 },
        direction: 0,
        status: "registered",
        revision: 1,
      },
    ],
    materials: [
      {
        id: "MAT-A",
        name: "波斯残片·甲",
        origin: "波斯",
        w: 40,
        h: 30,
        direction: 90,
        version: 1,
        existing: [{ id: "EX-A1", rect: { x: 2, y: 2, w: 10, h: 8 }, label: "旧补块·甲1" }],
      },
      {
        id: "MAT-B",
        name: "安纳托利亚残片",
        origin: "安纳托利亚",
        w: 46,
        h: 26,
        direction: 0,
        version: 1,
        existing: [{ id: "EX-B1", rect: { x: 30, y: 2, w: 12, h: 10 }, label: "旧补块·乙1" }],
      },
    ],
    patches: [],
    queue: [],
    staged: null,
    lastSubmit: null,
    log: [],
  };
}
