import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";

function AddArtistScreen({ onAdd, onBack, initial }) {
  const { t } = useLang();
  const [f, setF] = useState(initial ? { artist: initial.artist || "", console: initial.console || "", connection: initial.connection || "", signal: initial.signal || "", preset: initial.preset || "INITIAL", toLx: initial.toLx || "", toMon: initial.toMon || "", tecnico: initial.tecnico || "", corriente: initial.corriente || "", scLoadIn: initial.scLoadIn || "", scStart: initial.scStart || "", scEnd: initial.scEnd || "", showStart: initial.showStart || "", showEnd: initial.showEnd || "" } : { artist: "", console: "", connection: "", signal: "", preset: "INITIAL", toLx: "", toMon: "", tecnico: "", corriente: "", scLoadIn: "", scStart: "", scEnd: "", showStart: "", showEnd: "" });
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
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.15em" }}>{isEdit ? t("EDITAR ARTISTA") : t("NUEVO ARTISTA")}</div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{isEdit ? f.artist || "—" : t("Añadir al día")}</div>
        </div>
      </div>
      <input value={f.artist} onChange={e => set("artist", e.target.value)} placeholder={t("Nombre artista *")} style={{ ...S.input, marginBottom: 8 }} autoFocus />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.console} onChange={e => set("console", e.target.value)} placeholder={t("Consola")} style={S.input} />
        <input value={f.signal} onChange={e => set("signal", e.target.value)} placeholder={t("Señal")} style={S.input} />
      </div>
      <input value={f.connection} onChange={e => set("connection", e.target.value)} placeholder={t("Conexión")} style={{ ...S.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.toLx} onChange={e => set("toLx", e.target.value)} placeholder="TO LX" style={S.input} />
        <input value={f.toMon} onChange={e => set("toMon", e.target.value)} placeholder="TO MON" style={S.input} />
        <input value={f.tecnico || ""} onChange={e => set("tecnico", e.target.value)} placeholder={t("Técnico")} style={S.input} />
      </div>
      <input value={f.preset} onChange={e => set("preset", e.target.value)} placeholder={t("Preset")} style={{ ...S.input, marginBottom: 8 }} />
      <textarea value={f.corriente} onChange={e => set("corriente", e.target.value)} placeholder={t("Corriente")} rows={1} style={{ ...S.input, marginBottom: 14, resize: "vertical", fontFamily: "inherit", fontSize: 12 }} />
      <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>{t("HORARIOS")}</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", marginBottom: 4 }}>LOAD IN</div>
        <input type="time" value={f.scLoadIn} onChange={e => set("scLoadIn", e.target.value)} style={S.input} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", marginBottom: 4 }}>{t("SC INICIO")}</div>
          <input type="time" value={f.scStart} onChange={e => set("scStart", e.target.value)} style={S.input} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", marginBottom: 4 }}>{t("SC FIN")}</div>
          <input type="time" value={f.scEnd} onChange={e => set("scEnd", e.target.value)} style={S.input} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", marginBottom: 4 }}>{t("SHOW INICIO")}</div>
          <input type="time" value={f.showStart} onChange={e => set("showStart", e.target.value)} style={S.input} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", marginBottom: 4 }}>{t("SHOW FIN")}</div>
          <input type="time" value={f.showEnd} onChange={e => set("showEnd", e.target.value)} style={S.input} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={confirm} disabled={!f.artist.trim()} style={{ ...S.bigBtn, flex: 1, padding: "13px", marginTop: 0, opacity: f.artist.trim() ? 1 : 0.4 }}>{isEdit ? t("Guardar cambios") : t("Guardar artista")}</button>
        <button onClick={onBack} style={{ ...S.navBtn, flex: 0.5 }}>{t("‹ Volver")}</button>
      </div>
    </div>
  );
}

export default AddArtistScreen;
