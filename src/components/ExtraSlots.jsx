import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";

function ExtraSlots({ slots, onAdd, onDel, onEdit }) {
  const { t } = useLang();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNL] = useState("");
  const [newValue, setNV] = useState("");
  const [editingId, setEditId] = useState(null);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const slotBg = dark ? "#1e3a5f" : "#eff6ff";
  const slotBorder = dark ? "#2563eb55" : "#bfdbfe";
  const slotLabel = dark ? "#93c5fd" : "#2563eb";
  const slotText = dark ? "#bfdbfe" : "#1e3a5f";

  function confirmAdd() {
    if (!newLabel.trim()) return;
    onAdd(newLabel, newValue); setNL(""); setNV(""); setAdding(false);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: slotLabel, letterSpacing: "0.15em", marginBottom: 7, fontWeight: 700 }}>{t("CAMPOS EXTRA")}</div>
      {slots.map(s => (
        <div key={s.id} style={{ marginBottom: 7 }}>
          {editingId === s.id ? (
            <div style={{ background: slotBg, border: `1px solid ${slotBorder}`, borderRadius: 10, padding: 10 }}>
              <input value={s.label} onChange={e => onEdit(s.id, "label", e.target.value)} style={{ ...S.input, marginBottom: 6, fontWeight: 700 }} placeholder={t("Etiqueta")} />
              <input value={s.value} onChange={e => onEdit(s.id, "value", e.target.value)} style={{ ...S.input, marginBottom: 8 }} placeholder={t("Valor")} />
              <button onClick={() => setEditId(null)} style={S.smBtn}>{t("Hecho")}</button>
            </div>
          ) : (
            <div onClick={() => onEdit && setEditId(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: slotBg, border: `1px solid ${slotBorder}`, borderRadius: 10, padding: "9px 12px", cursor: onEdit ? "pointer" : "default" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 8, color: slotLabel, letterSpacing: "0.15em", fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: slotText, fontFamily: "monospace", marginTop: 2, wordBreak: "break-word" }}>{s.value || "—"}</div>
              </div>
              {onDel && <button onClick={e => { e.stopPropagation(); onDel(s.id); }} style={S.iconBtn}>×</button>}
            </div>
          )}
        </div>
      ))}
      {!onAdd ? null : adding ? (
        <div style={{ background: slotBg, border: `1px solid ${slotBorder}`, borderRadius: 10, padding: 10 }}>
          <input value={newLabel} onChange={e => setNL(e.target.value)} placeholder={t("Etiqueta (RF, Backline…)")} autoFocus style={{ ...S.input, marginBottom: 6, fontWeight: 700 }} />
          <input value={newValue} onChange={e => setNV(e.target.value)} placeholder={t("Valor")} onKeyDown={e => { if (e.key === "Enter") confirmAdd(); }} style={{ ...S.input, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={confirmAdd} style={{ ...S.smBtn, background: "#2563eb", color: "#fff", flex: 1 }}>{t("Añadir")}</button>
            <button onClick={() => { setAdding(false); setNL(""); setNV(""); }} style={{ ...S.smBtn, flex: 1 }}>{t("Cancelar")}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...S.addBtn, color: slotLabel, borderColor: slotBorder, background: slotBg }}>{t("+ Nuevo campo")}</button>
      )}
    </div>
  );
}

export default ExtraSlots;
