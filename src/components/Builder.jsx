import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { uid } from "../lib/utils";

function BuilderNotes({ comments, onAdd, onDel }) {
  const [draft, setDraft] = useState("");
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>NOTAS PREVIAS</div>
      {comments.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
          <div style={{ flex: 1, fontSize: 13, color: T.text3, lineHeight: 1.4, padding: "7px 10px", background: T.card2, borderLeft: `2px solid ${T.border}`, borderRadius: "0 6px 6px 0" }}>{c}</div>
          <button onClick={() => onDel(i)} style={S.iconBtn}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { onAdd(draft); setDraft(""); } }}
          placeholder="Añadir nota…" style={{ ...S.input, flex: 1 }} />
        <button onClick={() => { onAdd(draft); setDraft(""); }} style={{ ...S.smBtn, flexShrink: 0 }}>+</button>
      </div>
    </div>
  );
}

function Builder({ onCancel, onSave, onSaveAsTemplate }) {
  const [name, setName] = useState("");
  const [days, setDays] = useState([{ id: uid(), label: "DÍA 1", artists: [] }]);
  const [expDay, setExpDay] = useState(0);

  const addDay = () => { setDays([...days, { id: uid(), label: `DÍA ${days.length + 1}`, artists: [] }]); setExpDay(days.length); };
  const setDayLabel = (i, v) => { const d = [...days]; d[i].label = v; setDays(d); };
  const delDay = (i) => { setDays(days.filter((_, idx) => idx !== i)); setExpDay(0); };

  const addArtist = (di) => {
    const d = [...days];
    d[di].artists.push({ id: uid(), artist: "", console: "", connection: "", signal: "", preset: "INITIAL", presetOk: false, toLx: "", toMon: "", comments: [], extraSlots: [] });
    setDays(d);
  };
  const setAF = (di, ai, k, v) => { const d = [...days]; d[di].artists[ai][k] = v; setDays(d); };
  const delArtist = (di, ai) => { const d = [...days]; d[di].artists.splice(ai, 1); setDays(d); };

  const addExtraSlot = (di, ai) => {
    const d = [...days];
    d[di].artists[ai].extraSlots = [...(d[di].artists[ai].extraSlots || []), { id: uid(), label: "", value: "" }];
    setDays(d);
  };
  const setES = (di, ai, sid, fld, val) => {
    const d = [...days];
    d[di].artists[ai].extraSlots = (d[di].artists[ai].extraSlots || []).map(s => s.id === sid ? { ...s, [fld]: val } : s);
    setDays(d);
  };
  const delES = (di, ai, sid) => {
    const d = [...days];
    d[di].artists[ai].extraSlots = (d[di].artists[ai].extraSlots || []).filter(s => s.id !== sid);
    setDays(d);
  };
  const addComment = (di, ai, t) => {
    if (!t.trim()) return;
    const d = [...days]; d[di].artists[ai].comments = [...(d[di].artists[ai].comments || []), t.trim()]; setDays(d);
  };
  const delComment = (di, ai, ci) => {
    const d = [...days]; d[di].artists[ai].comments = d[di].artists[ai].comments.filter((_, idx) => idx !== ci); setDays(d);
  };

  const valid = name.trim() && days.some(d => d.artists.length);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  return (
    <div style={{ padding: "20px 16px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onCancel} style={S.backBtn}>‹</button>
        <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.05em" }}>NUEVO FESTIVAL</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>NOMBRE</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Mad Cool 26" style={S.input} />
      </div>

      {days.map((d, di) => (
        <div key={d.id} style={S.daySection}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={d.label} onChange={e => setDayLabel(di, e.target.value)} style={{ ...S.input, flex: 1, fontWeight: 700 }} />
            <button onClick={() => setExpDay(expDay === di ? -1 : di)} style={S.smBtn}>{expDay === di ? "▾" : "▸"}</button>
            {days.length > 1 && <button onClick={() => delDay(di)} style={S.iconBtn}>🗑</button>}
          </div>
          <div style={{ fontSize: 10, color: T.text4, marginTop: 4 }}>{d.artists.length} artistas</div>

          {expDay === di && (
            <div style={{ marginTop: 10 }}>
              {d.artists.map((a, ai) => (
                <div key={a.id} style={S.artForm}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "#D4A843", letterSpacing: "0.1em", fontWeight: 700 }}>ARTISTA {ai + 1}</span>
                    <button onClick={() => delArtist(di, ai)} style={S.iconBtn}>×</button>
                  </div>
                  <input value={a.artist} onChange={e => setAF(di, ai, "artist", e.target.value)} placeholder="Nombre artista" style={{ ...S.input, marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={a.console} onChange={e => setAF(di, ai, "console", e.target.value)} placeholder="Consola" style={S.input} />
                    <input value={a.signal} onChange={e => setAF(di, ai, "signal", e.target.value)} placeholder="Señal" style={S.input} />
                  </div>
                  <input value={a.connection} onChange={e => setAF(di, ai, "connection", e.target.value)} placeholder="Conexión" style={{ ...S.input, marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={a.toLx} onChange={e => setAF(di, ai, "toLx", e.target.value)} placeholder="TO LX" style={S.input} />
                    <input value={a.toMon} onChange={e => setAF(di, ai, "toMon", e.target.value)} placeholder="TO MON" style={S.input} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <input value={a.preset} onChange={e => setAF(di, ai, "preset", e.target.value)} placeholder="Preset" style={{ ...S.input, flex: 1 }} />
                    <button onClick={() => setAF(di, ai, "presetOk", !a.presetOk)} style={{
                      ...S.smBtn, background: a.presetOk ? "#dcfce7" : "#f1f5f9",
                      color: a.presetOk ? "#16a34a" : "#94a3b8", border: `1px solid ${a.presetOk ? "#86efac" : "#e2e8f0"}`,
                    }}>{a.presetOk ? "✓ OK" : "preset?"}</button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, color: dark ? "#93c5fd" : "#2563eb", letterSpacing: "0.1em", marginBottom: 6 }}>CAMPOS EXTRA</div>
                    {(a.extraSlots || []).map(s => (
                      <div key={s.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input value={s.label} onChange={e => setES(di, ai, s.id, "label", e.target.value)} placeholder="Etiqueta (RF…)" style={{ ...S.input, flex: 1 }} />
                        <input value={s.value} onChange={e => setES(di, ai, s.id, "value", e.target.value)} placeholder="Valor" style={{ ...S.input, flex: 1.5 }} />
                        <button onClick={() => delES(di, ai, s.id)} style={S.iconBtn}>×</button>
                      </div>
                    ))}
                    <button onClick={() => addExtraSlot(di, ai)} style={{ ...S.addBtn, color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}>+ Campo</button>
                  </div>

                  <BuilderNotes
                    comments={a.comments || []}
                    onAdd={t => addComment(di, ai, t)}
                    onDel={ci => delComment(di, ai, ci)}
                  />
                </div>
              ))}
              <button onClick={() => addArtist(di)} style={S.addBtn}>+ Añadir artista</button>
            </div>
          )}
        </div>
      ))}

      <button onClick={addDay} style={{ ...S.addBtn, marginTop: 12 }}>+ Añadir día</button>
      <button onClick={() => valid && onSave({ id: uid(), name: name.trim(), stages: [{ id: uid(), name: "ESCENARIO PRINCIPAL", days }] })} disabled={!valid}
        style={{ ...S.bigBtn, marginTop: 24, opacity: valid ? 1 : 0.4 }}>
        GUARDAR FESTIVAL
      </button>
      {onSaveAsTemplate && (
        <button onClick={() => valid && onSaveAsTemplate({ id: uid(), name: name.trim(), stages: [{ id: uid(), name: "ESCENARIO PRINCIPAL", days }] })} disabled={!valid}
          style={{ width: "100%", marginTop: 10, padding: "14px", borderRadius: 14, border: `1.5px dashed ${T.border}`, background: "transparent", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: T.text4, cursor: valid ? "pointer" : "not-allowed", letterSpacing: "0.06em", opacity: valid ? 1 : 0.4 }}>
          📋 GUARDAR COMO PLANTILLA
        </button>
      )}
    </div>
  );
}

export { BuilderNotes };
export default Builder;
