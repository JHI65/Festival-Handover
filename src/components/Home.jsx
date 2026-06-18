import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang, LANGS } from "../lib/i18n";
import { getUserRole } from "../lib/utils";
import FestEditModal from "./FestEditModal";
import NotificationSettings from "./NotificationSettings";

function Home({ fests, user, userId, onOpen, onNew, onDelete, onEdit, onSaveAsTemplate, onCreateFromTemplate, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [editFestId, setEditFestId] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [useTemplate, setUseTemplate] = useState(null);
  const [festNameFromTpl, setFestNameFromTpl] = useState("");
  const { dark, toggle } = useTheme();
  const { t, lang, setLang } = useLang();
  const T = dark ? DK : LT;
  const S = makeS(T);

  const myFests = (fests || []).filter(f => !f.isTemplate);
  const templates = (fests || []).filter(f => f.isTemplate && getUserRole(f, userId) === "owner");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "20px 20px max(24px, env(safe-area-inset-bottom, 24px))", overflow: "hidden", background: T.bg }}
      onClick={() => { menuOpen && setMenuOpen(false); }}>

      {/* header */}
      <div style={{ position: "relative", marginBottom: 20, flexShrink: 0 }}>
        {/* gear top-left */}
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setEditMode(m => !m); }}
            style={{
              width: 38, height: 38, borderRadius: "50%", border: `2px solid ${T.border}`,
              background: editMode ? "#fef2f2" : T.card2, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: editMode ? "#ef4444" : T.text3,
              transition: "all 0.15s",
            }}
          >⚙️</button>
        </div>
        {/* avatar top-right */}
        <div style={{ position: "absolute", top: 0, right: 0 }}>
          <img
            src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=U&background=e2e8f0&color=64748b"}
            alt=""
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
            style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid #e2e8f0", cursor: "pointer", display: "block" }}
          />
          {menuOpen && (
            <div onClick={e => e.stopPropagation()} style={{
              position: "absolute", right: 0, top: 46, background: T.card,
              border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              padding: "6px", minWidth: 180, zIndex: 50,
            }}>
              <div style={{ padding: "8px 12px 10px", borderBottom: `1px solid ${T.border2}`, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{user.user_metadata?.full_name || user.email}</div>
                <div style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{user.email}</div>
              </div>
              <button onClick={toggle} style={{
                width: "100%", padding: "10px 12px", background: "none", border: "none",
                borderRadius: 8, color: T.text3, fontSize: 13, cursor: "pointer",
                textAlign: "left", fontFamily: "'DM Mono',monospace",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>{dark ? t("☀️ Modo claro") : t("🌙 Modo oscuro")}</span>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 99,
                  background: dark ? "#334155" : "#f1f5f9",
                  color: dark ? "#94a3b8" : "#64748b",
                }}>{dark ? t("oscuro") : t("claro")}</span>
              </button>
              {/* selector de idioma */}
              <div style={{ padding: "8px 12px 6px" }}>
                <div style={{ fontSize: 10, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>🌐 {t("Idioma")}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {LANGS.map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)} style={{
                      flex: 1, padding: "7px 4px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${lang === l.code ? "#D4A843" : T.border}`,
                      background: lang === l.code ? "rgba(212,168,67,0.15)" : "transparent",
                      color: lang === l.code ? T.text : T.text4, fontFamily: "'DM Mono',monospace",
                      fontSize: 11, fontWeight: lang === l.code ? 700 : 400,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    }}>
                      <span style={{ fontSize: 14 }}>{l.flag}</span>
                      <span>{l.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => { setMenuOpen(false); setShowNotifSettings(true); }} style={{
                width: "100%", padding: "10px 12px", background: "none", border: "none",
                borderRadius: 8, color: T.text3, fontSize: 13, cursor: "pointer",
                textAlign: "left", fontFamily: "'DM Mono',monospace",
              }}>🔔 {t("Avisos")}</button>
              <div style={{ height: 1, background: T.border2, margin: "2px 0" }} />
              <button onClick={onLogout} style={{
                width: "100%", padding: "10px 12px", background: "none", border: "none",
                borderRadius: 8, color: "#ef4444", fontSize: 13, cursor: "pointer",
                textAlign: "left", fontFamily: "'DM Mono',monospace",
              }}>{t("Cerrar sesión")}</button>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.text4, letterSpacing: "0.2em", marginBottom: 2 }}>FOH HANDOVER</div>
          <div style={{ fontSize: 32, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.05em", lineHeight: 1 }}>
            {t("TUS")} <span style={{ color: "#D4A843" }}>{t("FESTIVALES")}</span>
          </div>
        </div>
      </div>

      {/* lista festivales */}
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 14 }}>
        {myFests.map(f => {
          const total = (f.stages || []).reduce((s, st) => s + st.days.reduce((a, d) => a + d.artists.length, 0), 0);
          const fRole = getUserRole(f, userId);
          const fIsOwner = fRole === "owner";
          return (
            <div key={f.id} style={{ ...S.festCard, background: T.card, border: `1px solid ${T.border}`, position: "relative", overflow: "visible" }}
              onClick={() => { if (!editMode) onOpen(f.id); }}>
              <div style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {editMode && fIsOwner && (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmId(f.id); }}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", border: "none",
                      background: "#ef4444", color: "#fff", fontSize: 20, lineHeight: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
                      fontWeight: 700, flexShrink: 0,
                    }}
                  >−</button>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: T.text4 }}>{t("{s} stages · {a} artistas", { s: (f.stages || []).length, a: total })}</span>
                  {!fIsOwner && <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 4, background: fRole === "viewer" ? "#e0e7ff" : "#f0fdf4", color: fRole === "viewer" ? "#3730a3" : "#166534" }}>{fRole === "viewer" ? t("VISOR") : t("EDITOR")}</span>}
                </div>
              </div>
              <div style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {editMode && fIsOwner ? (
                  <button
                    onClick={e => { e.stopPropagation(); setEditFestId(f.id); }}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", border: "none",
                      background: "#D4A843", color: "#fff", fontSize: 14, lineHeight: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(245,158,11,0.4)",
                      flexShrink: 0,
                    }}
                  >✏️</button>
                ) : (
                  <span style={{ color: "#cbd5e1", fontSize: 18 }}>›</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* sección plantillas */}
      {templates.length > 0 && (
        <div style={{ flexShrink: 0, marginBottom: 10 }}>
          <button onClick={() => setShowTemplates(v => !v)} style={{
            width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px solid ${T.border}`,
            background: "transparent", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
            fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: T.text4,
          }}>
            <span>📋 {t("Plantillas")} ({templates.length})</span>
            <span style={{ display: "inline-block", transition: "transform 0.15s", transform: showTemplates ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
          </button>
          {showTemplates && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {templates.map(tpl => {
                const total = (tpl.stages || []).reduce((s, st) => s + st.days.reduce((a, d) => a + d.artists.length, 0), 0);
                return (
                  <div key={tpl.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    {editMode && (
                      <button onClick={() => setConfirmId(tpl.id)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.name}</div>
                      <div style={{ fontSize: 11, color: T.text4, marginTop: 1 }}>{t("{s} stages · {a} artistas", { s: (tpl.stages || []).length, a: total })}</div>
                    </div>
                    <button onClick={() => { setUseTemplate(tpl); setFestNameFromTpl(tpl.name); }} style={{
                      padding: "6px 12px", borderRadius: 8, border: "none", background: dark ? "#334155" : "#0f172a",
                      color: "#fff", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                    }}>{t("Usar")}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button onClick={onNew} style={{ ...S.bigBtn, marginTop: 0, flexShrink: 0 }}>{t("+ CREAR FESTIVAL")}</button>

      {/* popup confirmación borrado */}
      {confirmId && (() => {
        const item = [...myFests, ...templates].find(f => f.id === confirmId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setConfirmId(null)}>
            <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
              <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 8 }}>
                {item?.isTemplate ? t("¿Borrar plantilla?") : t("¿Borrar festival?")}
              </div>
              <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
                {t("Vas a borrar")} <strong style={{ color: T.text }}>{item?.name}</strong>{t(". Esta acción no se puede deshacer.")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmId(null)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
                  {t("Cancelar")}
                </button>
                <button onClick={() => { onDelete(confirmId); setConfirmId(null); setEditMode(false); }} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#fff" }}>
                  {t("Sí, borrar")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* modal usar plantilla */}
      {useTemplate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setUseTemplate(null)}>
          <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 4 }}>{t("USAR PLANTILLA")}</div>
            <div style={{ fontSize: 12, color: T.text4, textAlign: "center", fontFamily: "monospace", marginBottom: 20 }}>{useTemplate.name}</div>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>{t("NOMBRE DEL FESTIVAL")}</div>
            <input
              value={festNameFromTpl}
              onChange={e => setFestNameFromTpl(e.target.value)}
              autoFocus
              style={{ ...S.input, marginBottom: 20 }}
              placeholder={t("Ej: Mad Cool 27")}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setUseTemplate(null)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
                {t("Cancelar")}
              </button>
              <button
                onClick={() => { if (festNameFromTpl.trim()) { onCreateFromTemplate(useTemplate, festNameFromTpl.trim()); setUseTemplate(null); } }}
                disabled={!festNameFromTpl.trim()}
                style={{ flex: 1, padding: "14px", background: dark ? "#334155" : "#0f172a", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: festNameFromTpl.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Mono',monospace", color: "#fff", opacity: festNameFromTpl.trim() ? 1 : 0.4 }}>
                {t("Crear festival")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal editar festival */}
      {editFestId && (() => {
        const fest = myFests.find(f => f.id === editFestId);
        return (
          <FestEditModal
            fest={fest}
            onSave={updated => { onEdit(updated); setEditFestId(null); }}
            onSaveAsTemplate={(tplName) => { onSaveAsTemplate(myFests.find(f => f.id === editFestId), tplName); }}
            onClose={() => setEditFestId(null)}
          />
        );
      })()}

      {showNotifSettings && <NotificationSettings userId={userId} onClose={() => setShowNotifSettings(false)} />}
    </div>
  );
}

export default Home;
