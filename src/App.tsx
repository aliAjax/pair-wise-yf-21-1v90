import { useState } from "react";
import "./styles.css";
import { useWorkshop } from "./domain/runtime.ts";
import { selectMetrics } from "./domain/store.ts";
import { CarpetMap } from "./components/CarpetMap.tsx";
import { MaterialBoard } from "./components/MaterialBoard.tsx";
import { ZonePanel } from "./components/ZonePanel.tsx";
import { QueuePanel } from "./components/QueuePanel.tsx";
import { ProgressPanel } from "./components/ProgressPanel.tsx";
import { LogPanel } from "./components/LogPanel.tsx";
import { MaterialForm } from "./components/MaterialForm.tsx";

const CARPET_COLORS = ["#7c2d12", "#0f766e", "#b45309", "#6d28d9"];

function App() {
  const state = useWorkshop();
  const [originFilter, setOriginFilter] = useState("全部");
  const [carpetId, setCarpetId] = useState(state.carpets[0].id);
  const [zoneId, setZoneId] = useState<string | null>(null);

  const origins = ["全部", ...Array.from(new Set(state.carpets.map((c) => c.origin)))];
  const visibleCarpets = state.carpets.filter((c) => originFilter === "全部" || c.origin === originFilter);
  const carpet = state.carpets.find((c) => c.id === carpetId) ?? visibleCarpets[0] ?? state.carpets[0];
  const carpetZones = state.zones.filter((z) => z.carpetId === carpet.id);
  const metrics = selectMetrics(state);

  const colorOf = (zid: string) => {
    const zone = state.zones.find((z) => z.id === zid);
    const idx = state.carpets.findIndex((c) => c.id === zone?.carpetId);
    return CARPET_COLORS[Math.max(0, idx) % CARPET_COLORS.length];
  };
  const zoneName = (zid: string) => {
    const z = state.zones.find((x) => x.id === zid);
    return z ? `${z.id} ${z.label}` : zid;
  };

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62009 · 手工地毯修复工作室</p>
        <h1>补块套裁排布台</h1>
        <span>
          破损登记、旧毯料与补块排布一条线：登记轮廓与绒头方向，选料避开已有补块并留拼缝余量，方向跟着原毯走（反了灯下泛白）。
          轮廓或方向一改，原位置立刻失效重算；两人同时提交一块毯料，后到者看到冲突位置；容量不够的补块排队等料；
          老档案缺方向记录先挂待确认，排布与进度一起更新。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>缺方向待确认</small>
          <strong>{metrics.pendingZones}</strong>
        </article>
        <article>
          <small>排队等料</small>
          <strong>{metrics.queued}</strong>
        </article>
        <article>
          <small>已排布补块</small>
          <strong>{metrics.placed}</strong>
        </article>
        <article>
          <small>排布完工率</small>
          <strong>{metrics.donePct}%</strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>纹样档案</h2>
          <div className="chips">
            {origins.map((o) => (
              <button
                key={o}
                className={o === originFilter ? "chip-active" : ""}
                onClick={() => setOriginFilter(o)}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="carpet-list">
            {visibleCarpets.map((c) => (
              <button
                key={c.id}
                className={`carpet-item ${c.id === carpet.id ? "is-active" : ""}`}
                onClick={() => setCarpetId(c.id)}
              >
                <b>{c.id}</b> {c.name}
                <small>
                  {c.origin} · {c.era} · {c.knotDensity} · {c.material} · {c.dye}
                </small>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="heading">
            <div>
              <p>破损登记</p>
              <h2>
                {carpet.id} {carpet.name}
              </h2>
            </div>
            <span className="hint">绒头方向：0°=倒向毯尾（下），顺时针计</span>
          </div>
          <div className="register-grid">
            <CarpetMap carpet={carpet} zones={carpetZones} selectedId={zoneId} onSelect={setZoneId} />
            <ZonePanel zones={carpetZones} selectedId={zoneId} onSelect={setZoneId} />
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>选料套裁</p>
            <h2>毯料排布图</h2>
          </div>
          <span className="hint">
            灰斜纹=已有补块（需避开）· 彩块=已排补块（箭头为绒头方向）· 青虚线=暂存方案 · 红虚线=冲突位置
          </span>
        </div>
        <div className="boards">
          {state.materials.map((m) => (
            <MaterialBoard
              key={`${m.id}:v${m.version}`}
              material={m}
              patches={state.patches.filter((p) => p.status === "placed" && p.placement?.materialId === m.id)}
              staged={state.staged}
              conflicts={state.lastSubmit && !state.lastSubmit.ok && state.lastSubmit.materialId === m.id ? state.lastSubmit.conflicts : []}
              colorOf={colorOf}
              zoneName={zoneName}
            />
          ))}
        </div>
        <details className="intake">
          <summary>新毯料入库（入库后自动排空等料队列）</summary>
          <MaterialForm origins={origins.filter((o) => o !== "全部")} />
        </details>
      </section>

      <section className="workspace bottom">
        <section className="panel">
          <div className="heading">
            <div>
              <p>容量不够的补块</p>
              <h2>排队等料</h2>
            </div>
          </div>
          <QueuePanel state={state} zoneName={zoneName} />
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>排布与进度一起更新</p>
              <h2>进度与台账动态</h2>
            </div>
          </div>
          <ProgressPanel state={state} />
          <LogPanel state={state} />
        </section>
      </section>
    </main>
  );
}

export default App;
