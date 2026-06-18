import { useState, useRef } from "react";
import { useTheme, LT, DK } from "../lib/theme";
import { useLang, localeOf } from "../lib/i18n";

function NotasDiaView({ festId, stageId, day, dayColor, notes, setNotes }) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef(null);
  const { t, lang } = useLang();
  const { dark } = useTheme();
  const T = dark ? DK : LT;

  const noteKey = `${festId}__${stageId}__${day.id}__general`;
  const dayNotes = notes[noteKey] || [];

  function addNota() {
    if (!draft.trim()) return;
    setNotes({ ...notes, [noteKey]: [...dayNotes, { text: draft.trim(), ts: Date.now() }] });
    setDraft("");
    if (textareaRef.current) textareaRef.current.focus();
  }

  function delNota(i) {
    setNotes({ ...notes, [noteKey]: dayNotes.filter((_, idx) => idx !== i) });
  }

  return (
    <div style={{ padding: "20px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2.2rem", letterSpacing: "0.04em", color: dayColor, lineHeight: 1 }}>{day.label}</span>
        <span style={{ fontSize: 11, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em" }}>{t("NOTAS DEL DÍA")}</span>
      </div>

      {/* input nueva nota */}
      <div style={{ marginBottom: 20 }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNota(); }}
          placeholder={t("Escribe una nota…")}
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "12px 14px", borderRadius: 10,
            border: `1.5px solid ${T.border}`,
            background: T.card, color: T.text,
            fontFamily: "'DM Sans',sans-serif", fontSize: 14,
            resize: "vertical", outline: "none",
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={addNota}
          style={{
            marginTop: 8, width: "100%", padding: "13px",
            background: "#D4A843", border: "none", borderRadius: 10,
            fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.1em",
            fontSize: 15, color: "#1A1410", cursor: "pointer",
          }}
        >{t("+ AÑADIR NOTA")}</button>
      </div>

      {/* lista de notas */}
      {dayNotes.length === 0 ? (
        <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 32, fontFamily: "'DM Mono',monospace" }}>
          {t("Sin notas para este día")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...dayNotes].reverse().map((n, ri) => {
            const i = dayNotes.length - 1 - ri;
            const time = new Date(n.ts).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={n.ts} style={{
                background: T.card, border: `1px solid ${T.border}`,
                borderLeft: `3px solid ${dayColor}`,
                borderRadius: "0 10px 10px 0",
                padding: "12px 14px",
                position: "relative",
              }}>
                <div style={{ fontSize: 9, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>{time}</div>
                <div style={{ fontSize: 14, color: T.text, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: 28 }}>{n.text}</div>
                <button
                  onClick={() => delNota(i)}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "none", border: `1px solid ${T.border2}`,
                    color: T.text4, fontSize: 14, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotasDiaView;
