import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { uid } from "../lib/utils";

function FestEditModal({ fest, onSave, onSaveAsTemplate, onClose }) {
  const [name, setName] = useState(fest.name);
  const [stages, setStages] = useState(() => (fest.stages || []).map(s => ({ ...s, days: (s.days || []).map(d => ({ ...d })) })));
  const [tplMode, setTplMode] = useState(false);
  const [tplName, setTplName] = useState(fest.name);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  function updDay(stageId, dayId, patch) {
    setStages(ss => ss.map(s => s.id === stageId
      ? { ...s, days: s.days.map(d => d.id === dayId ? { ...d, ...patch } : d) }
      : s
    ));
  }
  function delDay(stageId, dayId) {
    setStages(ss => ss.map(s => s.id === stageId
      ? { ...s, days: s.days.filter(d => d.id !== dayId) }
      : s
    ));
  }
  function addDay(stageId) {
    const st = stages.find(s => s.id === stageId);
    const newDay = { id: uid(), label: `DÍA ${(st?.days?.length || 0) + 1}`, artists: [] };
    setStages(ss => ss.map(s => s.id === stageId ? { ...s, days: [...s.days, newDay] } : s));
  }

  function save() {
    if (!name.trim()) return;
    onSave({ ...fest, name: name.trim(), stages });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.05em" }}>EDITAR FESTIVAL</div>
          <button onClick={onClose} style={S.iconBtn}>✕</button>
        </div>

        <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>NOMBRE</div>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...S.input, marginBottom: 24 }} autoFocus />

        {stages.map(st => (
          <div key={st.id} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 8 }}>
              {stages.length > 1 ? `${st.name} · DÍAS` : "DÍAS"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {st.days.map((d, i) => (
                <div key={d.id} style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: T.text3, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      defaultValue={d.label}
                      onBlur={e => { if (e.target.value.trim()) updDay(st.id, d.id, { label: e.target.value.trim().toUpperCase() }); }}
                      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", color: T.text }}
                    />
                    <input
                      type="date"
                      value={d.date || ""}
                      onChange={e => updDay(st.id, d.id, { date: e.target.value })}
                      style={{ fontSize: 11, background: "transparent", border: "none", outline: "none", color: T.text3, fontFamily: "monospace", width: "100%" }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: T.text4, flexShrink: 0 }}>{(d.artists || []).length} art.</div>
                  {st.days.length > 1 && (
                    <button onClick={() => delDay(st.id, d.id)}
                      style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => addDay(st.id)} style={{ ...S.addBtn, marginTop: 8, fontSize: 12, padding: "9px" }}>+ Añadir día</button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={!name.trim()} style={{ flex: 1, padding: "14px", background: dark ? "#334155" : "#0f172a", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Mono',monospace", color: "#fff", opacity: name.trim() ? 1 : 0.4 }}>
            Guardar
          </button>
        </div>

        {/* Guardar como plantilla */}
        {!tplMode ? (
          <button onClick={() => setTplMode(true)} style={{
            width: "100%", marginTop: 12, padding: "12px", borderRadius: 12,
            border: `1.5px dashed ${T.border}`, background: "transparent",
            fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700,
            color: T.text4, cursor: "pointer", letterSpacing: "0.06em",
          }}>
            📋 GUARDAR COMO PLANTILLA
          </button>
        ) : (
          <div style={{ marginTop: 12, padding: "14px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.card2 }}>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 8 }}>NOMBRE DE LA PLANTILLA</div>
            <input
              value={tplName}
              onChange={e => setTplName(e.target.value)}
              autoFocus
              style={{ ...S.input, marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setTplMode(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text3 }}>
                Cancelar
              </button>
              <button onClick={() => { if (tplName.trim()) { onSaveAsTemplate(tplName.trim()); onClose(); } }} disabled={!tplName.trim()} style={{ flex: 1, padding: "10px", background: "#D4A843", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: tplName.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Mono',monospace", color: "#fff", opacity: tplName.trim() ? 1 : 0.4 }}>
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FestEditModal;
