import { useState, useRef } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { uid, mkLog, withLog, getUserRole } from "../lib/utils";
import ShareModal from "./ShareModal";
import GeneralScheduleView from "./GeneralScheduleView";
import StageSelectModal from "./StageSelectModal";

function StageView({ fest, userEmail, userId, userRole, onBack, onEditFest, onManageMembers, onOpenStage, onOpenMon, onOpenEscenario }) {
  const isOwner = userRole === "owner";
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedStage, setSelectedStage] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [showShare, setShowShare] = useState(false);
  // StageView se remonta cada vez que se abre un festival (Main controla `screen`/`fest`),
  // así que el estado inicial perezoso equivale a "preguntar al entrar por primera vez"
  const assignedStageId = fest.memberInfo?.[userId]?.assignedStageId;
  const [showStageSelect, setShowStageSelect] = useState(() => assignedStageId === undefined && (fest.stages || []).length > 0);

  function selectAssignedStage(stageId) {
    const updatedInfo = { ...fest.memberInfo, [userId]: { ...fest.memberInfo?.[userId], assignedStageId: stageId } };
    onEditFest({ ...fest, memberInfo: updatedInfo });
    setShowStageSelect(false);
  }
  const [viewTab, setViewTab] = useState("stages");
  const [showDayAdd, setShowDayAdd] = useState(false);
  const [newDayLabel, setNewDayLabel] = useState("");
  const [newDayDate, setNewDayDate] = useState("");
  const [confirmPending, setConfirmPending] = useState(null);
  const dayLabelRefs = useRef([]);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const askConfirm = (label, action) => setConfirmPending({ label, action });

  function addMonPosition() {
    const existing = activeStage.monPositions || [];
    const baseName = "MON WORLD";
    let name = baseName;
    let n = 2;
    while (existing.some(p => p.name === name)) { name = `${baseName} ${n++}`; }
    const newPos = { id: uid(), name, console: "", tecnico: "", inputs: [], outputs: [], rfEntries: [] };
    const newStages = (fest.stages || []).map(s => s.id === activeStage.id
      ? { ...s, monPositions: [...existing, newPos] }
      : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  function deleteMonPosition(mid) {
    const newStages = (fest.stages || []).map(s => s.id === activeStage.id
      ? { ...s, monPositions: (s.monPositions || []).filter(p => p.id !== mid) }
      : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  function deleteEscenario() {
    const newStages = (fest.stages || []).map(s =>
      s.id === activeStage.id ? { ...s, escenario: undefined } : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  function addDayToStage(stageId, label, date) {
    const st = (fest.stages || []).find(s => s.id === stageId);
    if (!st) return;
    const newDay = { id: uid(), label: (label || `DÍA ${st.days.length + 1}`).toUpperCase(), artists: [], ...(date ? { date } : {}) };
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: [...s.days, newDay] } : s);
    onEditFest(withLog({ ...fest, stages: newStages }, mkLog(userEmail, "ADD_DAY", newDay.label)));
  }

  function deleteDayFromStage(stageId, dayId) {
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: s.days.filter(d => d.id !== dayId) } : s);
    onEditFest(withLog({ ...fest, stages: newStages }, mkLog(userEmail, "DEL_DAY", dayId)));
  }

  function updateDayDate(stageId, dayId, date) {
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: s.days.map(d => d.id === dayId ? { ...d, date } : d) } : s);
    onEditFest({ ...fest, stages: newStages });
  }

  function updateDayLabel(stageId, dayId, label) {
    if (!label.trim()) return;
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: s.days.map(d => d.id === dayId ? { ...d, label: label.trim().toUpperCase() } : d) } : s);
    onEditFest({ ...fest, stages: newStages });
  }

  function addStage() {
    if (!newName.trim()) return;
    const stageName = newName.trim().toUpperCase();
    const newStage = { id: uid(), name: stageName, days: [{ id: uid(), label: "DÍA 1", artists: [] }] };
    onEditFest(withLog({ ...fest, stages: [...(fest.stages || []), newStage] }, mkLog(userEmail, "ADD_STAGE", stageName)));
    setNewName("");
    setShowAdd(false);
  }

  function deleteStage(sid) {
    const stageName = (fest.stages || []).find(s => s.id === sid)?.name || sid;
    onEditFest(withLog({ ...fest, stages: (fest.stages || []).filter(s => s.id !== sid) }, mkLog(userEmail, "DEL_STAGE", stageName)));
    if (selectedStage === sid) setSelectedStage(null);
  }

  const totalForStage = (st) => st.days.reduce((a, d) => a + d.artists.length, 0);
  const activeStage = selectedStage ? (fest.stages || []).find(s => s.id === selectedStage) : null;
  const hasFoh = activeStage ? totalForStage(activeStage) > 0 : false;
  const hasEscenario = activeStage ? ((activeStage.escenario?.inputs?.length || 0) > 0 || (activeStage.escenario?.power?.length || 0) > 0) : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* top bar */}
      <div style={{ ...S.topBar, padding: "10px 12px 10px" }}>
        <button onClick={selectedStage ? () => setSelectedStage(null) : onBack} style={S.backBtn}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>
          {activeStage ? activeStage.name : fest.name}
        </div>
        <button onClick={() => setShowStageSelect(true)} title="Escenario asignado" style={{ ...S.syncBtn, marginRight: 6 }}>📍</button>
        <button onClick={() => setShowShare(true)} style={S.syncBtn}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="2"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="2"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, padding: "16px 14px", background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>

        {activeStage ? (
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginBottom: 14 }}>POSICIONES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* FOH */}
              {hasFoh && (
                <button
                  onClick={() => onOpenStage(activeStage.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, background: "#1A1410", border: "none", borderLeft: "4px solid #C94A2A", borderRadius: 4, padding: "16px 20px", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: "rgba(201,74,42,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎛️</div>
                  <div>
                    <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.08em" }}>FOH</div>
                    <div style={{ fontSize: 11, color: "#B0A090", marginTop: 1, fontFamily: "'DM Mono',monospace" }}>{totalForStage(activeStage)} artistas · {activeStage.days.length} días</div>
                  </div>
                </button>
              )}
              {/* MON positions */}
              {(activeStage.monPositions || []).map(mp => (
                <div key={mp.id} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                  <button
                    onClick={() => onOpenMon(activeStage.id, mp.id)}
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, background: "#1A1410", border: "none", borderLeft: "4px solid #D4A843", borderRadius: 4, padding: "16px 20px", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 4, background: "rgba(212,168,67,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎧</div>
                    <div>
                      <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.08em" }}>{mp.name}</div>
                      <div style={{ fontSize: 11, color: "#B0A090", marginTop: 1, fontFamily: "'DM Mono',monospace" }}>
                        {(mp.inputs || []).length} inputs · {(mp.outputs || []).length} outputs · {(mp.rfEntries || []).length} RF
                      </div>
                    </div>
                  </button>
                  {editMode && (
                    <button onClick={() => askConfirm(`¿Eliminar posición de monitores "${mp.name}"?`, () => deleteMonPosition(mp.id))} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "#ef4444", border: "none", borderRadius: 4, color: "#fff", fontSize: 14, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                  )}
                </div>
              ))}
              {/* ESCENARIO */}
              {hasEscenario && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                <button
                  onClick={() => !editMode && onOpenEscenario(activeStage.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, background: "#1A1410", border: "none", borderLeft: "4px solid #2A6B6B", borderRadius: 4, padding: "16px 20px", cursor: editMode ? "default" : "pointer", textAlign: "left" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: "rgba(42,107,107,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A6B6B" strokeWidth="1.6" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9"/>
                      <circle cx="12" cy="7" r="1.4" fill="#2A6B6B" stroke="none"/>
                      <circle cx="8.2" cy="15" r="1.4" fill="#2A6B6B" stroke="none"/>
                      <circle cx="15.8" cy="15" r="1.4" fill="#2A6B6B" stroke="none"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.08em" }}>NUEVA POSICIÓN DE ESCENARIO</div>
                    <div style={{ fontSize: 11, color: "#B0A090", marginTop: 1, fontFamily: "'DM Mono',monospace" }}>
                      {(activeStage.escenario?.inputs || []).length} inputs · {(activeStage.escenario?.power || []).length} grupos corriente
                    </div>
                  </div>
                </button>
                {editMode && (
                  <button onClick={() => askConfirm("¿Eliminar la posición de escenario?", () => deleteEscenario())} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "#ef4444", border: "none", borderRadius: 4, color: "#fff", fontSize: 14, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                )}
                </div>
              )}
              {/* Añadir posiciones */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {!hasFoh && (
                    <button onClick={() => onOpenStage(activeStage.id)} style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1.5px dashed ${T.border}`, borderRadius: 4, padding: "14px 20px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🎛️</div>
                      <div>
                        <div style={{ fontSize: 13, fontFamily: "'Bebas Neue',sans-serif", color: T.text3, letterSpacing: "0.08em" }}>AÑADIR FOH</div>
                        <div style={{ fontSize: 11, color: T.text4, marginTop: 1, fontFamily: "'DM Mono',monospace" }}>Gestión de consola y artistas</div>
                      </div>
                    </button>
                  )}
                  {!hasEscenario && (
                    <button onClick={() => onOpenEscenario(activeStage.id)} style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1.5px dashed ${T.border}`, borderRadius: 4, padding: "14px 20px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="1.6" strokeLinecap="round">
                          <circle cx="12" cy="12" r="9"/>
                          <circle cx="12" cy="7" r="1.4" fill={T.text3} stroke="none"/>
                          <circle cx="8.2" cy="15" r="1.4" fill={T.text3} stroke="none"/>
                          <circle cx="15.8" cy="15" r="1.4" fill={T.text3} stroke="none"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontFamily: "'Bebas Neue',sans-serif", color: T.text3, letterSpacing: "0.08em" }}>AÑADIR ESCENARIO</div>
                        <div style={{ fontSize: 11, color: T.text4, marginTop: 1, fontFamily: "'DM Mono',monospace" }}>Inputs, corriente y plano</div>
                      </div>
                    </button>
                  )}
                  <button onClick={addMonPosition} style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1.5px dashed ${T.border}`, borderRadius: 4, padding: "14px 20px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🎧</div>
                    <div>
                      <div style={{ fontSize: 13, fontFamily: "'Bebas Neue',sans-serif", color: T.text3, letterSpacing: "0.08em" }}>AÑADIR MONITORES</div>
                      <div style={{ fontSize: 11, color: T.text4, marginTop: 1, fontFamily: "'DM Mono',monospace" }}>Nueva posición de monitores</div>
                    </div>
                  </button>
                </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tab switcher: STAGES | HORARIOS */}
            <div style={{ display: "flex", gap: 4, background: T.card2, borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {[{ id: "stages", label: "STAGES" }, { id: "horarios", label: "HORARIOS" }].map(t => (
                <button key={t.id} onClick={() => setViewTab(t.id)} style={{
                  flex: 1, padding: "5px 14px", borderRadius: 8, fontSize: 11,
                  fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
                  border: "none",
                  background: viewTab === t.id ? (dark ? "#334155" : "#0f172a") : "transparent",
                  color: viewTab === t.id ? "#fff" : T.text4,
                  transition: "all 0.2s",
                }}>{t.label}</button>
              ))}
            </div>

            {viewTab === "horarios" ? (
              <GeneralScheduleView fest={fest} />
            ) : (
            <>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              {isOwner && <button onClick={() => { setEditMode(m => !m); setRenamingId(null); }} style={{
                background: editMode ? "#fef2f2" : T.card2, border: `1px solid ${editMode ? "#fecaca" : T.border}`,
                borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 14, color: editMode ? "#ef4444" : T.text3, lineHeight: 1,
              }}>⚙️</button>}
              <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginLeft: 10 }}>STAGES</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(fest.stages || []).map(st => {
                const total = totalForStage(st);
                const isExpanded = renamingId === st.id;
                if (isExpanded) {
                  return (
                    <div key={st.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && renameVal.trim()) {
                              onEditFest({ ...fest, stages: (fest.stages || []).map(s => s.id === st.id ? { ...s, name: renameVal.trim().toUpperCase() } : s) });
                              setRenamingId(null);
                            }
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          style={{ ...S.input, flex: 1, padding: "6px 10px", fontSize: 14, fontWeight: 700 }}
                          autoFocus />
                        <button onClick={() => {
                          if (renameVal.trim()) onEditFest({ ...fest, stages: (fest.stages || []).map(s => s.id === st.id ? { ...s, name: renameVal.trim().toUpperCase() } : s) });
                          setRenamingId(null); setShowDayAdd(false); setNewDayLabel(""); setNewDayDate("");
                        }} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 13, color: T.text2, cursor: "pointer", flexShrink: 0 }}>✓</button>
                      </div>

                      <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginBottom: 8 }}>DÍAS</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {st.days.map((d, i) => (
                          <div key={d.id} style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 7, background: T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: T.text3, flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <input
                                ref={el => dayLabelRefs.current[i] = el}
                                defaultValue={d.label}
                                onBlur={e => updateDayLabel(st.id, d.id, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.target.blur();
                                    const next = dayLabelRefs.current[i + 1];
                                    if (next) next.focus();
                                  }
                                }}
                                style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", color: T.text }}
                              />
                              <input
                                type="date"
                                value={d.date || ""}
                                onChange={e => updateDayDate(st.id, d.id, e.target.value)}
                                style={{ fontSize: 11, background: "transparent", border: "none", outline: "none", color: T.text3, fontFamily: "monospace", width: "100%" }}
                              />
                            </div>
                            <div style={{ fontSize: 10, color: T.text4, flexShrink: 0 }}>{d.artists.length} art.</div>
                            {st.days.length > 1 && (
                              <button onClick={() => askConfirm(`¿Eliminar ${d.label || "este día"}? Se perderán todos sus artistas.`, () => deleteDayFromStage(st.id, d.id))}
                                style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                            )}
                          </div>
                        ))}
                      </div>

                      {showDayAdd ? (
                        <div style={{ marginTop: 8, background: T.card2, borderRadius: 10, padding: "10px" }}>
                          <input
                            value={newDayLabel}
                            onChange={e => setNewDayLabel(e.target.value)}
                            placeholder={`DÍA ${st.days.length + 1}`}
                            style={{ ...S.input, marginBottom: 6, fontSize: 13 }}
                            autoFocus
                          />
                          <input
                            type="date"
                            value={newDayDate}
                            onChange={e => setNewDayDate(e.target.value)}
                            style={{ ...S.input, marginBottom: 8, fontSize: 13, fontFamily: "monospace" }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => {
                              addDayToStage(st.id, newDayLabel.trim() || undefined, newDayDate || undefined);
                              setShowDayAdd(false); setNewDayLabel(""); setNewDayDate("");
                            }} style={{ ...S.bigBtn, flex: 1, padding: "9px", marginTop: 0, fontSize: 12 }}>Añadir día</button>
                            <button onClick={() => { setShowDayAdd(false); setNewDayLabel(""); setNewDayDate(""); }} style={{ ...S.navBtn, flex: 0.5, fontSize: 12 }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowDayAdd(true)} style={{ ...S.addBtn, marginTop: 8, fontSize: 12, padding: "9px" }}>+ Añadir día</button>
                      )}

                      {/* POSICIONES */}
                      {(() => {
                        const stHasFoh = totalForStage(st) > 0;
                        const stHasEscenario = ((st.escenario?.inputs?.length || 0) > 0 || (st.escenario?.power?.length || 0) > 0);
                        const stHasMon = (st.monPositions || []).length > 0;
                        if (!stHasFoh && !stHasMon && !stHasEscenario) return null;
                        return (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginBottom: 8 }}>POSICIONES</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {stHasFoh && (
                                <div style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ fontSize: 16, flexShrink: 0 }}>🎛️</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>FOH</div>
                                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>{totalForStage(st)} artistas</div>
                                  </div>
                                  <button onClick={() => askConfirm(`¿Eliminar todos los artistas de FOH en ${st.name}?`, () => {
                                    const newStages = (fest.stages || []).map(s => s.id === st.id
                                      ? { ...s, days: s.days.map(d => ({ ...d, artists: [] })) }
                                      : s
                                    );
                                    onEditFest({ ...fest, stages: newStages });
                                  })} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                                </div>
                              )}
                              {(st.monPositions || []).map(mp => (
                                <div key={mp.id} style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ fontSize: 16, flexShrink: 0 }}>🎧</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <input
                                      defaultValue={mp.name}
                                      onBlur={e => {
                                        if (!e.target.value.trim()) return;
                                        const newStages = (fest.stages || []).map(s => s.id === st.id
                                          ? { ...s, monPositions: (s.monPositions || []).map(p => p.id === mp.id ? { ...p, name: e.target.value.trim().toUpperCase() } : p) }
                                          : s
                                        );
                                        onEditFest({ ...fest, stages: newStages });
                                      }}
                                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", color: T.text }}
                                    />
                                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>{(mp.inputs || []).length} inputs · {(mp.rfEntries || []).length} RF</div>
                                  </div>
                                  <button onClick={() => askConfirm(`¿Eliminar la posición "${mp.name}"?`, () => {
                                    const newStages = (fest.stages || []).map(s => s.id === st.id
                                      ? { ...s, monPositions: (s.monPositions || []).filter(p => p.id !== mp.id) }
                                      : s
                                    );
                                    onEditFest({ ...fest, stages: newStages });
                                  })} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                                </div>
                              ))}
                              {stHasEscenario && (
                                <div style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ fontSize: 16, flexShrink: 0 }}>🎪</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>ESCENARIO</div>
                                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>{(st.escenario?.inputs || []).length} inputs · {(st.escenario?.power || []).length} grupos corriente</div>
                                  </div>
                                  <button onClick={() => askConfirm("¿Eliminar la posición de escenario?", () => {
                                    const newStages = (fest.stages || []).map(s => s.id === st.id
                                      ? { ...s, escenario: undefined }
                                      : s
                                    );
                                    onEditFest({ ...fest, stages: newStages });
                                  })} style={{ width: 24, height: 24, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }
                return (
                  <div key={st.id}
                    onClick={() => { if (!editMode) setSelectedStage(st.id); }}
                    style={{ background: T.card, border: `1px solid ${editMode ? "#fecaca" : T.border}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: editMode ? "default" : "pointer" }}>
                    {editMode && (
                      <button onClick={e => { e.stopPropagation(); askConfirm(`¿Eliminar el stage "${st.name}"? Se perderán todos sus días y artistas.`, () => deleteStage(st.id)); }}
                        style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>−</button>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em" }}>{st.name}</div>
                      <div style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{st.days.length} días · {total} artistas</div>
                    </div>
                    {editMode && (
                      <button onClick={e => { e.stopPropagation(); setRenamingId(st.id); setRenameVal(st.name); setShowDayAdd(false); }}
                        style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.text2, cursor: "pointer", flexShrink: 0 }}>✏️</button>
                    )}
                    {!editMode && <span style={{ color: T.text4, fontSize: 18 }}>›</span>}
                  </div>
                );
              })}
            </div>

            {isOwner && (showAdd ? (
              <div style={{ marginTop: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px" }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addStage()}
                  placeholder="Nombre del stage" style={{ ...S.input, marginBottom: 10 }} autoFocus />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addStage} disabled={!newName.trim()} style={{ ...S.bigBtn, flex: 1, padding: "11px", marginTop: 0, fontSize: 13, opacity: newName.trim() ? 1 : 0.4 }}>Añadir</button>
                  <button onClick={() => { setShowAdd(false); setNewName(""); }} style={{ ...S.navBtn, flex: 0.5 }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)} style={{ ...S.addBtn, marginTop: 12 }}>+ Añadir stage</button>
            ))}
            </>
            )}
          </>
        )}
      </div>
      {showShare && <ShareModal fest={fest} isOwner={isOwner} ownerId={userId} onManageMembers={onManageMembers} onClose={() => setShowShare(false)} />}
      {showStageSelect && (
        <StageSelectModal
          stages={fest.stages || []}
          current={assignedStageId}
          onSelect={selectAssignedStage}
          onClose={() => setShowStageSelect(false)}
        />
      )}
      {confirmPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setConfirmPending(null)}>
          <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 14, color: T.text3, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>{confirmPending.label}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmPending(null)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>Cancelar</button>
              <button onClick={() => { confirmPending.action(); setConfirmPending(null); }} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#fff" }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StageView;
