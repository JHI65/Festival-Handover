import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";

function AddArtistScreen({ onAdd, onBack, initial }) {
  const [f, setF] = useState(initial ? { artist: initial.artist || "", console: initial.console || "", connection: initial.connection || "", signal: initial.signal || "", preset: initial.preset || "INITIAL", toLx: initial.toLx || "", toMon: initial.toMon || "", tecnico: initial.tecnico || "", corriente: initial.corriente || "", escConsole: initial.escConsole || "", escSignal: initial.escSignal || "", escConnection: initial.escConnection || "", escTecnico: initial.escTecnico || "" } : { artist: "", console: "", connection: "", signal: "", preset: "INITIAL", toLx: "", toMon: "", tecnico: "", corriente: "", escConsole: "", escSignal: "", escConnection: "", escTecnico: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const isEdit = !!initial;

  async function confirm() {
    if (!f.artist.trim()) return;
    await onAdd(f);
  }

  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  return (
    <div style={{ background: T.card, borderRadius: 20, padding: 20, border: `2px dashed ${T.border}`, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: isEdit ? (dark ? "#3730a3" : "#ede9fe") : (dark ? "#713f12" : "#fef9c3"), border: `1px solid ${isEdit ? (dark ? "#4f46e5" : "#c4b5fd") : (dark ? "#92400e" : "#fde68a")}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{isEdit ? "✏️" : "+"}</div>
        <div>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.15em" }}>{isEdit ? "EDITAR ARTISTA" : "NUEVO ARTISTA"}</div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{isEdit ? f.artist || "—" : "Añadir al día"}</div>
        </div>
      </div>
      <input value={f.artist} onChange={e => set("artist", e.target.value)} placeholder="Nombre artista *" style={{ ...S.input, marginBottom: 8 }} autoFocus />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.console} onChange={e => set("console", e.target.value)} placeholder="Consola" style={S.input} />
        <input value={f.signal} onChange={e => set("signal", e.target.value)} placeholder="Señal" style={S.input} />
      </div>
      <input value={f.connection} onChange={e => set("connection", e.target.value)} placeholder="Conexión" style={{ ...S.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.toLx} onChange={e => set("toLx", e.target.value)} placeholder="TO LX" style={S.input} />
        <input value={f.toMon} onChange={e => set("toMon", e.target.value)} placeholder="TO MON" style={S.input} />
        <input value={f.tecnico || ""} onChange={e => set("tecnico", e.target.value)} placeholder="Técnico" style={S.input} />
      </div>
      <input value={f.preset} onChange={e => set("preset", e.target.value)} placeholder="Preset" style={{ ...S.input, marginBottom: 8 }} />
      <textarea value={f.corriente} onChange={e => set("corriente", e.target.value)} placeholder="Corriente" rows={1} style={{ ...S.input, marginBottom: 14, resize: "vertical", fontFamily: "inherit", fontSize: 12 }} />
      <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>ESCENARIO</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.escConsole} onChange={e => set("escConsole", e.target.value)} placeholder="Consola escenario" style={S.input} />
        <input value={f.escSignal} onChange={e => set("escSignal", e.target.value)} placeholder="Señal escenario" style={S.input} />
      </div>
      <input value={f.escConnection} onChange={e => set("escConnection", e.target.value)} placeholder="Conexión escenario" style={{ ...S.input, marginBottom: 8 }} />
      <input value={f.escTecnico} onChange={e => set("escTecnico", e.target.value)} placeholder="Técnico escenario" style={{ ...S.input, marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={confirm} disabled={!f.artist.trim()} style={{ ...S.bigBtn, flex: 1, padding: "13px", marginTop: 0, opacity: f.artist.trim() ? 1 : 0.4 }}>{isEdit ? "Guardar cambios" : "Guardar artista"}</button>
        <button onClick={onBack} style={{ ...S.navBtn, flex: 0.5 }}>‹ Volver</button>
      </div>
    </div>
  );
}

export default AddArtistScreen;
