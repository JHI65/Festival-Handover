import { useState } from "react";
import { useTheme, LT, DK } from "../lib/theme";
import { useLang, localeOf } from "../lib/i18n";

function LogModal({ log, undo = [], canEdit = false, onUndo, festName, onClose }) {
  const entries = [...(log || [])].reverse();
  const { dark } = useTheme(); const T = dark ? DK : LT;
  const { t, lang } = useLang();
  const [confirming, setConfirming] = useState(false);
  const fmtTs = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " " + d.toLocaleDateString(localeOf(lang), { day: "2-digit", month: "2-digit" });
    } catch { return iso; }
  };
  const actionMeta = (a) => {
    if (a.startsWith("ADD")) return { label: a, color: "#16a34a" };
    if (a.startsWith("DEL")) return { label: a, color: "#dc2626" };
    if (a.startsWith("EDIT")) return { label: a, color: "#d97706" };
    if (a.startsWith("UNDO")) return { label: a, color: "#2563eb" };
    return { label: a, color: T.text3 };
  };

  const nextUndo = undo.length ? undo[undo.length - 1] : null;
  const undoLabel = nextUndo ? `${nextUndo.action}${nextUndo.detail ? " · " + nextUndo.detail.split("\n")[0] : ""}` : "";

  function handleUndo() {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    onUndo && onUndo();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 600, maxHeight: "85dvh", background: T.card, borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", border: `1px solid ${T.border}`, borderBottom: "none" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: T.card2, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: T.text3, letterSpacing: "0.06em" }}>{">_"} CHANGELOG</span>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, color: T.text, letterSpacing: "0.08em" }}>{festName}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.text3, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {/* log entries */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0 20px", background: T.bg }}>
          {entries.length === 0 ? (
            <div style={{ fontFamily: "monospace", fontSize: 11, color: T.text4, padding: "20px 16px" }}>// {t("sin entradas")}</div>
          ) : (
            entries.map((e, i) => {
              const { label, color } = actionMeta(e.action);
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "0 10px", padding: "5px 16px", borderBottom: `1px solid ${T.border2}`, alignItems: "start" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text4, whiteSpace: "nowrap", paddingTop: 1 }}>{fmtTs(e.ts)}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color, fontWeight: 700, whiteSpace: "nowrap", paddingTop: 1 }}>{label}</span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text2, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.user}</span>
                    {e.detail && e.detail.split("\n").map((line, li) => (
                      <span key={li} style={{ fontFamily: "monospace", fontSize: 10, color: T.text3, display: "block", lineHeight: 1.6 }}>{line}</span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* undo bar */}
        {canEdit && nextUndo && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: T.card, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text4, display: "block" }}>{confirming ? t("¿Seguro? Toca de nuevo para confirmar") : t("↩ Deshacer último cambio")}</span>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text3, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{undoLabel}</span>
            </div>
            {confirming && (
              <button onClick={() => setConfirming(false)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.text3, fontFamily: "monospace", fontSize: 11, padding: "7px 12px", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>{t("Cancelar")}</button>
            )}
            <button onClick={handleUndo} style={{ background: confirming ? "#dc2626" : T.card2, border: `1px solid ${confirming ? "#dc2626" : T.border}`, color: confirming ? "#fff" : "#2563eb", fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: 8, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>{confirming ? t("Deshacer") : t("↩ Deshacer")}</button>
          </div>
        )}
        {/* footer */}
        <div style={{ padding: "8px 16px", background: T.card2, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text4 }}>{t("{n} entradas · últimos 1000 cambios", { n: entries.length })}{undo.length ? t(" · {n} deshacer disponibles", { n: undo.length }) : ""}</span>
        </div>
      </div>
    </div>
  );
}

export default LogModal;
