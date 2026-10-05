import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import CarpetCanvas from "./components/CarpetCanvas";
import MaterialCanvas from "./components/MaterialCanvas";
import { useRepairStore } from "./store";
import type { DamageStatus, Point } from "./types";
import { directionMatches, findPlacement, patchRect } from "./nesting";

const STATUS_LABEL: Record<DamageStatus, string> = {
  待确认: "待确认",
  待排料: "待排料",
  等料: "等料",
  冲突: "冲突",
  已排布: "已排布",
  已修补: "已修补",
};

const STATUS_COLOR: Record<DamageStatus, string> = {
  待确认: "#94a3b8",
  待排料: "#b45309",
  等料: "#a16207",
  冲突: "#dc2626",
  已排布: "#0f766e",
  已修补: "#15803d",
};

const DIR_PRESETS = [0, 45, 90, 135];

export default function App() {
  const { db, actions } = useRepairStore();
  const { damages, materials } = db;

  const [selectedId, setSelectedId] = useState<string>(damages[0]?.id ?? "");
  const [chosenMaterialId, setChosenMaterialId] = useState<string>(materials[0]?.id ?? "");
  const [editing, setEditing] = useState(false);

  // 登记表单
  const [draftCarpetId, setDraftCarpetId] = useState("");
  const [draftSeam, setDraftSeam] = useState(3);
  const [draftDir, setDraftDir] = useState<number>(90);
  const [draftNoDir, setDraftNoDir] = useState(false);
  const [draftOutline, setDraftOutline] = useState<Point[]>([]);

  // 新毯料入库表单
  const [matName, setMatName] = useState("");
  const [matW, setMatW] = useState(100);
  const [matH, setMatH] = useState(80);
  const [matDir, setMatDir] = useState(90);

  const selected = useMemo(
    () => damages.find((d) => d.id === selectedId) ?? null,
    [damages, selectedId]
  );
  const chosenMaterial = useMemo(
    () => materials.find((m) => m.id === chosenMaterialId) ?? null,
    [materials, chosenMaterialId]
  );

  const queue = damages.filter((d) => d.status === "等料");

  // 切换破损时，自动选第一块绒头方向匹配的毯料
  useEffect(() => {
    if (!selected) return;
    const stillValid =
      chosenMaterial &&
      (selected.pileDirection == null ||
        directionMatches(selected.pileDirection, chosenMaterial.pileDirection));
    if (!stillValid) {
      const first = materials.find(
        (m) => selected.pileDirection != null && directionMatches(selected.pileDirection, m.pileDirection)
      );
      setChosenMaterialId(first?.id ?? materials[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, materials]);

  const metrics = useMemo(
    () => [
      { label: "待确认", value: damages.filter((d) => d.status === "待确认").length },
      { label: "待排料", value: damages.filter((d) => d.status === "待排料").length },
      { label: "等料", value: queue.length },
      { label: "已排布", value: damages.filter((d) => d.status === "已排布").length },
    ],
    [damages, queue.length]
  );

  // 候选位置预览（绿色虚线）；冲突时不预览，改由红框标出冲突位置
  const preview = useMemo(() => {
    if (!selected || !chosenMaterial) return null;
    if (selected.status === "冲突" && selected.layout?.materialId === chosenMaterial.id) return null;
    if (selected.pileDirection == null) return null;
    if (!directionMatches(selected.pileDirection, chosenMaterial.pileDirection)) return null;
    const rect = patchRect(selected);
    const pos = findPlacement(chosenMaterial, rect.w, rect.h);
    return pos ? { x: pos.x, y: pos.y, w: rect.w, h: rect.h } : null;
  }, [selected, chosenMaterial]);

  const conflictLayout =
    selected?.status === "冲突" && selected.layout?.materialId === chosenMaterialId
      ? selected.layout
      : null;

  const registerDamage = () => {
    if (draftOutline.length < 3) return;
    const id = actions.addDamage({
      carpetId: draftCarpetId,
      outline: draftOutline,
      seamAllowance: draftSeam,
      pileDirection: draftNoDir ? null : draftDir,
    });
    setDraftOutline([]);
    setDraftCarpetId("");
    // 登记后定位到新档案
    setSelectedId(id);
  };

  const submit = () => {
    if (!selected || !chosenMaterial) return;
    const outcome = actions.submitLayout(selected.id, chosenMaterial.id, chosenMaterial.version);
    if (outcome.ok) {
      setEditing(false);
    }
  };

  const simulate = () => {
    if (!selected || !chosenMaterial) return;
    actions.simulateConcurrentSubmit(selected.id, chosenMaterial.id);
  };

  const enqueueMaterial = () => {
    actions.addMaterial({ name: matName, width: matW, height: matH, pileDirection: matDir });
    setMatName("");
  };

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62009 · Port 62009</p>
        <h1>地毯修复套裁排布档案</h1>
        <span>
          一块旧毯料常要套裁多块补块，绒头方向反了，补完在灯下泛白。这里把破损登记、旧毯料选料与补块排布接起来：
          选料避开已有补块、留拼缝余量、方向跟着原毯走；轮廓或方向一改，原位置立刻失效重算；
          两人同时提交同一块毯料，后到者看得到冲突位置；容量不够的补块排队等料，新料入库自动排布；
          老档案缺方向记录先挂待确认，排布与进度一起更新。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {queue.length > 0 && (
        <section className="banner queue-banner">
          <strong>等料队列（{queue.length}）：</strong>
          {queue.map((d) => (
            <span key={d.id} className="queue-chip">
              {d.carpetId} · {d.id}（{Math.round(patchRect(d).w)}×{Math.round(patchRect(d).h)}cm，绒头 {d.pileDirection}°）
            </span>
          ))}
          <span className="queue-hint">新毯料入库后按排队顺序自动排布</span>
        </section>
      )}

      <section className="workspace">
        {/* 左栏：破损档案 + 登记 */}
        <aside className="panel side-panel">
          <div className="heading">
            <div>
              <p>破损档案</p>
              <h2>登记与列表</h2>
            </div>
          </div>

          <div className="records damage-list">
            {damages.map((d) => (
              <article
                key={d.id}
                className={d.id === selectedId ? "active" : ""}
                onClick={() => {
                  setSelectedId(d.id);
                  setEditing(false);
                }}
              >
                <b style={{ background: STATUS_COLOR[d.status] }}>{d.status.slice(0, 1)}</b>
                <div>
                  <h3>
                    {d.carpetId}
                    <span
                      className="badge"
                      style={{ background: `${STATUS_COLOR[d.status]}1a`, color: STATUS_COLOR[d.status] }}
                    >
                      {STATUS_LABEL[d.status]}
                    </span>
                  </h3>
                  <p>
                    {d.id} · 绒头 {d.pileDirection == null ? "缺记录" : `${d.pileDirection}°`} · 拼缝 {d.seamAllowance}cm
                    {d.layout?.status === "placed" && d.layout.materialId ? ` · 排在 ${d.layout.materialId}` : ""}
                  </p>
                  <div className="progress">
                    <i style={{ width: `${d.progress}%`, background: STATUS_COLOR[d.status] }} />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="divider" />

          <div className="heading">
            <div>
              <p>新破损登记</p>
              <h3>轮廓 + 绒头方向</h3>
            </div>
          </div>
          <div className="form-stack">
            <label>
              <span>地毯编号</span>
              <input value={draftCarpetId} onChange={(e) => setDraftCarpetId(e.target.value)} placeholder="如 CAR-205" />
            </label>
            <label>
              <span>拼缝余量（cm）</span>
              <input
                type="number"
                min={0}
                value={draftSeam}
                onChange={(e) => setDraftSeam(Number(e.target.value))}
              />
            </label>
            <label>
              <span>绒头方向{draftNoDir ? "（老档案缺记录）" : ""}</span>
              <div className="dir-row">
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={draftDir}
                  disabled={draftNoDir}
                  onChange={(e) => setDraftDir(Number(e.target.value))}
                />
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={draftDir}
                  disabled={draftNoDir}
                  onChange={(e) => setDraftDir(Number(e.target.value))}
                />
                <span className="dir-deg">°</span>
              </div>
              <div className="chips">
                {DIR_PRESETS.map((deg) => (
                  <button key={deg} disabled={draftNoDir} onClick={() => setDraftDir(deg)}>
                    {deg}°
                  </button>
                ))}
              </div>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={draftNoDir}
                onChange={(e) => setDraftNoDir(e.target.checked)}
              />
              <span>老档案缺绒头方向记录，先挂「待确认」</span>
            </label>
            <CarpetCanvas
              outline={draftOutline}
              pileDirection={draftNoDir ? null : draftDir}
              seamAllowance={draftSeam}
              editable
              onChange={setDraftOutline}
              onDirectionChange={setDraftDir}
            />
            <button className="primary" onClick={registerDamage} disabled={draftOutline.length < 3}>
              登记破损并套裁
            </button>
            {draftOutline.length > 0 && (
              <button onClick={() => setDraftOutline([])}>清除轮廓重画</button>
            )}
          </div>
        </aside>

        {/* 右栏：轮廓图 + 套裁图 + 操作 */}
        {selected ? (
          <section className="panel detail-panel">
            <div className="heading">
              <div>
                <p>{selected.id} · {selected.carpetId}</p>
                <h2>
                  破损排布
                  <span
                    className="badge"
                    style={{ background: `${STATUS_COLOR[selected.status]}1a`, color: STATUS_COLOR[selected.status] }}
                  >
                    {STATUS_LABEL[selected.status]}
                  </span>
                </h2>
              </div>
              <div className="chips">
                {selected.status !== "已修补" && (
                  <button onClick={() => setEditing((v) => !v)}>
                    {editing ? "完成改轮廓" : "改轮廓/方向"}
                  </button>
                )}
                {selected.status === "已排布" && (
                  <button className="primary" onClick={() => actions.finishRepair(selected.id)}>
                    标记完工
                  </button>
                )}
              </div>
            </div>

            {selected.status === "冲突" && conflictLayout && (
              <section className="banner conflict-banner">
                <strong>排布冲突：</strong>
                另一工位已在 {chosenMaterial?.id} 的同一位置落了补块（红框处）。后到者版本过期，
                请另选一块毯料重新排布，或调整轮廓/方向后重算。
              </section>
            )}
            {selected.status === "等料" && (
              <section className="banner queue-banner">
                <strong>排队等料中：</strong>
                现有毯料都排不下这块补块（或绒头方向不一致）。新毯料入库后自动按序排布，也可手动选料提交。
              </section>
            )}
            {selected.status === "待确认" && (
              <section className="banner pending-banner">
                <strong>待确认：</strong>
                这份老档案缺绒头方向记录，排布已挂起。请在毯面图上拖动箭头转盘确认方向，确认后立即套裁。
              </section>
            )}

            <div className="detail-grid">
              <div>
                <h3>毯面轮廓（绒头 {selected.pileDirection == null ? "待确认" : `${selected.pileDirection}°`}）</h3>
                <CarpetCanvas
                  outline={selected.outline}
                  pileDirection={selected.pileDirection}
                  seamAllowance={selected.seamAllowance}
                  editable={editing && selected.status !== "已修补"}
                  onChange={(pts) => actions.updateOutline(selected.id, pts)}
                  onDirectionChange={(deg) => actions.updateDirection(selected.id, deg)}
                />
                {editing && selected.status !== "已修补" && (
                  <p className="edit-hint">
                    正在改轮廓/方向：每次改动都会让原排布立即失效并重算。
                  </p>
                )}
                <div className="progress big">
                  <i style={{ width: `${selected.progress}%`, background: STATUS_COLOR[selected.status] }} />
                  <span>{selected.progress}%</span>
                </div>
              </div>

              <div>
                <h3>旧毯料套裁（选料避开已有补块、留拼缝余量）</h3>
                <div className="chips material-chips">
                  {materials.map((m) => {
                    const dirOk = selected.pileDirection != null && directionMatches(selected.pileDirection, m.pileDirection);
                    const active = m.id === chosenMaterialId;
                    return (
                      <button
                        key={m.id}
                        className={active ? "active" : ""}
                        disabled={!dirOk}
                        title={
                          selected.pileDirection == null
                            ? "缺绒头方向记录"
                            : !dirOk
                              ? `绒头方向不一致（原毯 ${selected.pileDirection}° / 毯料 ${m.pileDirection}°），补上去灯下泛白`
                              : `${m.width}×${m.height}cm，已排 ${m.patches.length} 块`
                        }
                        onClick={() => setChosenMaterialId(m.id)}
                      >
                        {m.id} · {m.width}×{m.height}
                        {!dirOk ? "（方向不符）" : ` · ${m.patches.length}块`}
                      </button>
                    );
                  })}
                </div>

                {chosenMaterial ? (
                  <MaterialCanvas
                    material={chosenMaterial}
                    selectedDamage={selected}
                    preview={preview}
                    conflictLayout={conflictLayout}
                  />
                ) : (
                  <p className="edit-hint">暂无毯料，请先入库新毯料。</p>
                )}

                {selected.status !== "已修补" && selected.pileDirection != null && (
                  <div className="chips">
                    <button
                      className="primary"
                      onClick={submit}
                      disabled={!chosenMaterial || selected.status === "已排布"}
                    >
                      提交排布（工位A）
                    </button>
                    <button onClick={simulate} disabled={!chosenMaterial}>
                      模拟同事同时提交
                    </button>
                    {(selected.status === "冲突" || selected.status === "等料") && (
                      <button onClick={() => actions.retryLayout(selected.id)}>重新排布</button>
                    )}
                  </div>
                )}
                {selected.status === "已排布" && (
                  <p className="edit-hint">
                    补块已排在 {selected.layout?.materialId}（{Math.round(selected.layout?.x ?? 0)}, {Math.round(selected.layout?.y ?? 0)}），
                    可按拼缝余量下刀；改动轮廓或方向后此位置立即作废。
                  </p>
                )}
              </div>
            </div>

            <div className="divider" />

            <div className="heading">
              <div>
                <p>毯料库存</p>
                <h3>新毯料入库</h3>
              </div>
            </div>
            <div className="form-stack">
              <label>
                <span>毯料名称/编号</span>
                <input value={matName} onChange={(e) => setMatName(e.target.value)} placeholder="如 M-04 旧毯料" />
              </label>
              <div className="field-grid">
                <label>
                  <span>幅宽（cm）</span>
                  <input type="number" min={10} value={matW} onChange={(e) => setMatW(Number(e.target.value))} />
                </label>
                <label>
                  <span>幅高（cm）</span>
                  <input type="number" min={10} value={matH} onChange={(e) => setMatH(Number(e.target.value))} />
                </label>
              </div>
              <label>
                <span>毯料绒头方向</span>
                <div className="dir-row">
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={matDir}
                    onChange={(e) => setMatDir(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min={0}
                    max={359}
                    value={matDir}
                    onChange={(e) => setMatDir(Number(e.target.value))}
                  />
                  <span className="dir-deg">°</span>
                </div>
              </label>
              <button className="primary" onClick={enqueueMaterial}>
                入库并自动排布队列
              </button>
            </div>
          </section>
        ) : (
          <section className="panel detail-panel">
            <p>暂无档案，请先在左侧登记破损。</p>
          </section>
        )}
      </section>
    </main>
  );
}
