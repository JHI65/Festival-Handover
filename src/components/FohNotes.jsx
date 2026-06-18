import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";

function FohNotes({ notes, onAdd, onDel }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const noteBg = dark ? "#292524" : "#fffbeb";
  const noteBorder = dark ? "#92400e" : "#fcd34d";
  const noteText = dark ? "#fde68a" : "#92400e";
  const noteLabel = dark ? "#fbbf24" : "#d97706";

  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 9, color: noteLabel, letterSpacing: "0.15em", marginBottom: 7, fontWeight: 700 }}>{t("NOTAS FOH (turno)")}</div>
      {notes.map((n, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
          <div style={{ flex: 1, fontSize: 12, color: noteText, lineHeight: 1.5, padding: "7px 10px", background: noteBg, borderLeft: `2px solid ${noteBorder}`, borderRadius: "0 6px 6px 0" }}>{n.text}</div>
          {onDel && <button onClick={() => onDel(i)} style={S.iconBtn}>×</button>}
        </div>
      ))}
      {!onAdd ? null : editing ? (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} autoFocus
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAdd(draft); setDraft(""); setEditing(false); } }}
            placeholder={t("Nota para tu compañero…")}
            style={{ ...S.input, flex: 1, resize: "none", borderColor: noteBorder }} />
          <button onClick={() => { onAdd(draft); setDraft(""); setEditing(false); }} style={{ ...S.smBtn, background: "#D4A843", color: "#fff" }}>OK</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} style={{ ...S.addBtn, color: noteLabel, borderColor: noteBorder, background: noteBg, marginTop: 0 }}>{t("+ Añadir nota")}</button>
      )}
    </div>
  );
}

export default FohNotes;
