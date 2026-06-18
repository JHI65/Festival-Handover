import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";
import { deleteAccount } from "../lib/api";

function DeleteAccountModal({ userEmail, onClose }) {
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirmWord = t("BORRAR");
  const ready = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();

  async function doDelete() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      // signOut dentro de deleteAccount → el listener de auth lleva al login
    } catch (err) {
      setError(err.message || t("No se pudo borrar la cuenta"));
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={busy ? undefined : onClose}>
      <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.3)", borderTop: "4px solid #ef4444" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 4 }}>
          {t("Borrar mi cuenta")}
        </div>
        {userEmail && <div style={{ fontSize: 11, color: T.text4, textAlign: "center", fontFamily: "'DM Mono',monospace", marginBottom: 8, wordBreak: "break-all" }}>{userEmail}</div>}
        <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>
          {t("Esta acción es permanente e irreversible.")}
        </div>

        <div style={{ fontSize: 11, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 6 }}>{t("Se borrarán para siempre:")}</div>
        <ul style={{ margin: "0 0 18px", padding: "0 0 0 18px", color: T.text3, fontSize: 12.5, lineHeight: 1.7 }}>
          <li>{t("Tus festivales y todos sus datos")}</li>
          <li>{t("Tu pertenencia a festivales de otros")}</li>
          <li>{t("Tus preferencias y avisos")}</li>
          <li>{t("Tu cuenta de acceso")}</li>
        </ul>

        <div style={{ fontSize: 11, color: T.text4, marginBottom: 6 }}>{t("Escribe {word} para confirmar", { word: confirmWord })}</div>
        <input
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={confirmWord}
          disabled={busy}
          autoFocus
          style={{ ...S.input, marginBottom: 14, textAlign: "center", letterSpacing: "0.1em", textTransform: "uppercase" }}
        />

        {error && <div style={{ fontSize: 12, color: "#ef4444", textAlign: "center", marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: busy ? "default" : "pointer", fontFamily: "'DM Mono',monospace", color: T.text2, opacity: busy ? 0.5 : 1 }}>
            {t("Cancelar")}
          </button>
          <button onClick={doDelete} disabled={!ready || busy} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: (ready && !busy) ? "pointer" : "not-allowed", fontFamily: "'DM Mono',monospace", color: "#fff", opacity: (ready && !busy) ? 1 : 0.4 }}>
            {busy ? t("Borrando…") : t("Borrar cuenta")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteAccountModal;
