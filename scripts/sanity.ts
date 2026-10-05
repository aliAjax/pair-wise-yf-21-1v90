/**
 * 领域逻辑自检：node 环境直接跑（需 tsx 或 node>=22 的 strip-types）。
 * 覆盖：初始排布与等料、失效重算、双人提交冲突、待确认与入库排产。
 */
import { WorkshopStore } from "../src/domain/store.ts";
import { buildSeed } from "../src/domain/seed.ts";

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log("ok -", msg);
  else {
    failed += 1;
    console.error("FAIL -", msg);
  }
}

// 场景 1：初始排布——同产区选料、避开已有补块、容量不够排队等料
{
  const s = new WorkshopStore(buildSeed());
  const st = s.getState();
  const p01 = st.patches.find((p) => p.zoneId === "Z-01")!;
  assert(p01.status === "placed" && p01.placement!.materialId === "MAT-A", "Z-01 排入同产区 MAT-A");
  assert(p01.placement!.rect.x === 12 && p01.placement!.rect.y === 0, "Z-01 避开已有补块落在 (12,0)");
  assert(p01.placement!.rotation === 0, "Z-01 绒头 90° 对毯料 90°，旋转 0°");
  assert(st.queue.length === 1, "初始 1 块容量不够排队等料");
  const queued = st.patches.find((p) => p.id === st.queue[0])!;
  assert(queued.zoneId === "Z-05" && queued.needW === 12 && queued.needH === 26, "Z-05 需求尺寸含拼缝余量 12×26");
  const z04 = st.zones.find((z) => z.id === "Z-04")!;
  assert(z04.status === "pending" && !st.patches.some((p) => p.zoneId === "Z-04"), "老档案缺方向挂待确认，不生成补块");
}

// 场景 2：轮廓/方向改动 → 原位置立刻失效重算
{
  const s = new WorkshopStore(buildSeed());
  const v0 = s.getState().materials.find((m) => m.id === "MAT-A")!.version;
  s.updateZone("Z-01", { direction: 0 });
  let st = s.getState();
  assert(st.patches.some((p) => p.zoneId === "Z-01" && p.status === "invalid"), "方向一改，Z-01 原补块立刻失效");
  const pNew = st.patches.find((p) => p.zoneId === "Z-01" && p.status === "placed")!;
  assert(pNew.zoneRevision === 2 && pNew.placement!.rotation === 270, "第 2 版补块按新方向重算（旋转 270°）");
  assert(st.materials.find((m) => m.id === "MAT-A")!.version > v0, "失效释放后毯料版本递增");
}

// 场景 2b：轮廓改动同样失效重算（独立台账）
{
  const s = new WorkshopStore(buildSeed());
  s.updateZone("Z-02", { outline: { x: 90, y: 60, w: 20, h: 10 } });
  const st = s.getState();
  assert(st.patches.some((p) => p.zoneId === "Z-02" && p.status === "invalid"), "轮廓一改，Z-02 原补块立刻失效");
  const p02 = st.patches.find((p) => p.zoneId === "Z-02" && p.status === "placed")!;
  assert(p02.needW === 24 && p02.needH === 14, "轮廓改动后需求尺寸按新轮廓+余量重算");
  assert(p02.placement!.rect.x === 0 && p02.placement!.rect.y === 12, "Z-02 重算后落在 (0,12)");
}

// 场景 3：两人同时提交一块毯料，后到者看到冲突位置
{
  const s = new WorkshopStore(buildSeed());
  s.stagePlan("MAT-A");
  let st = s.getState();
  assert(st.staged !== null && st.staged.proposals.length === 1, "暂存 1 块排队补块的排布方案");
  assert(st.staged!.proposals[0].crossOrigin, "跨产区用料被标记特批");
  const base = st.staged!.baseVersion;
  s.simulateColleague("MAT-A");
  s.submitStaged();
  st = s.getState();
  assert(st.lastSubmit !== null && !st.lastSubmit.ok, "后到者提交被拒");
  assert(st.lastSubmit!.baseVersion === base && st.lastSubmit!.currentVersion === base + 1, "版本号从快照到当前递增");
  assert(st.lastSubmit!.conflicts.length === 1, "看到 1 处冲突位置");
  assert(st.lastSubmit!.conflicts[0].overlaps.some((l) => l.includes("同事补块")), "冲突对方是同事补块");
  assert(st.queue.length === 1, "冲突补块退回排队等料");
  assert(st.patches.find((p) => p.id === st.queue[0])!.note !== null, "退回补块带冲突备注");
}

// 场景 3b：无竞争时暂存→提交直接成功（独立台账）
{
  const s = new WorkshopStore(buildSeed());
  s.stagePlan("MAT-A");
  s.submitStaged();
  const st = s.getState();
  assert(st.lastSubmit !== null && st.lastSubmit.ok, "无竞争时提交成功");
  assert(st.queue.length === 0, "队列排空");
  const p05 = st.patches.find((p) => p.zoneId === "Z-05" && p.status === "placed")!;
  assert(p05.placement!.rect.x === 12 && p05.placement!.rect.y === 12 && p05.placement!.rotation === 270, "Z-05 落在 MAT-A (12,12) 旋转 270°");
}

// 场景 4：老档案确认方向 → 等料 → 新毯料入库自动排产
{
  const s = new WorkshopStore(buildSeed());
  s.confirmDirection("Z-04", 270);
  let st = s.getState();
  assert(st.zones.find((z) => z.id === "Z-04")!.status === "registered", "方向确认后登记");
  assert(st.queue.length === 2, "藏毯无料，确认后与 Z-05 一起排队等料");

  s.addMaterial({ name: "安纳托利亚边料·丙", origin: "安纳托利亚", w: 30, h: 30, direction: 0 });
  st = s.getState();
  assert(st.queue.length === 1, "入库后 Z-05 上料，藏毯补块继续等料");
  assert(st.patches.some((p) => p.zoneId === "Z-05" && p.status === "placed"), "Z-05 已排布");

  s.addMaterial({ name: "藏毯余料·丁", origin: "藏毯", w: 20, h: 20, direction: 270 });
  st = s.getState();
  assert(st.queue.length === 0, "藏毯料入库后队列排空");
  const p04 = st.patches.find((p) => p.zoneId === "Z-04" && p.status === "placed")!;
  assert(p04.placement!.rotation === 0, "毯料绒头 270° 对需求 270°，旋转 0°");
}

if (failed > 0) {
  console.error(`\n${failed} 项未通过`);
  process.exit(1);
}
console.log("\n全部通过");
