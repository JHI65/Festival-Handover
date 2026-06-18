import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { uid, sigColor, noInfo, festTimeToMin } from "../lib/utils";
import { QuickTable } from "./MonView";

const PLOT_COLS = 7;
const PLOT_ROWS = 5;
const PLOT_ICONS = [
  { icon: "🎤", label: "Voz" },
  { icon: "🥁", label: "Batería" },
  { icon: "🎸", label: "Guitarra" },
  { icon: "🎹", label: "Teclado" },
  { icon: "🎺", label: "Viento" },
  { icon: "🎻", label: "Cuerda" },
  { icon: "🔊", label: "Sub" },
  { icon: "📦", label: "Amp" },
  { icon: "💡", label: "Luz" },
  { icon: "📺", label: "Pantalla" },
  { icon: "🧍", label: "Persona" },
  { icon: "⬜", label: "Libre" },
];

function EscenarioCompactArtistCard({ a, T, dark }) {
  const chipBg = T.card2;
  const chipBorder = T.border;

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `0.5px solid ${T.border}`, borderLeft: "3px solid #2A6B6B", background: T.card }}>
      <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 500, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.text }}>
          {a.artist || "—"}
        </span>
        {a.escTecnico && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: T.text4, textTransform: "uppercase", letterSpacing: "0.06em" }}>técnico</div>
            <div style={{ fontSize: 13, fontWeight: 500, fontFamily: "monospace", color: T.text2 }}>{noInfo(a.escTecnico)}</div>
          </div>
        )}
      </div>

      {(a.escSignal || a.escConnection || a.escConsole) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 14px 10px", flexWrap: "wrap" }}>
          {a.escSignal && (
            <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: chipBg, border: `0.5px solid ${chipBorder}`, color: sigColor(a.escSignal) }}>
              {noInfo(a.escSignal)}
            </span>
          )}
          {a.escConnection && (
            <>
              {a.escSignal && <span style={{ color: T.text4, opacity: 0.5, fontSize: 12 }}>·</span>}
              <span style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: chipBg, border: `0.5px solid ${chipBorder}`, color: T.text2 }}>
                {noInfo(a.escConnection)}
              </span>
            </>
          )}
          {a.escConsole && (
            <>
              <span style={{ color: T.text4, opacity: 0.5, fontSize: 12 }}>·</span>
              <span style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: chipBg, border: `0.5px solid ${chipBorder}`, color: T.text3 }}>
                {noInfo(a.escConsole)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EscenarioView({ fest, stage, onEditFest, onBack, onDelete }) {
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [tab, setTab] = useState("bandas");
  const [dayIdx, setDayIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerCell, setPickerCell] = useState(null);
  const [pickerTab, setPickerTab] = useState("icon");
  const [selectedPlotId, setSelectedPlotId] = useState(null);
  const [customLabel, setCustomLabel] = useState("");
  const [sbDraft, setSbDraft] = useState({ name: "", from: "", to: "" });

  const esc = stage.escenario || { inputs: [], power: [], plot: [] };

  function saveEsc(updated) {
    const newStages = (fest.stages || []).map(s =>
      s.id === stage.id ? { ...s, escenario: updated } : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  // Inputs
  function addInput(entry) {
    saveEsc({ ...esc, inputs: [...(esc.inputs || []), { id: uid(), ch: entry.ch || "", source: entry.source || "", type: entry.type || "Mic" }] });
  }
  function editInput(id, field, val) {
    saveEsc({ ...esc, inputs: (esc.inputs || []).map(x => x.id === id ? { ...x, [field]: val } : x) });
  }
  function delInput(id) { saveEsc({ ...esc, inputs: (esc.inputs || []).filter(x => x.id !== id) }); }

  // Power
  function addPower(entry) {
    saveEsc({ ...esc, power: [...(esc.power || []), { id: uid(), grupo: entry.grupo || "", tomas: entry.tomas || "", kw: entry.kw || "", notas: entry.notas || "" }] });
  }
  function editPower(id, field, val) {
    saveEsc({ ...esc, power: (esc.power || []).map(x => x.id === id ? { ...x, [field]: val } : x) });
  }
  function delPower(id) { saveEsc({ ...esc, power: (esc.power || []).filter(x => x.id !== id) }); }

  // Plot
  const plotItems = esc.plot || [];
  const kindOf = (p) => p.kind || "icon";
  function cellItem(row, col) { return plotItems.find(p => p.row === row && p.col === col); }
  function placeAt(row, col, data) {
    const filtered = plotItems.filter(p => !(p.row === row && p.col === col));
    saveEsc({ ...esc, plot: [...filtered, { id: uid(), row, col, ...data }] });
  }
  function updateItem(id, patch) {
    saveEsc({ ...esc, plot: plotItems.map(p => p.id === id ? { ...p, ...patch } : p) });
  }
  function removeItem(id) { saveEsc({ ...esc, plot: plotItems.filter(p => p.id !== id) }); }

  const powerById = (id) => (esc.power || []).find(p => p.id === id);
  function inputsInRange(from, to) {
    const a = parseInt(from, 10), b = parseInt(to, 10);
    if (isNaN(a) && isNaN(b)) return [];
    const lo = isNaN(a) ? b : isNaN(b) ? a : Math.min(a, b);
    const hi = isNaN(b) ? a : isNaN(a) ? b : Math.max(a, b);
    return (esc.inputs || []).filter(i => { const n = parseInt(i.ch, 10); return !isNaN(n) && n >= lo && n <= hi; });
  }
  const rangeStr = (p) => (p.from && p.to) ? `${p.from}–${p.to}` : (p.from || p.to || "");

  const CAT = {
    icon:      { color: dark ? "#34d399" : "#16a34a", bg: dark ? "#064e3b" : "#dcfce7", border: dark ? "#10b981" : "#16a34a", glyph: "🎚️", label: "Instrumento" },
    subbox:    { color: dark ? "#60a5fa" : "#2563eb", bg: dark ? "#172554" : "#dbeafe", border: dark ? "#3b82f6" : "#2563eb", glyph: "🔌", label: "Subbox" },
    corriente: { color: dark ? "#fbbf24" : "#d97706", bg: dark ? "#422006" : "#fef3c7", border: dark ? "#D4A843" : "#d97706", glyph: "⚡", label: "Corriente" },
  };

  function renderPlotCell(item) {
    const k = kindOf(item);
    if (k === "subbox") return (
      <>
        <div style={{ fontSize: 13, lineHeight: 1 }}>🔌</div>
        <div style={{ fontSize: 8, fontWeight: 700, color: CAT.subbox.color, marginTop: 1, lineHeight: 1.05, textAlign: "center", wordBreak: "break-word", maxWidth: "100%" }}>{item.name || "SB"}</div>
        {rangeStr(item) && <div style={{ fontSize: 7, color: T.text4, lineHeight: 1 }}>{rangeStr(item)}</div>}
      </>
    );
    if (k === "corriente") {
      const g = powerById(item.refId);
      return (
        <>
          <div style={{ fontSize: 14, lineHeight: 1 }}>⚡</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: CAT.corriente.color, marginTop: 1, lineHeight: 1.05, textAlign: "center", wordBreak: "break-word", maxWidth: "100%" }}>{g?.grupo || "—"}</div>
          {g?.kw && <div style={{ fontSize: 7, color: T.text4, lineHeight: 1 }}>{g.kw}kW</div>}
        </>
      );
    }
    return (
      <>
        <div style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</div>
        <div style={{ fontSize: 7, color: T.text3, marginTop: 1, textAlign: "center", lineHeight: 1.1, wordBreak: "break-word", maxWidth: "100%" }}>{item.label}</div>
      </>
    );
  }

  const inputCols = [
    { key: "ch", placeholder: "CH", width: 44 },
    { key: "source", placeholder: "Nombre / Fuente", flex: 2 },
    { key: "type", placeholder: "Tipo", flex: 1, options: ["Mic", "DI", "Line", "SB", "MADI", "AES", "Otro"] },
  ];
  const powerCols = [
    { key: "grupo", placeholder: "Grupo", width: 60 },
    { key: "tomas", placeholder: "Tomas", width: 54 },
    { key: "kw", placeholder: "kW", width: 44 },
    { key: "notas", placeholder: "Notas", flex: 2 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ ...S.topBar, flexWrap: "wrap", rowGap: 8, padding: "10px 12px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <button onClick={onBack} style={S.backBtn}>‹</button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>
            {stage.name}
          </div>
          <div style={{ width: 36 }} />
        </div>

        {confirmDelete && (
          <div onClick={() => setConfirmDelete(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: "0 auto 20px" }} />
              <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em", marginBottom: 6 }}>Eliminar posición de escenario</div>
              <div style={{ fontSize: 13, color: T.text3, fontFamily: "'DM Mono',monospace", marginBottom: 24 }}>
                Se borrarán todos los inputs, grupos de corriente y el plano de {stage.name}. Esta acción no se puede deshacer.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", color: T.text3, fontFamily: "'DM Mono',monospace" }}>
                  Cancelar
                </button>
                <button onClick={onDelete} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily: "'DM Mono',monospace" }}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* tab pills */}
        <div style={{ display: "flex", gap: 4, background: T.card2, borderRadius: 10, padding: 3 }}>
          {[["bandas", "BANDAS"], ["inputs", "INPUTS"], ["power", "CORRIENTE"], ["plot", "PLANO"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "4px 10px", borderRadius: 8, fontSize: 11,
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
              border: "none",
              background: tab === id ? (dark ? "#334155" : "#0f172a") : "transparent",
              color: tab === id ? "#fff" : T.text4,
              transition: "all 0.2s",
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {tab === "bandas" && stage.days.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 14px 8px", background: T.topBar, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
          {stage.days.map((d, i) => {
            const dateLabel = d.date ? new Date(d.date + "T12:00").toLocaleDateString("es", { day: "numeric", month: "short" }) : null;
            return (
              <button key={d.id} onClick={() => setDayIdx(i)} style={{
                flexShrink: 0, padding: dateLabel ? "4px 12px" : "5px 12px", borderRadius: 20, fontSize: 12,
                fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
                whiteSpace: "nowrap", border: "none", lineHeight: 1.2,
                background: i === dayIdx ? (dark ? "#334155" : "#0f172a") : (dark ? "#1e293b" : "#f1f5f9"),
                color: i === dayIdx ? "#fff" : T.text4,
              }}>
                <div>{d.label}</div>
                {dateLabel && <div style={{ fontSize: 9, opacity: 0.7, fontFamily: "monospace", letterSpacing: 0, marginTop: 1 }}>{dateLabel}</div>}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>

        {tab === "bandas" && (() => {
          const day = stage.days[dayIdx] || stage.days[0];
          const artists = day ? [...(day.artists || [])].sort((a, b) => festTimeToMin(a.showStart) - festTimeToMin(b.showStart)) : [];
          const dayRulos = day?.rulos || [];
          const permRulos = stage.rulos || [];
          return (
            <div>
              {artists.length === 0 && (
                <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40, fontFamily: "monospace" }}>Sin artistas en este día</div>
              )}
              {artists.length > 0 && (
                <span style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Ficha compacta</span>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {artists.map(a => (
                  <EscenarioCompactArtistCard key={a.id} a={a} dayRulos={dayRulos} permRulos={permRulos} T={T} dark={dark} />
                ))}
              </div>
            </div>
          );
        })()}

        {tab === "inputs" && (
          <QuickTable
            items={esc.inputs || []}
            cols={inputCols}
            onAdd={addInput}
            onEdit={editInput}
            onDelete={delInput}
            T={T} S={S}
          />
        )}

        {tab === "power" && (
          <QuickTable
            items={esc.power || []}
            cols={powerCols}
            onAdd={addPower}
            onEdit={editPower}
            onDelete={delPower}
            T={T} S={S}
          />
        )}

        {tab === "plot" && (
          <div>
            <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 16, background: dark ? "#0b1220" : "#fbfdff", padding: 12, boxShadow: dark ? "none" : "inset 0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 22, marginBottom: 10, borderRadius: 7, background: T.card2, border: `1px solid ${T.border}`, color: T.text4, fontSize: 9, letterSpacing: "0.18em", fontFamily: "'Bebas Neue',sans-serif" }}>
                FONDO · BACKLINE
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${PLOT_COLS}, 1fr)`, gap: 5 }}>
                {Array.from({ length: PLOT_ROWS }, (_, row) =>
                  Array.from({ length: PLOT_COLS }, (_, col) => {
                    const item = cellItem(row, col);
                    const sel = item && selectedPlotId === item.id;
                    const cat = item ? CAT[kindOf(item)] : null;
                    return (
                      <div key={`${row}-${col}`}
                        onClick={() => {
                          if (item) { setSelectedPlotId(sel ? null : item.id); }
                          else { setPickerCell({ row, col }); setPickerTab("icon"); setSelectedPlotId(null); setCustomLabel(""); setSbDraft({ name: "", from: "", to: "" }); }
                        }}
                        style={{
                          aspectRatio: "1", borderRadius: 9, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", cursor: "pointer",
                          background: item ? (sel ? cat.bg : T.card) : "transparent",
                          border: item ? `1.5px solid ${sel ? cat.border : T.border}` : `1px dashed ${T.border}`,
                          boxShadow: sel ? `0 0 0 2px ${cat.border}55` : "none",
                          borderLeft: item && !sel ? `2.5px solid ${cat.border}` : undefined,
                          transition: "all 0.15s", overflow: "hidden", padding: 3,
                        }}>
                        {item ? renderPlotCell(item) : <div style={{ fontSize: 15, color: T.border, opacity: 0.55 }}>+</div>}
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ height: 10, marginTop: 10, borderRadius: 6, background: dark ? "#334155" : "#0f172a" }} />
            </div>
            <div style={{ textAlign: "center", fontSize: 9, color: T.text4, letterSpacing: "0.2em", marginTop: 6, marginBottom: 14, fontFamily: "'Bebas Neue',sans-serif" }}>▼ PÚBLICO ▼</div>

            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 14 }}>
              {["icon", "subbox", "corriente"].map(k => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.text4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: CAT[k].bg, border: `1.5px solid ${CAT[k].border}` }} />
                  {CAT[k].label}
                </div>
              ))}
            </div>

            {selectedPlotId && (() => {
              const item = plotItems.find(p => p.id === selectedPlotId);
              if (!item) return null;
              const k = kindOf(item);
              const cat = CAT[k];
              const chip = { fontSize: 11, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: T.card2, border: `0.5px solid ${T.border}`, color: T.text2 };
              return (
                <div style={{ background: T.card, border: `1px solid ${cat.border}`, borderLeft: `3px solid ${cat.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 24 }}>{k === "icon" ? item.icon : cat.glyph}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: cat.color, letterSpacing: "0.1em", fontWeight: 700 }}>{cat.label.toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: T.text4 }}>Fila {item.row + 1} · Col {item.col + 1}</div>
                    </div>
                    <button onClick={() => { removeItem(selectedPlotId); setSelectedPlotId(null); }}
                      style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#ef4444", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                      Borrar
                    </button>
                  </div>

                  {k === "icon" && (
                    <input value={item.label || ""} onChange={e => updateItem(item.id, { label: e.target.value })} placeholder="Etiqueta" style={{ ...S.input, fontSize: 13, marginTop: 10 }} />
                  )}

                  {k === "subbox" && (
                    <div style={{ marginTop: 10 }}>
                      <input value={item.name || ""} onChange={e => updateItem(item.id, { name: e.target.value })} placeholder="Nombre (ej. SB1)" style={{ ...S.input, fontSize: 13, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <input value={item.from || ""} onChange={e => updateItem(item.id, { from: e.target.value })} placeholder="CH desde" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                        <input value={item.to || ""} onChange={e => updateItem(item.id, { to: e.target.value })} placeholder="CH hasta" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                      </div>
                      {(() => {
                        const ins = inputsInRange(item.from, item.to);
                        return (
                          <>
                            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.08em", marginBottom: 6 }}>{ins.length} INPUT{ins.length !== 1 ? "S" : ""} EN RANGO</div>
                            {ins.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {ins.map(i => (
                                  <span key={i.id} style={chip}><b style={{ color: CAT.subbox.color }}>{i.ch}</b> {i.source || ""}</span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: T.text4 }}>Sin inputs en este rango — defínelos en la pestaña INPUTS.</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {k === "corriente" && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.08em", marginBottom: 6 }}>GRUPO VINCULADO</div>
                      <select value={item.refId || ""} onChange={e => updateItem(item.id, { refId: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
                        <option value="">— Sin vincular —</option>
                        {(esc.power || []).map(g => <option key={g.id} value={g.id}>{g.grupo || "(sin nombre)"}{g.kw ? ` · ${g.kw}kW` : ""}</option>)}
                      </select>
                      {(() => {
                        const g = powerById(item.refId);
                        return g ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                            {g.tomas && <span style={chip}>Tomas {g.tomas}</span>}
                            {g.kw && <span style={chip}>{g.kw} kW</span>}
                            {g.notas && <span style={chip}>{g.notas}</span>}
                          </div>
                        ) : <div style={{ fontSize: 11, color: T.text4, marginTop: 8 }}>Vincula un grupo de la pestaña CORRIENTE.</div>;
                      })()}
                    </div>
                  )}
                </div>
              );
            })()}

            {pickerCell && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.12em" }}>AÑADIR AL PLANO</div>
                  <button onClick={() => setPickerCell(null)} style={{ background: "none", border: "none", color: T.text4, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[["icon", "Instrumento"], ["subbox", "Subbox"], ["corriente", "Corriente"]].map(([id, lbl]) => {
                    const active = pickerTab === id; const c = CAT[id];
                    return (
                      <button key={id} onClick={() => setPickerTab(id)}
                        style={{ flex: 1, padding: "6px 8px", borderRadius: 9, border: `1px solid ${active ? c.border : T.border}`, background: active ? c.bg : "transparent", color: active ? c.color : T.text4, fontSize: 11, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer" }}>
                        {lbl}
                      </button>
                    );
                  })}
                </div>

                {pickerTab === "icon" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                      {PLOT_ICONS.map(({ icon, label }) => (
                        <button key={icon} onClick={() => { placeAt(pickerCell.row, pickerCell.col, { kind: "icon", icon, label: customLabel || label }); setPickerCell(null); }}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 4px", cursor: "pointer" }}>
                          <div style={{ fontSize: 22 }}>{icon}</div>
                          <div style={{ fontSize: 9, color: T.text3 }}>{label}</div>
                        </button>
                      ))}
                    </div>
                    <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Etiqueta personalizada (opcional)" style={{ ...S.input, fontSize: 12 }} />
                  </>
                )}

                {pickerTab === "subbox" && (
                  <>
                    <input value={sbDraft.name} onChange={e => setSbDraft(v => ({ ...v, name: e.target.value }))} placeholder="Nombre (ej. SB1)" style={{ ...S.input, fontSize: 13, marginBottom: 8 }} />
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input value={sbDraft.from} onChange={e => setSbDraft(v => ({ ...v, from: e.target.value }))} placeholder="CH desde" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                      <input value={sbDraft.to} onChange={e => setSbDraft(v => ({ ...v, to: e.target.value }))} placeholder="CH hasta" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                    </div>
                    {(sbDraft.from || sbDraft.to) && (() => {
                      const n = inputsInRange(sbDraft.from, sbDraft.to).length;
                      return <div style={{ fontSize: 10, color: CAT.subbox.color, marginBottom: 10 }}>{n} input{n !== 1 ? "s" : ""} de la pestaña INPUTS en este rango</div>;
                    })()}
                    <button onClick={() => { placeAt(pickerCell.row, pickerCell.col, { kind: "subbox", name: sbDraft.name.trim(), from: sbDraft.from.trim(), to: sbDraft.to.trim() }); setPickerCell(null); }}
                      style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", cursor: "pointer", background: CAT.subbox.border, color: "#fff", fontSize: 14, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.08em" }}>
                      Colocar subbox
                    </button>
                  </>
                )}

                {pickerTab === "corriente" && (
                  (esc.power || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: T.text4, textAlign: "center", padding: "16px 8px", lineHeight: 1.6 }}>
                      No hay grupos de corriente.<br />Créalos primero en la pestaña <b style={{ color: CAT.corriente.color }}>CORRIENTE</b>.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(esc.power || []).map(g => (
                        <button key={g.id} onClick={() => { placeAt(pickerCell.row, pickerCell.col, { kind: "corriente", refId: g.id }); setPickerCell(null); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                          <span style={{ fontSize: 18 }}>⚡</span>
                          <span style={{ flex: 1 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.text }}>{g.grupo || "(sin nombre)"}</span>
                            <span style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>{[g.tomas && `${g.tomas} tomas`, g.kw && `${g.kw}kW`].filter(Boolean).join(" · ") || "—"}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { EscenarioCompactArtistCard, PLOT_COLS, PLOT_ROWS, PLOT_ICONS };
export default EscenarioView;
