import { useState, useRef } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";
import { uid } from "../lib/utils";

function EtapasView({ etapas, onSave }) {
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [editGrupoId, setEditGrupoId] = useState(null); // id del grupo en edición, o "new"
  const [grupoName, setGrupoName] = useState("");
  const [grupoRows, setGrupoRows] = useState([]); // [{ id, amp, ampId }]
  const [expandedId, setExpandedId] = useState(null);
  const [confirmPending, setConfirmPending] = useState(null);
  const rowAmpRefs = useRef([]);
  const askConfirm = (label, action) => setConfirmPending({ label, action });

  function openNew() {
    setEditGrupoId("new");
    setGrupoName("");
    setGrupoRows([{ id: uid(), amp: "", ampId: "" }]);
  }

  function openEdit(g) {
    setEditGrupoId(g.id);
    setGrupoName(g.name);
    setGrupoRows(g.rows.map(r => ({ ...r })));
  }

  function addRow() {
    setGrupoRows(r => {
      const next = [...r, { id: uid(), amp: "", ampId: "" }];
      setTimeout(() => {
        const el = rowAmpRefs.current[next.length - 1];
        if (el) el.focus();
      }, 0);
      return next;
    });
  }
  function delRow(id) { setGrupoRows(r => r.filter(x => x.id !== id)); }
  function setRow(id, field, val) { setGrupoRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x)); }

  function saveGrupo() {
    if (!grupoName.trim()) return;
    const validRows = grupoRows.filter(r => r.amp.trim() || r.ampId.trim());
    if (editGrupoId === "new") {
      onSave([...etapas, { id: uid(), name: grupoName.trim().toUpperCase(), rows: validRows }]);
    } else {
      onSave(etapas.map(g => g.id === editGrupoId ? { ...g, name: grupoName.trim().toUpperCase(), rows: validRows } : g));
    }
    setEditGrupoId(null);
  }

  function deleteGrupo(id) {
    onSave(etapas.filter(g => g.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function duplicateGrupo(g) {
    const copy = { ...g, id: uid(), name: g.name + " " + t("COPIA"), rows: g.rows.map(r => ({ ...r, id: uid() })) };
    const idx = etapas.findIndex(x => x.id === g.id);
    const next = [...etapas];
    next.splice(idx + 1, 0, copy);
    onSave(next);
    openEdit(copy);
  }

  if (editGrupoId !== null) {
    return (
      <div style={{ padding: "16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setEditGrupoId(null)} style={{ ...S.backBtn, background: "#261E18", borderColor: "#3D2B1F", color: "#D8CEB8" }}>‹</button>
          <div style={{ flex: 1, fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>
            {editGrupoId === "new" ? t("NUEVO GRUPO") : t("EDITAR GRUPO")}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>{t("NOMBRE DEL GRUPO")}</div>
          <input value={grupoName} onChange={e => setGrupoName(e.target.value.toUpperCase())}
            placeholder="PA L" style={{ ...S.input }} autoFocus />
        </div>

        <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>{t("FILAS · AMP — ID")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {grupoRows.map((row, i) => (
            <div key={row.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input ref={el => rowAmpRefs.current[i] = el} value={row.amp} onChange={e => setRow(row.id, "amp", e.target.value.toUpperCase())}
                placeholder="GSL8" style={{ ...S.input, flex: "0 0 90px", padding: "10px 10px", fontSize: 13, fontFamily: "'DM Mono',monospace" }} />
              <input value={row.ampId} onChange={e => setRow(row.id, "ampId", e.target.value)}
                placeholder="A/B 0.01" style={{ ...S.input, flex: 1, padding: "10px 10px", fontSize: 13, fontFamily: "'DM Mono',monospace" }}
                onKeyDown={e => { if (e.key === "Enter") addRow(); }} />
              <button onClick={() => delRow(row.id)} style={{ background: "none", border: "none", color: T.text4, fontSize: 18, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addRow} style={{ ...S.addBtn, marginBottom: 20 }}>{t("+ Añadir fila")}</button>
        <button onClick={saveGrupo} disabled={!grupoName.trim()} style={{ ...S.bigBtn, opacity: grupoName.trim() ? 1 : 0.4 }}>
          {editGrupoId === "new" ? t("CREAR GRUPO") : t("GUARDAR CAMBIOS")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 14px" }}>
      {etapas.length === 0 && (
        <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40, fontFamily: "'DM Mono',monospace" }}>
          {t("Sin grupos de etapas")}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {etapas.map(g => {
          const isExpanded = expandedId === g.id;
          return (
            <div key={g.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: "4px solid #D4A843", borderRadius: 4, overflow: "hidden" }}>
              {/* header */}
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: T.card2, cursor: "pointer" }}
                onClick={() => setExpandedId(isExpanded ? null : g.id)}>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: "0.08em", color: T.text, flex: 1 }}>{g.name}</span>
                <span style={{ fontSize: 10, color: T.text4, fontFamily: "'DM Mono',monospace", marginRight: 10 }}>{t("{n} filas", { n: g.rows.length })}</span>
                <button onClick={e => { e.stopPropagation(); openEdit(g); }}
                  style={{ background: "none", border: "none", color: T.text4, fontSize: 13, cursor: "pointer", padding: "0 6px" }}>✏️</button>
                <button onClick={e => { e.stopPropagation(); duplicateGrupo(g); }}
                  title={t("Duplicar grupo")}
                  style={{ background: "none", border: "none", color: T.text4, fontSize: 13, cursor: "pointer", padding: "0 6px" }}>⎘</button>
                <button onClick={e => { e.stopPropagation(); askConfirm(t('¿Eliminar el grupo "{n}"?', { n: g.name }), () => deleteGrupo(g.id)); }}
                  style={{ background: "none", border: "none", color: "#C94A2A", fontSize: 14, cursor: "pointer", padding: "0 4px" }}>×</button>
                <span style={{ color: T.text4, fontSize: 14, marginLeft: 4 }}>{isExpanded ? "▾" : "▸"}</span>
              </div>
              {/* filas */}
              {isExpanded && (
                <div style={{ padding: "0 0 8px" }}>
                  {/* cabecera columnas */}
                  <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 0, padding: "5px 14px 3px", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 8, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em" }}>AMP</span>
                    <span style={{ fontSize: 8, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em" }}>ID</span>
                  </div>
                  {g.rows.map((row, i) => (
                    <div key={row.id} style={{
                      display: "grid", gridTemplateColumns: "90px 1fr", gap: 0,
                      padding: "6px 14px",
                      background: i % 2 === 0 ? "transparent" : (dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"),
                      borderBottom: i < g.rows.length - 1 ? `1px solid ${T.border2}` : "none",
                    }}>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#D4A843", fontWeight: 600 }}>{row.amp || "—"}</span>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: T.text2 }}>{row.ampId || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={openNew} style={{ ...S.bigBtn, marginTop: 0 }}>{t("+ AÑADIR GRUPO")}</button>
      {confirmPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setConfirmPending(null)}>
          <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 14, color: T.text3, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>{confirmPending.label}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmPending(null)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>{t("Cancelar")}</button>
              <button onClick={() => { confirmPending.action(); setConfirmPending(null); }} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#fff" }}>{t("Sí, eliminar")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EtapasView;
