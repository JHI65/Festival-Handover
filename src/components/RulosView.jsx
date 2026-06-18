import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";
import { noInfo } from "../lib/utils";

const RULO_TYPES = ["HMA OPTOCORE", "RJ / CAT6", "OPTICALCON", "MULTIPAR", "OTRO"];

function ruloColor(type) {
  const t = (type || "").toUpperCase();
  if (t.includes("OPTOCORE")) return "#2A6B6B";
  if (t.includes("RJ") || t.includes("CAT")) return "#7B5EA7";
  if (t.includes("OPTICAL")) return "#C94A2A";
  if (t.includes("MULTIPAR")) return "#D4A843";
  if (t.includes("ETHERNET")) return "#1E6B8C";
  return "#7A6652";
}

const POSITIONS = ["SR", "SL"];

function RulosView({ rulos, permRulos, ruloOverrides = {}, onAdd, onEdit, onDelete, onSaveOverride, onClearOverride, dayLabel }) {
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmIsPerm, setConfirmIsPerm] = useState(false);
  const [sheetRulo, setSheetRulo] = useState(null);
  const [overrideDraft, setOverrideDraft] = useState(null); // null | string

  const allRulos = [
    ...permRulos.map(r => ({ ...r, _perm: true })),
    ...rulos.map(r => ({ ...r, _perm: false })),
  ];
  const byPos = pos => allRulos.filter(r => r.position === pos);
  const noPos = allRulos.filter(r => !POSITIONS.includes(r.position));

  function openSheet(r) {
    setSheetRulo(r);
    setOverrideDraft(r._perm ? (ruloOverrides[r.id]?.desc ?? null) : null);
  }

  function RuloChip({ r }) {
    const color = ruloColor(r.type);
    const displayDesc = r._perm ? (ruloOverrides[r.id]?.desc ?? r.desc) : r.desc;
    const hasOverride = r._perm && ruloOverrides[r.id] !== undefined;
    return (
      <div onClick={() => openSheet(r)}
        style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${color}`, borderRadius: 4, padding: "10px 12px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: displayDesc || r.note ? 5 : 0 }}>
          {r._perm && <span style={{ fontSize: 10, lineHeight: 1 }}>📌</span>}
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", color, fontWeight: 600 }}>{r.type || "CABLE"}{r.qty ? ` ×${r.qty}` : ""}</span>
          {hasOverride && <span style={{ fontSize: 9, color: "#D4A843", fontFamily: "'DM Mono',monospace", marginLeft: "auto" }}>{dayLabel}</span>}
        </div>
        {displayDesc && <div style={{ fontSize: 12, color: T.text2, fontFamily: "'DM Mono',monospace", lineHeight: 1.3 }}>{displayDesc}</div>}
        {r.note && <div style={{ fontSize: 11, color: "#D4A843", fontFamily: "'DM Mono',monospace", marginTop: 4 }}>⚠ {r.note}</div>}
      </div>
    );
  }

  return (
    <div>
      {/* Stage plot SR / SL */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", marginBottom: 8, fontFamily: "'DM Mono',monospace", textAlign: "center", textTransform: "uppercase" }}>{t("Escenario")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {POSITIONS.map(pos => {
            const posRulos = byPos(pos);
            return (
              <div key={pos} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden", minHeight: 70 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderBottom: `1px solid ${T.border}`, background: "#1A1410" }}>
                  <span style={{ fontSize: 11, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.12em" }}>{pos}</span>
                  {onAdd && <button onClick={() => onAdd(pos)} style={{ background: "none", border: "none", color: "#B0A090", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>+</button>}
                </div>
                <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {posRulos.length === 0
                    ? <div style={{ fontSize: 11, color: T.text4, textAlign: "center", padding: "10px 0", fontFamily: "'DM Mono',monospace" }}>—</div>
                    : posRulos.map(r => <RuloChip key={r.id} r={r} />)
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sin posición — chips compactos */}
      {noPos.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>{t("General")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {noPos.map(r => <RuloChip key={r.id} r={r} />)}
          </div>
        </div>
      )}

      {/* detail sheet */}
      {sheetRulo && (() => {
        const r = sheetRulo;
        const color = ruloColor(r.type);
        const hasOverride = r._perm && ruloOverrides[r.id] !== undefined;
        const baseDesc = r.desc;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
            onClick={() => setSheetRulo(null)}>
            <div style={{ background: T.card, borderRadius: "8px 8px 0 0", padding: "20px 20px 36px", width: "100%", maxWidth: 480, margin: "0 auto", borderTop: `4px solid ${color}` }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                {r._perm && <span>📌</span>}
                <span style={{ fontSize: 14, color, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", fontWeight: 600 }}>{r.type || "CABLE"}{r.qty ? ` ×${r.qty}` : ""}</span>
                {r.position && <span style={{ fontSize: 11, color: T.text4, fontFamily: "'DM Mono',monospace", marginLeft: "auto" }}>{r.position}</span>}
              </div>

              {/* Descripción editable por día — solo para rulos permanentes */}
              {r._perm ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 9, color: "#D4A843", fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      {t("Descripción · {d}", { d: dayLabel })}
                    </span>
                    {hasOverride && (
                      <button onClick={() => { onClearOverride(r.id); setOverrideDraft(null); }}
                        style={{ background: "none", border: "none", fontSize: 10, color: T.text4, cursor: "pointer", fontFamily: "'DM Mono',monospace", padding: 0 }}>
                        {t("Usar global ↩")}
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={overrideDraft ?? (ruloOverrides[r.id]?.desc ?? baseDesc ?? "")}
                      onChange={e => setOverrideDraft(e.target.value)}
                      placeholder={baseDesc || t("Sin descripción")}
                      style={{ ...S.input, flex: 1, padding: "10px 12px", fontSize: 13 }}
                    />
                    <button
                      onClick={() => { if (overrideDraft !== null) { onSaveOverride(r.id, overrideDraft); } }}
                      style={{ padding: "10px 14px", background: "#D4A843", border: "none", borderRadius: 4, color: "#1A1410", fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                      ✓
                    </button>
                  </div>
                  {hasOverride && baseDesc && (
                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "'DM Mono',monospace", marginTop: 5 }}>{t("Global:")} {baseDesc}</div>
                  )}
                </div>
              ) : (
                r.desc && <div style={{ fontSize: 15, color: T.text, fontFamily: "'DM Mono',monospace", lineHeight: 1.4, marginBottom: 14 }}>{r.desc}</div>
              )}

              {r.note && <div style={{ fontSize: 12, color: "#D4A843", lineHeight: 1.4, padding: "8px 10px", background: dark ? "rgba(212,168,67,0.1)" : "#FFF8EC", borderLeft: "3px solid #D4A843", marginBottom: 14 }}>⚠ {r.note}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {onEdit && <button onClick={() => { setSheetRulo(null); onEdit(r.id); }}
                  style={{ flex: 1, padding: "13px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 13, color: T.text2, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>✏️ {t("Editar")}</button>}
                {onDelete && <button onClick={() => { setSheetRulo(null); setConfirmId(r.id); setConfirmIsPerm(r._perm); }}
                  style={{ flex: 1, padding: "13px", background: "rgba(201,74,42,0.08)", border: "1px solid rgba(201,74,42,0.3)", borderRadius: 4, fontSize: 13, color: "#C94A2A", cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>🗑 {t("Borrar")}</button>}
              </div>
            </div>
          </div>
        );
      })()}

      {confirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setConfirmId(null)}>
          <div style={{ background: T.card, borderRadius: 4, padding: 28, width: "100%", maxWidth: 320, boxShadow: "0 8px 40px rgba(0,0,0,0.3)", borderTop: "4px solid #C94A2A" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 20, fontFamily: "'DM Mono',monospace" }}>{t("¿Borrar esta conexión?")}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex: 1, padding: "13px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>{t("Cancelar")}</button>
              <button onClick={() => { onDelete(confirmId, confirmIsPerm); setConfirmId(null); }} style={{ flex: 1, padding: "13px", background: "#C94A2A", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#fff" }}>{t("Borrar")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuloCard({ r, onEdit, onDelete }) {
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT;
  const color = ruloColor(r.type);
  const bg = dark ? `${color}18` : `${color}0d`;
  const border = dark ? `${color}44` : `${color}28`;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `5px solid ${color}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color, letterSpacing: "0.06em", fontWeight: 600 }}>
              {r.type || "CABLE"}{r.qty ? ` ×${r.qty}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onEdit} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, padding: "4px 9px", fontSize: 12, color: T.text3, cursor: "pointer" }}>✏️</button>
            <button onClick={onDelete} style={{ background: "none", border: "none", padding: "4px 6px", fontSize: 14, color: T.text4, cursor: "pointer" }}>×</button>
          </div>
        </div>
        {r.desc && <div style={{ fontSize: 14, color: T.text, marginBottom: 8, lineHeight: 1.3, fontFamily: "'DM Mono',monospace" }}>{noInfo(r.desc)}</div>}
        {(r.from || r.to) && (
          <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: r.note ? 8 : 0 }}>
            <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: "2px 0 0 2px", padding: "6px 10px" }}>
              <div style={{ fontSize: 8, color, letterSpacing: "0.12em", fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>{t("DE")}</div>
              <div style={{ fontSize: 11, color: T.text, fontFamily: "'DM Mono',monospace", lineHeight: 1.3 }}>{noInfo(r.from) || "—"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", background: bg, border: `1px solid ${border}`, borderLeft: "none", borderRight: "none", padding: "0 6px" }}>
              <span style={{ color, fontSize: 10 }}>→</span>
            </div>
            <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: "0 2px 2px 0", padding: "6px 10px" }}>
              <div style={{ fontSize: 8, color, letterSpacing: "0.12em", fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>{t("PARA")}</div>
              <div style={{ fontSize: 11, color: T.text, fontFamily: "'DM Mono',monospace", lineHeight: 1.3 }}>{noInfo(r.to) || "—"}</div>
            </div>
          </div>
        )}
        {r.note && (
          <div style={{ fontSize: 11, color: "#D4A843", lineHeight: 1.5, padding: "6px 10px", background: dark ? "rgba(212,168,67,0.1)" : "#FFF8EC", borderLeft: "2px solid #D4A843", marginTop: r.from || r.to ? 8 : 0 }}>
            ⚠ {r.note}
          </div>
        )}
      </div>
    </div>
  );
}

function RuloFormModal({ initial, prefillPos, onSave, onClose }) {
  const { t } = useLang();
  const isEdit = !!initial;
  const [f, setF] = useState(initial ? {
    type: initial.type || "HMA OPTOCORE",
    qty: initial.qty || "",
    desc: initial.desc || "",
    note: initial.note || "",
    position: initial.position || "",
    permanent: initial.permanent || false,
  } : { type: "HMA OPTOCORE", qty: "", desc: "", note: "", position: prefillPos || "", permanent: false });

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  function confirm() {
    if (!f.desc.trim() && !f.qty.trim()) return;
    onSave(f);
  }

  const valid = f.desc.trim() || f.qty.trim();
  const color = ruloColor(f.type);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "90dvh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.15em" }}>{t("CONEXIÓN")}</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em" }}>
              {isEdit ? t("EDITAR RULO") : t("NUEVO RULO")}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.text4, fontSize: 20, cursor: "pointer", padding: "6px 8px" }}>✕</button>
        </div>

        {/* type selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 8 }}>{t("TIPO DE CABLE")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {RULO_TYPES.map(rt => {
              const tc = ruloColor(rt);
              const active = f.type === rt;
              return (
                <button key={rt} onClick={() => set("type", rt)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace",
                  border: `1.5px solid ${active ? tc : T.border}`,
                  background: active ? `${tc}18` : T.card2,
                  color: active ? tc : T.text3,
                  cursor: "pointer", fontWeight: active ? 700 : 400,
                }}>{rt}</button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 0.4 }}>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>{t("CANTIDAD")}</div>
            <input value={f.qty} onChange={e => set("qty", e.target.value)} placeholder="2×" style={S.input} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>{t("DESCRIPCIÓN")}</div>
            <input value={f.desc} onChange={e => set("desc", e.target.value)} placeholder={t("Ej: HMA OPTOCORE Festival Box")} style={S.input} autoFocus />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>{t("NOTA (opcional)")}</div>
          <input value={f.note} onChange={e => set("note", e.target.value)} placeholder={t("Ej: El sábado mover a Cultura Jaén SL")} style={S.input} />
        </div>

        {/* posición en escenario */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 8 }}>{t("POSICIÓN EN ESCENARIO")}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["SR", "SL"].map(pos => (
              <button key={pos} onClick={() => set("position", f.position === pos ? "" : pos)} style={{
                flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontFamily: "monospace", fontWeight: 700,
                border: `1.5px solid ${f.position === pos ? color : T.border}`,
                background: f.position === pos ? `${color}18` : T.card2,
                color: f.position === pos ? color : T.text3, cursor: "pointer",
              }}>{pos}</button>
            ))}
          </div>
        </div>

        {/* permanente */}
        <label style={{ display: "flex", alignItems: "center", gap: 12, background: f.permanent ? "#fef3c7" : T.card2, border: `1px solid ${f.permanent ? "#fcd34d" : T.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", marginBottom: 20 }}>
          <input type="checkbox" checked={!!f.permanent} onChange={e => set("permanent", e.target.checked)} style={{ accentColor: "#d97706", width: 18, height: 18 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: f.permanent ? "#92400e" : T.text, fontFamily: "monospace" }}>📌 {t("Rulo permanente")}</div>
            <div style={{ fontSize: 11, color: f.permanent ? "#b45309" : T.text4, marginTop: 2 }}>{t("Visible en todos los días del stage")}</div>
          </div>
        </label>

        <button onClick={confirm} disabled={!valid} style={{ ...S.bigBtn, marginTop: 0, opacity: valid ? 1 : 0.4 }}>
          {isEdit ? t("GUARDAR CAMBIOS") : t("AÑADIR CONEXIÓN")}
        </button>
      </div>
    </div>
  );
}

export { RuloCard, RuloFormModal, RULO_TYPES, POSITIONS, ruloColor };
export default RulosView;
