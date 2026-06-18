import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";

function ShareModal({ fest, isOwner, ownerId, onManageMembers, onClose }) {
  const { t } = useLang();
  const editorUrl = `${window.location.origin}/Festival-Handover/?join=${fest.id}`;
  const viewerUrl = `${window.location.origin}/Festival-Handover/?join=${fest.id}&role=viewer`;
  const ownerUrl = `${window.location.origin}/Festival-Handover/?join=${fest.id}&role=owner`;
  const [step, setStep] = useState(null); // null | "picking"
  const [copied, setCopied] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  // step: null = botones iniciales | "share" | "copy" = eligiendo rol para esa acción
  const [pendingAction, setPendingAction] = useState(null); // "share" | "copy"

  function startAction(action) { setPendingAction(action); setStep("picking"); setCopied(false); }

  function pickRole(role) {
    const url = role === "viewer" ? viewerUrl : role === "owner" ? ownerUrl : editorUrl;
    const label = role === "viewer" ? t("Visor") : role === "owner" ? t("Owner") : t("Editor");
    if (pendingAction === "share" && navigator.share) {
      navigator.share({ title: fest.name, text: t("Te invito a {n} como {r}", { n: fest.name, r: label }), url }).catch(() => {});
      setStep(null); setPendingAction(null);
    } else {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => { setCopied(false); setStep(null); setPendingAction(null); }, 2000); });
    }
  }


  const members = (fest.members || []).filter(m => m !== ownerId && m !== fest.user_id);
  function setRole(mid, role) { onManageMembers({ ...fest, roles: { ...fest.roles, [mid]: role } }); }
  function removeMember(mid) {
    const newMembers = (fest.members || []).filter(m => m !== mid);
    const newRoles = { ...fest.roles }; delete newRoles[mid];
    const newInfo = { ...fest.memberInfo }; delete newInfo[mid];
    onManageMembers({ ...fest, members: newMembers, roles: newRoles, memberInfo: newInfo });
    setConfirmRemove(null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.15em" }}>{t("COMPARTIR")}</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em" }}>{fest.name}</div>
          </div>
          <button onClick={onClose} style={S.iconBtn}>✕</button>
        </div>

        {step === "picking" ? (
          /* ── Paso 2: elegir rol ── */
          <>
            <button onClick={() => { setStep(null); setPendingAction(null); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.text4, fontFamily: "monospace", fontSize: 11, marginBottom: 16, padding: 0 }}>
              {t("‹ Volver")}
            </button>
            <div style={{ fontSize: 13, color: T.text3, fontFamily: "monospace", marginBottom: 14, textAlign: "center" }}>
              {t("¿Con qué acceso?")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "owner",  label: "OWNER",  icon: "👑", accent: "#d97706" },
                { key: "editor", label: "EDITOR", icon: "✏️", accent: "#16a34a" },
                { key: "viewer", label: t("VISOR"),  icon: "👁",  accent: "#6366f1" },
              ].map(r => (
                <button key={r.key} onClick={() => pickRole(r.key)} style={{
                  width: "100%", padding: "16px 18px", borderRadius: 14, border: `1.5px solid ${T.border}`,
                  background: T.card2, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14,
                }}>
                  <span style={{ fontSize: 22 }}>{r.icon}</span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: r.accent, letterSpacing: "0.08em" }}>{r.label}</span>
                  {copied ? <span style={{ marginLeft: "auto", color: "#16a34a", fontSize: 13 }}>✓</span> : <span style={{ marginLeft: "auto", color: T.text4, fontSize: 18 }}>›</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          /* ── Paso 1: botones de acción ── */
          <div style={{ display: "flex", gap: 8 }}>
            {navigator.share && (
              <button onClick={() => startAction("share")} style={{
                flex: 1, padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer",
                fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
                background: dark ? "#334155" : "#0f172a", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                {t("COMPARTIR")}
              </button>
            )}
            <button onClick={() => startAction("copy")} style={{
              flex: 1, padding: "14px 0", borderRadius: 12, cursor: "pointer",
              fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
              background: copied ? "#16a34a" : T.card2,
              color: copied ? "#fff" : T.text2,
              border: `1.5px solid ${copied ? "#16a34a" : T.border}`,
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
              {copied ? t("COPIADO") : t("COPIAR URL")}
            </button>
          </div>
        )}

        {/* Miembros (solo owner) */}
        {isOwner && (
          <div style={{ marginTop: 18 }}>
            <button onClick={() => setShowMembers(v => !v)} style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.border}`,
              background: "transparent", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: T.text4,
            }}>
              <span>{t("Gestionar miembros")}{members.length > 0 ? ` (${members.length})` : ""}</span>
              <span style={{ display: "inline-block", transition: "transform 0.15s", transform: showMembers ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
            </button>
            {showMembers && (
              <div style={{ marginTop: 8 }}>
                {members.length === 0 ? (
                  <div style={{ padding: "16px 14px", textAlign: "center", fontSize: 11, color: T.text4, fontFamily: "monospace" }}>
                    {t("Aún no hay miembros. Comparte un enlace para invitar.")}
                  </div>
                ) : members.map(mid => {
                  const email = fest.memberInfo?.[mid]?.email || t("Usuario {x}", { x: mid.slice(0, 6) });
                  const role = fest.roles?.[mid] || "editor";
                  return (
                    <div key={mid} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: T.text, fontFamily: "monospace", wordBreak: "break-all" }}>{email}</div>
                          <div style={{ fontSize: 10, color: role === "viewer" ? "#6366f1" : role === "owner" ? "#d97706" : "#16a34a", fontFamily: "monospace", fontWeight: 700, marginTop: 2 }}>{role === "viewer" ? t("VISOR") : role === "owner" ? "OWNER" : "EDITOR"}</div>
                        </div>
                        {confirmRemove === mid ? (
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button onClick={() => removeMember(mid)} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: "#ef4444", color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>{t("Expulsar")}</button>
                            <button onClick={() => setConfirmRemove(null)} style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.text3, fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>{t("Cancelar")}</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmRemove(mid)} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "transparent", color: T.text4, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>✕</button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["owner", "editor", "viewer"].map(r => (
                          <button key={r} onClick={() => setRole(mid, r)} style={{
                            flex: 1, padding: "7px", borderRadius: 7, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700,
                            border: role === r ? "none" : `1px solid ${T.border}`,
                            background: role === r ? (r === "viewer" ? "#6366f1" : r === "owner" ? "#d97706" : "#16a34a") : "transparent",
                            color: role === r ? "#fff" : T.text4,
                          }}>{r === "viewer" ? t("Visor") : r === "owner" ? t("Owner") : t("Editor")}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareModal;
